import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "./firebase-admin";
import type { Gift } from "./gift";

/**
 * Undo a gift whose purchase was refunded or charged back.
 *
 * ⚠ WHY REVOKING IS NOT OPTIONAL. Without it, a free subscription is two steps
 * away for anybody: buy a gift, redeem it on a second account, ask the store for
 * a refund. The money comes back and the year stays. Apple's own rule — "such
 * gifts may only be refunded to the original purchaser" (guideline 3.1.1) —
 * assumes the goods go back with the money.
 *
 * ⚠ BUT IT DOES NOT CUT ANYONE OFF MID-SENTENCE. A redeemed gift is expired
 * through the ordinary lapse ladder (`lapsedAt = now`), which is the same
 * treatment a failed card payment gets: seven days of full access, then
 * read-only, then suspended — and nothing is ever deleted. The recipient is
 * usually innocent here; the person who took the money back is the buyer. They
 * lose the year, not their recipes, and they have a week to subscribe if they
 * want to keep going.
 *
 * Idempotent: stores retry notifications, and a second refund event for the
 * same transaction must not restart somebody's ladder from today.
 */
export async function revokeGiftByTransaction(
  transactionId: string,
  reason: "refund" | "chargeback" = "refund"
): Promise<{ revoked: boolean; wasRedeemed: boolean }> {
  if (!transactionId) return { revoked: false, wasRedeemed: false };

  const db = getAdminDb();
  const found = await db
    .collection("gifts")
    .where("transactionId", "==", transactionId)
    .limit(1)
    .get();
  if (found.empty) return { revoked: false, wasRedeemed: false };

  const giftSnap = found.docs[0];
  const gift = giftSnap.data() as Gift;

  // Already handled — a retried notification.
  if (gift.status === "revoked") {
    return { revoked: true, wasRedeemed: Boolean(gift.redeemedByUid) };
  }

  const now = new Date().toISOString();
  await giftSnap.ref.update({
    status: "revoked",
    revokedAt: now,
    revokedReason: reason,
    // Stop the sweep sending a card for a gift that no longer exists. An
    // unsent, unredeemed, refunded gift would otherwise still be delivered.
    sentAt: gift.sentAt ?? now,
  });

  if (!gift.redeemedByUid) {
    // Nothing was claimed. The /g/ page shows "no longer available" and
    // redemption already refuses a revoked code.
    return { revoked: true, wasRedeemed: false };
  }

  // ⚠ Only pull back the year if the redeemer is STILL on this gift. If they
  // have since subscribed properly, or redeemed a different gift, their
  // subscription doc has moved on — and cancelling it because an old gift was
  // refunded would cut off somebody who is paying us right now.
  const subRef = db.collection("subscriptions").doc(gift.redeemedByUid);
  const subSnap = await subRef.get();
  const sub = subSnap.data();
  if (!subSnap.exists || sub?.provider !== "gift" || sub?.giftCode !== gift.code) {
    return { revoked: true, wasRedeemed: true };
  }

  await subRef.update({
    status: "canceled",
    lapsedAt: now,
    giftRevokedAt: now,
    updatedAt: now,
    // The period is over; leaving it would have the sweep read a future end
    // date and treat the account as paid up.
    currentPeriodEnd: FieldValue.delete(),
  });

  return { revoked: true, wasRedeemed: true };
}
