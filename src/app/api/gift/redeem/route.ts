import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { canRedeem, giftExpiryFrom, normaliseGiftCode, type Gift } from "@/lib/gift";
import type { Subscription } from "@/lib/types";
import { reportError } from "@/lib/error-reporting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Redeem a gift code: grants the signed-in user a year on THEIR OWN cookbook.
//
// ⚠⚠ THE GIVER IS NOT INVOLVED. This does not add anyone to anyone's
// household, does not consume one of the giver's five seats, and gives the
// giver no access to what the recipient goes on to build. The recipient owns
// their cookbook outright, with their own seats to invite their own family.
// See lib/gift.ts for the full statement of the rule — the flow that DOES add
// somebody to your cookbook is /api/invite, and confusing the two would quietly
// turn every gift into a shared book.
//
// The user must already have a household. The clients redeem AFTER sign-up, so
// create-household has run and there is an owner cookbook to pay for.
export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    let uid: string;
    try {
      uid = (await getAdminAuth().verifyIdToken(token)).uid;
    } catch {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }

    const body = (await req.json()) as { code?: string };
    const code = normaliseGiftCode(body.code ?? "");
    if (!code) return NextResponse.json({ error: "missing_code" }, { status: 400 });

    const db = getAdminDb();
    const giftRef = db.collection("gifts").doc(code);
    const subRef = db.collection("subscriptions").doc(uid);

    // ⚠ The whole redemption is ONE transaction, and it has to be. Without it,
    // two devices submitting the same code within a few milliseconds of each
    // other both read "unredeemed" and both grant a year — one gift paying for
    // two cookbooks. Firestore transactions retry on contention, so the second
    // one re-reads the now-redeemed gift and refuses properly.
    const result = await db.runTransaction(async (tx) => {
      const giftSnap = await tx.get(giftRef);
      if (!giftSnap.exists) return { error: "not_found" as const, status: 404 };
      const gift = giftSnap.data() as Gift;

      const subSnap = await tx.get(subRef);
      const existing = subSnap.exists ? (subSnap.data() as Subscription) : null;

      // ⚠ The household must exist and be OWNED by this user. A guest member of
      // somebody else's cookbook has a subscription doc pointing at a book they
      // do not own, and granting a year against that would extend the OWNER's
      // access using a gift meant for the guest.
      const householdId = existing?.householdId;
      if (!householdId) return { error: "no_household" as const, status: 409 };
      const memberSnap = await tx.get(
        db.collection("householdMembers").doc(`${householdId}_${uid}`)
      );
      if (!memberSnap.exists || memberSnap.data()?.role !== "owner") {
        return { error: "not_owner" as const, status: 409 };
      }

      const verdict = canRedeem({ gift, redeemerUid: uid, existing });
      if (!verdict.ok) {
        return { error: verdict.reason, status: verdict.reason === "not_found" ? 404 : 409 };
      }

      const now = new Date();
      const expiresAt = giftExpiryFrom(verdict.startsAt, gift.days);

      tx.update(giftRef, {
        status: "redeemed",
        redeemedByUid: uid,
        redeemedAt: now.toISOString(),
        expiresAt,
      });

      // ⚠ provider "gift", status "active": a real paid year that does NOT
      // renew. lapsedAt is cleared because redeeming is a recovery — somebody
      // whose trial ran out last week is now paid up, and leaving the marker
      // would have the nightly sweep walk them down the lapse ladder while
      // holding a valid year.
      tx.set(
        subRef,
        {
          userId: uid,
          householdId,
          provider: "gift",
          status: "active",
          plan: "annual",
          currentPeriodEnd: expiresAt,
          giftCode: gift.code,
          lapsedAt: FieldValue.delete(),
          // ⚠ Deliberately NOT touching hasUsedTrial. A gift is not a trial,
          // and burning their one trial as a side effect of being given a
          // present would be a nasty surprise a year later.
          updatedAt: now.toISOString(),
        },
        { merge: true }
      );

      // A gift arriving mid-lapse restores the cookbook. Read-only or suspended
      // households come back to active; the ladder put them there and the
      // ladder's precondition has just gone away.
      tx.set(
        db.collection("households").doc(householdId),
        { accessState: "active", stateChangedAt: now.toISOString() },
        { merge: true }
      );

      return { ok: true as const, expiresAt, householdId };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true, expiresAt: result.expiresAt });
  } catch (err) {
    console.error("gift/redeem error:", err);
    reportError(err, { route: "gift/redeem" });
    return NextResponse.json({ error: "redeem_failed" }, { status: 500 });
  }
}
