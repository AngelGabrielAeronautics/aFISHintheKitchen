import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { MAX_SEATS, MAX_GUEST_BOOKS } from "@/lib/access";

export const runtime = "nodejs";

// Server-mediated household join. Required because the locked Firestore rules
// forbid clients from writing memberships / the owner's household doc. This is
// also where the seat (5) and guest-book (3) caps are truly enforced.
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

    const db = getAdminDb();

    // 1. There must be an invite for this email, tied to a household.
    const inviteRef = db.collection("invitedUsers").doc(emailLower);
    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists) return NextResponse.json({ error: "no_invite" }, { status: 403 });
    const invite = inviteSnap.data()!;
    const householdId: string | undefined = invite.householdId;
    if (!householdId) return NextResponse.json({ error: "no_household_on_invite" }, { status: 400 });

    // 2. Household must exist and be active (can't join a read-only/suspended book).
    const hhRef = db.collection("households").doc(householdId);
    const hhSnap = await hhRef.get();
    if (!hhSnap.exists) return NextResponse.json({ error: "household_not_found" }, { status: 404 });
    const hh = hhSnap.data()!;
    if ((hh.accessState ?? "active") !== "active") {
      return NextResponse.json({ error: "household_inactive" }, { status: 403 });
    }

    // 3. Idempotent: already a member → success, no-op.
    const already = await db
      .collection("householdMembers")
      .where("householdId", "==", householdId)
      .where("userId", "==", uid)
      .limit(1)
      .get();
    if (!already.empty) return NextResponse.json({ ok: true, alreadyMember: true });

    // 4. Guest-book cap: how many books is this user already a (non-owner) member of?
    const myMemberships = await db
      .collection("householdMembers")
      .where("userId", "==", uid)
      .where("role", "==", "member")
      .get();
    if (myMemberships.size >= MAX_GUEST_BOOKS) {
      return NextResponse.json({ error: "guest_book_limit", limit: MAX_GUEST_BOOKS }, { status: 409 });
    }

    // 5. Seat cap: never more than (5 + paid extra) active members in a household.
    const activeMembers = await db
      .collection("householdMembers")
      .where("householdId", "==", householdId)
      .where("role", "==", "member")
      .get();
    const subSnap = await db.collection("subscriptions").doc(hh.ownerId).get();
    const extraSeats: number = subSnap.exists ? (subSnap.data()?.extraSeats ?? 0) : 0;
    if (activeMembers.size >= MAX_SEATS + extraSeats) {
      return NextResponse.json({ error: "seat_limit", limit: MAX_SEATS + extraSeats }, { status: 409 });
    }

    // 6. Join: write membership + memberIds + mark invite registered, atomically.
    const now = new Date().toISOString();
    const memberRef = db.collection("householdMembers").doc();
    const batch = db.batch();
    batch.set(memberRef, {
      userId: uid,
      householdId,
      displayName: tokenName || invite.name || emailLower,
      role: "member",
      joinedAt: now,
    });
    batch.update(hhRef, { memberIds: FieldValue.arrayUnion(uid) });
    batch.update(inviteRef, { status: "registered", registeredAt: now });
    await batch.commit();

    // The invite was sent to this email and the user accepted it from there, so
    // they've already proven they control the address — mark them verified and
    // skip the redundant email-verification gate.
    try {
      await getAdminAuth().updateUser(uid, { emailVerified: true });
    } catch {
      // Non-fatal: the verify-email gate's resend still works as a fallback.
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("join error:", err);
    return NextResponse.json({ error: "join_failed" }, { status: 500 });
  }
}
