import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { MAX_SEATS, MAX_GUEST_BOOKS } from "@/lib/access";
import { INVITES, syncLegacyMirror, type InviteDoc } from "@/lib/invites";

export const runtime = "nodejs";

// POST /api/join — the signed-in user accepts EVERY pending invitation
// addressed to their email. The address IS the invitation: the server matches
// on the authenticated email, so the link is a convenience, not a credential.
//
// Invites are keyed by (address, cookbook), so one person can hold several.
// Each is judged on its own — a full cookbook or an inactive one refuses that
// invite without spoiling the others — and the response says which books were
// joined so the client can open the new one rather than reload into the old.
//
// Optional body `{ householdId }` narrows the accept to one book (the web
// /invited page knows which link was tapped); the apps send nothing and take
// them all.
export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    let uid: string;
    let emailLower: string;
    let tokenName: string | undefined;
    try {
      const decoded = await getAdminAuth().verifyIdToken(token);
      uid = decoded.uid;
      emailLower = (decoded.email ?? "").toLowerCase().trim();
      tokenName = decoded.name as string | undefined;
    } catch {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }
    if (!emailLower) return NextResponse.json({ error: "no_email" }, { status: 400 });

    let only: string | undefined;
    try {
      const body = (await req.json()) as { householdId?: string } | null;
      only = body?.householdId?.trim() || undefined;
    } catch {
      // No body is the normal case.
    }

    const db = getAdminDb();
    const pendingSnap = await db
      .collection(INVITES)
      .where("email", "==", emailLower)
      .where("status", "==", "pending")
      .get();
    const pending = pendingSnap.docs
      .filter((d) => !only || (d.data() as InviteDoc).householdId === only)
      .sort((a, b) => (Date.parse(a.data().createdAt) || 0) - (Date.parse(b.data().createdAt) || 0));
    if (pending.length === 0) {
      return NextResponse.json({ error: "no_invite" }, { status: 403 });
    }

    // What the user already belongs to, once — the guest-book cap counts
    // memberships as they accumulate through this loop.
    const mineSnap = await db.collection("householdMembers").where("userId", "==", uid).get();
    const myHouseholds = new Set(mineSnap.docs.map((d) => d.data().householdId as string));
    let guestBooks = mineSnap.docs.filter((d) => d.data().role === "member").length;

    const joined: string[] = [];
    const alreadyMember: string[] = [];
    const refused: { householdId: string; error: string }[] = [];
    const now = new Date().toISOString();

    for (const inviteDoc of pending) {
      const invite = inviteDoc.data() as InviteDoc;
      const householdId = invite.householdId;
      if (!householdId) {
        refused.push({ householdId: "", error: "no_household_on_invite" });
        continue;
      }

      if (myHouseholds.has(householdId)) {
        // Joined some other way (or before) — just close the invite out.
        await inviteDoc.ref.set({ status: "registered", registeredAt: now }, { merge: true });
        alreadyMember.push(householdId);
        continue;
      }

      const hhRef = db.collection("households").doc(householdId);
      const hhSnap = await hhRef.get();
      if (!hhSnap.exists) {
        refused.push({ householdId, error: "household_not_found" });
        continue;
      }
      const hh = hhSnap.data()!;
      if ((hh.accessState ?? "active") !== "active") {
        refused.push({ householdId, error: "household_inactive" });
        continue;
      }

      if (guestBooks >= MAX_GUEST_BOOKS) {
        refused.push({ householdId, error: "guest_book_limit" });
        continue;
      }

      const activeMembers = await db
        .collection("householdMembers")
        .where("householdId", "==", householdId)
        .where("role", "==", "member")
        .get();
      const subSnap = await db.collection("subscriptions").doc(hh.ownerId).get();
      const extraSeats: number = subSnap.exists ? (subSnap.data()?.extraSeats ?? 0) : 0;
      if (activeMembers.size >= MAX_SEATS + extraSeats) {
        refused.push({ householdId, error: "seat_limit" });
        continue;
      }

      const displayName = tokenName || invite.name || emailLower;
      const profileCount = (
        await db.collection("members").where("householdId", "==", householdId).count().get()
      ).data().count;

      const batch = db.batch();
      batch.set(db.collection("householdMembers").doc(), {
        userId: uid,
        householdId,
        displayName,
        role: "member",
        joinedAt: now,
      });
      batch.set(db.collection("members").doc(), {
        householdId,
        userId: uid,
        order: profileCount,
        name: displayName,
        title: "",
        bio: "",
        goodAt: [],
        loves: [],
        hates: [],
        favouriteFromBook: "",
        favouriteNotInBook: "",
      });
      batch.update(hhRef, { memberIds: FieldValue.arrayUnion(uid) });
      batch.update(inviteDoc.ref, { status: "registered", registeredAt: now });
      await batch.commit();

      myHouseholds.add(householdId);
      guestBooks += 1;
      joined.push(householdId);
    }

    // Keep the address-keyed doc the 1.10 apps still read in step.
    await syncLegacyMirror(db, emailLower);

    if (joined.length > 0 || alreadyMember.length > 0) {
      // Being invited proves control of the address; unblock the write gate
      // that otherwise waits on the verification email.
      try {
        await getAdminAuth().updateUser(uid, { emailVerified: true });
      } catch {
        // Non-fatal.
      }
      return NextResponse.json({
        ok: true,
        joined,
        alreadyMember: joined.length === 0,
        alreadyMemberOf: alreadyMember,
        refused,
      });
    }

    // Nothing could be accepted — surface the first reason the way the old
    // single-invite route did, so existing client copy still applies.
    const first = refused[0]?.error ?? "no_invite";
    const status = first === "household_not_found" ? 404 : first === "no_invite" ? 403 : first === "household_inactive" ? 403 : 409;
    return NextResponse.json({ error: first, refused }, { status });
  } catch (err) {
    console.error("join error:", err);
    return NextResponse.json({ error: "join_failed" }, { status: 500 });
  }
}
