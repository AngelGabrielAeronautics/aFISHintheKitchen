import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { revokeGiftByTransaction } from "@/lib/gift-refund";
import { applyBillingEvent, type BillingEvent } from "@/lib/billing";
import { verifyPlayPurchase, statusForState } from "@/lib/play-verify";

export const runtime = "nodejs";

// Google Play Real-time developer notifications — the counterpart to
// /api/billing/appstore/notifications, and just as load-bearing.
//
// ⚠ Without this endpoint a Play subscription NEVER ends. The purchase route
// writes "active" once, `api/cron/lapse-sweep` deliberately skips anything with
// a real provider, and nothing else ever revisits it — so a cancelled, expired,
// or refunded subscriber would keep full access forever. Renewals, billing
// failures and refunds all arrive here or not at all.
//
// Delivery is via Cloud Pub/Sub push, so the body is a Pub/Sub envelope wrapping
// a base64 DeveloperNotification. Setup:
//   1. Play Console → Monetise → Monetisation setup → paste the Pub/Sub topic
//   2. Pub/Sub → that topic → push subscription →
//      https://www.afishinthekitchen.com/api/billing/play/notifications?secret=…
//   3. Vercel env PLAY_RTDN_SECRET = the same value
const MONTHLY_PRODUCT = "afk_monthly";
const ANNUAL_PRODUCT = "afk_annual";

interface DeveloperNotification {
  packageName?: string;
  subscriptionNotification?: { notificationType?: number; purchaseToken?: string };
  voidedPurchaseNotification?: { purchaseToken?: string; orderId?: string };
  testNotification?: { version?: string };
}

export async function POST(req: NextRequest) {
  try {
    // Unlike Apple, Google does not sign anything we can verify offline, so the
    // endpoint is protected by a shared secret on the push URL.
    //
    // ⚠ Fails CLOSED when unset. That is deliberate: a silently unauthenticated
    // billing endpoint is worse than a broken one, and a broken one shows up in
    // Pub/Sub's own delivery-error metrics.
    const expected = process.env.PLAY_RTDN_SECRET;
    if (!expected) {
      console.error("play rtdn: PLAY_RTDN_SECRET is not set — rejecting");
      return NextResponse.json({ error: "not_configured" }, { status: 401 });
    }
    if (req.nextUrl.searchParams.get("secret") !== expected) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const envelope = (await req.json()) as { message?: { data?: string } };
    const raw = envelope.message?.data;
    // Ack anything malformed. Returning non-2xx makes Pub/Sub redeliver forever,
    // and a message we can't parse will never parse.
    if (!raw) return NextResponse.json({ received: true });

    const notification = JSON.parse(
      Buffer.from(raw, "base64").toString("utf8")
    ) as DeveloperNotification;

    if (notification.testNotification) {
      console.info("play rtdn: test notification received");
      return NextResponse.json({ received: true, test: true });
    }

    const voided = notification.voidedPurchaseNotification;
    const sub = notification.subscriptionNotification;
    const purchaseToken = sub?.purchaseToken ?? voided?.purchaseToken;
    if (!purchaseToken) return NextResponse.json({ received: true });

    // ⚠ GIFTS FIRST, and specifically before verifyPlayPurchase below — that
    // call hits the SUBSCRIPTION endpoint, which fails outright for a one-time
    // product token. A voided gift matched here on the order id, which is what
    // /api/gift/purchase stored as the transaction id for Play.
    if (voided?.orderId) {
      const result = await revokeGiftByTransaction(voided.orderId);
      if (result.revoked) {
        return NextResponse.json({ received: true, gift: result });
      }
      // Not a gift — fall through and treat it as a voided subscription.
    }

    // ⚠ The notification is only a HINT that something changed. Every field we
    // act on is re-read from Google, so a forged or replayed message can at
    // worst make us look up a token — it can never grant access.
    let purchase;
    try {
      purchase = await verifyPlayPurchase(purchaseToken);
    } catch (err) {
      // 500 so Pub/Sub retries — Google being briefly unreachable must not lose
      // a cancellation.
      console.error("play rtdn: verification failed:", err);
      return NextResponse.json({ error: "verification_failed" }, { status: 500 });
    }

    if (purchase.productId !== MONTHLY_PRODUCT && purchase.productId !== ANNUAL_PRODUCT) {
      return NextResponse.json({ received: true });
    }

    // Find whose subscription this is. The account id is derived from the uid
    // and survives a resubscribe; the order id does not, so it's the fallback
    // for docs written before that field existed.
    const db = getAdminDb();
    const subs = db.collection("subscriptions");
    let found = purchase.obfuscatedAccountId
      ? await subs.where("playAccountId", "==", purchase.obfuscatedAccountId).limit(1).get()
      : null;
    if (!found || found.empty) {
      found = await subs.where("providerSubscriptionId", "==", purchase.subscriptionId).limit(1).get();
    }
    if (found.empty) {
      console.error("play rtdn: no subscription for", purchase.subscriptionId);
      return NextResponse.json({ received: true, unresolved: true });
    }

    const subDoc = found.docs[0];
    const userId = subDoc.id;
    const householdId = subDoc.data().householdId as string | undefined;
    if (!householdId) return NextResponse.json({ received: true, unresolved: true });

    // A refund is the one case we don't take from the subscription state:
    // Google can still report a refunded subscription as active for the rest of
    // the period, and we're not giving away what we just paid back.
    const status = voided ? "canceled" : statusForState(purchase.state, purchase.isTrial);
    const plan: "monthly" | "annual" =
      purchase.productId === ANNUAL_PRODUCT ? "annual" : "monthly";
    const periodEnd = purchase.expiryTime ?? undefined;

    const event: BillingEvent = {
      userId,
      householdId,
      provider: "play",
      providerSubscriptionId: purchase.subscriptionId,
      status,
      plan,
      trialEndsAt: purchase.isTrial ? periodEnd : undefined,
      currentPeriodEnd: periodEnd,
    };

    const current = subDoc.data() as { hasUsedTrial?: boolean; lapsedAt?: string };
    const applied = applyBillingEvent(current, event);

    const subData: Record<string, unknown> = {
      userId,
      ...applied.subscription,
      updatedAt: new Date().toISOString(),
    };
    for (const k of Object.keys(subData)) if (subData[k] === undefined) delete subData[k];
    subData.lapsedAt =
      applied.subscription.lapsedAt === null ? FieldValue.delete() : applied.subscription.lapsedAt;

    const batch = db.batch();
    batch.set(subDoc.ref, subData, { merge: true });
    batch.set(
      db.collection("households").doc(householdId),
      { accessState: applied.accessState, stateChangedAt: new Date().toISOString() },
      { merge: true }
    );
    await batch.commit();

    return NextResponse.json({
      received: true,
      type: sub?.notificationType ?? (voided ? "voided" : null),
      accessState: applied.accessState,
    });
  } catch (err) {
    console.error("play rtdn error:", err);
    return NextResponse.json({ error: "notification_failed" }, { status: 500 });
  }
}
