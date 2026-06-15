import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { sendTransactionalEmail } from "@/lib/email";
import { buildInviteEmail } from "@/lib/invite-email";
import { MAX_SEATS } from "@/lib/access";

export const runtime = "nodejs";

// Server-mediated invite creation. This is the authoritative enforcement point:
// the Firestore rules forbid clients from writing `invitedUsers` directly, so
// owner-auth, the duplicate guard, and the seat cap are all enforced here via
// the Admin SDK (which bypasses the rules). The client form keeps the same
// checks only as UX hints. Mirrors the /api/join cap logic. See the
// project_subscription_model spec.

interface InviteBody {
  householdId: string;
  email: string;
  name: string;
  // Display name of the inviting owner, for the email + the invitedBy field.
  inviterName: string;
  // The app's /auth URL (origin-relative is resolved client-side). Invitee
  // details are appended by the email builder.
  signupUrl: string;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      return NextResponse.json({ error: "email_not_configured" }, { status: 500 });
    }

    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    let callerUid: string;
    let callerEmail: string;
    let callerVerified: boolean;
    try {
      const decoded = await getAdminAuth().verifyIdToken(token);
      callerUid = decoded.uid;
      callerEmail = (decoded.email ?? "").toLowerCase().trim();
      callerVerified = decoded.email_verified === true;
    } catch {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }

    const body = (await req.json()) as Partial<InviteBody>;
    const householdId = body.householdId?.trim();
    const inviteEmail = body.email?.toLowerCase().trim();
    const inviteName = body.name?.trim();
    const signupUrl = body.signupUrl?.trim();
    const inviterName = body.inviterName?.trim() || callerEmail;
    if (!householdId || !inviteEmail || !inviteName || !signupUrl) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }
    // Cheap sanity check; the real gate is that the address must accept the email.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    }

    const db = getAdminDb();

    // 1. Caller must own this household, and (mirroring the create rule) have a
    //    verified email. Only an active household can be managed.
    const hhRef = db.collection("households").doc(householdId);
    const hhSnap = await hhRef.get();
    if (!hhSnap.exists) return NextResponse.json({ error: "household_not_found" }, { status: 404 });
    const hh = hhSnap.data()!;
    if (hh.ownerId !== callerUid) {
      return NextResponse.json({ error: "not_owner" }, { status: 403 });
    }
    if (!callerVerified) {
      return NextResponse.json({ error: "email_unverified" }, { status: 403 });
    }
    if ((hh.accessState ?? "active") !== "active") {
      return NextResponse.json({ error: "household_inactive" }, { status: 403 });
    }

    // 2. Can't invite yourself.
    if (inviteEmail === callerEmail) {
      return NextResponse.json({ error: "self_invite" }, { status: 409 });
    }

    // 3. Duplicate guard (authoritative). invitedUsers is keyed by email, so a
    //    pre-existing doc means the address is already invited — possibly to a
    //    different cookbook, which we must not clobber.
    const inviteRef = db.collection("invitedUsers").doc(inviteEmail);
    const existingSnap = await inviteRef.get();
    if (existingSnap.exists) {
      const existing = existingSnap.data()!;
      if (existing.householdId && existing.householdId !== householdId) {
        return NextResponse.json({ error: "invited_elsewhere" }, { status: 409 });
      }
      return NextResponse.json(
        { error: existing.status === "registered" ? "already_member" : "already_invited" },
        { status: 409 }
      );
    }

    // 4. Seat cap (authoritative). Used = active members (role member, owner not
    //    counted) + outstanding pending invites. Mirrors countHouseholdSeats and
    //    the hard cap re-checked at /api/join.
    const [membersSnap, pendingSnap, subSnap] = await Promise.all([
      db.collection("householdMembers")
        .where("householdId", "==", householdId)
        .where("role", "==", "member")
        .get(),
      db.collection("invitedUsers")
        .where("householdId", "==", householdId)
        .where("status", "==", "pending")
        .get(),
      db.collection("subscriptions").doc(hh.ownerId).get(),
    ]);
    const extraSeats: number = subSnap.exists ? (subSnap.data()?.extraSeats ?? 0) : 0;
    const limit = MAX_SEATS + extraSeats;
    const used = membersSnap.size + pendingSnap.size;
    if (used >= limit) {
      return NextResponse.json({ error: "seat_limit", limit }, { status: 409 });
    }

    // 5. Create the invite (server-only write).
    await inviteRef.set({
      name: inviteName,
      invitedBy: inviterName,
      householdId,
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    // 6. Send the invite email. The allow-list entry already succeeded, so a
    //    send failure is non-fatal — report it so the owner can share the link.
    const householdName: string | undefined = hh.customisation?.brandName;
    let emailSent = false;
    try {
      const { subject, html, text } = buildInviteEmail({
        email: inviteEmail,
        name: inviteName,
        inviterName,
        householdName,
        signupUrl,
      });
      await sendTransactionalEmail({ to: inviteEmail, subject, html, text });
      emailSent = true;
    } catch (err) {
      console.error("invite email send failed:", err);
    }

    return NextResponse.json({ ok: true, emailSent });
  } catch (err) {
    console.error("invite error:", err);
    return NextResponse.json({ error: "invite_failed" }, { status: 500 });
  }
}
