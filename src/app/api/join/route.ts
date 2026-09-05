import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { MAX_SEATS, MAX_GUEST_BOOKS } from "@/lib/access";
import { INVITES, syncLegacyMirror, type InviteDoc } from "@/lib/invites";
import { JOIN_CODES, loadJoinCode, isOpen } from "@/lib/join-codes";

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
//
// Body `{ code }` is the OTHER way in: a join code the owner handed over (see
// lib/join-codes.ts). No email matching at all — whoever redeems it, signed in
// as whoever they are, joins that one book, subject to the same caps.
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
    let code: string | undefined;
    try {
      const body = (await req.json()) as { householdId?: string; code?: string } | null;
      only = body?.householdId?.trim() || undefined;
      code = body?.code?.trim() || undefined;
    } catch {
      // No body is the normal case.
    }

    const db = getAdminDb();

    if (code) {
      return redeemCode(db, code, { uid, emailLower, tokenName });
    }
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


type Joiner = { uid: string; emailLower: string; tokenName?: string };

/** Add `uid` to `householdId` as a member, with a profile card, in one batch. */
async function addMember(
  db: ReturnType<typeof getAdminDb>,
  householdId: string,
  who: Joiner,
  displayName: string,
  extraWrites?: (batch: FirebaseFirestore.WriteBatch) => void,
) {
  const now = new Date().toISOString();
  const profileCount = (
    await db.collection("members").where("householdId", "==", householdId).count().get()
  ).data().count;
  const batch = db.batch();
  batch.set(db.collection("householdMembers").doc(), {
    userId: who.uid,
    householdId,
    displayName,
    role: "member",
    joinedAt: now,
  });
  batch.set(db.collection("members").doc(), {
    householdId,
    userId: who.uid,
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
  batch.update(db.collection("households").doc(householdId), { memberIds: FieldValue.arrayUnion(who.uid) });
  extraWrites?.(batch);
  await batch.commit();
}

/**
 * The join-code path. Same caps as an email invite, judged for this one book;
 * the code is spent on success and untouched on refusal so the person can try
 * again once a seat frees up.
 */
async function redeemCode(db: ReturnType<typeof getAdminDb>, raw: string, who: Joiner) {
  const jc = await loadJoinCode(db, raw);
  if (!jc) return NextResponse.json({ error: "code_not_found" }, { status: 404 });
  if (jc.status === "used") return NextResponse.json({ error: "code_used" }, { status: 409 });
  if (!isOpen(jc)) return NextResponse.json({ error: "code_expired" }, { status: 410 });

  const hhSnap = await db.collection("households").doc(jc.householdId).get();
  if (!hhSnap.exists) return NextResponse.json({ error: "household_not_found" }, { status: 404 });
  const hh = hhSnap.data()!;
  if ((hh.accessState ?? "active") !== "active") {
    return NextResponse.json({ error: "household_inactive" }, { status: 403 });
  }
  if (hh.ownerId === who.uid) return NextResponse.json({ error: "own_cookbook" }, { status: 409 });

  const mineSnap = await db.collection("householdMembers").where("userId", "==", who.uid).get();
  if (mineSnap.docs.some((d) => d.data().householdId === jc.householdId)) {
    return NextResponse.json({ ok: true, joined: [], alreadyMember: true, alreadyMemberOf: [jc.householdId], householdId: jc.householdId });
  }
  const guestBooks = mineSnap.docs.filter((d) => d.data().role === "member").length;
  if (guestBooks >= MAX_GUEST_BOOKS) {
    return NextResponse.json({ error: "guest_book_limit", limit: MAX_GUEST_BOOKS }, { status: 409 });
  }

  const [activeMembers, subSnap] = await Promise.all([
    db.collection("householdMembers").where("householdId", "==", jc.householdId).where("role", "==", "member").get(),
    db.collection("subscriptions").doc(hh.ownerId).get(),
  ]);
  const extraSeats: number = subSnap.exists ? (subSnap.data()?.extraSeats ?? 0) : 0;
  if (activeMembers.size >= MAX_SEATS + extraSeats) {
    return NextResponse.json({ error: "seat_limit", limit: MAX_SEATS + extraSeats }, { status: 409 });
  }

  // The name the owner wrote on the code beats the account's display name —
  // identity in a cookbook is the NAME, and "Michael" is what his brother
  // will look for, not whatever Apple put on the account.
  const displayName = jc.forName || who.tokenName || who.emailLower;
  const now = new Date().toISOString();
  await addMember(db, jc.householdId, who, displayName, (batch) => {
    batch.update(db.collection(JOIN_CODES).doc(jc.code), {
      status: "used",
      usedAt: now,
      usedBy: who.uid,
      usedByName: displayName,
    });
  });
  try {
    await getAdminAuth().updateUser(who.uid, { emailVerified: true });
  } catch {
    // Non-fatal.
  }
  return NextResponse.json({ ok: true, joined: [jc.householdId], alreadyMember: false, householdId: jc.householdId, householdName: hh.customisation?.brandName ?? hh.name ?? "" });
}
