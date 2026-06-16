import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { applyBillingEvent, type BillingEvent } from "@/lib/billing";
import { verifyAppStoreNotification, verifyAppStoreTransaction } from "@/lib/appstore-verify";
import { NotificationTypeV2 } from "@apple/app-store-server-library";

export const runtime = "nodejs";

// App Store Server Notifications V2 — Apple calls this when a subscription event
// happens off-app (renewal, expiry, billing failure, refund, etc.) so Firestore
// stays in sync without the app being opened. Security = the signed-payload
// verification (Apple-signed); no Firebase auth.
//
// Configure the URL in App Store Connect → your app → App Information →
// App Store Server Notifications (Production + Sandbox):
//   https://www.afishinthekitchen.com/api/billing/appstore/notifications
const MONTHLY_PRODUCT = "angelgabriel.afishinthekitchen.monthly";
const ANNUAL_PRODUCT = "angelgabriel.afishinthekitchen.annual";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { signedPayload?: string };
    if (!body.signedPayload) return NextResponse.json({ error: "missing_payload" }, { status: 400 });

    let notification;
    try {
      notification = await verifyAppStoreNotification(body.signedPayload);
    } catch (err) {
      console.error("appstore notification verification failed:", err);
      return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
    }

    const signedTx = notification.data?.signedTransactionInfo;
    if (!signedTx) return NextResponse.json({ received: true }); // not subscription-relevant

    const tx = await verifyAppStoreTransaction(signedTx);
    const productId = tx.productId;
    if (productId !== MONTHLY_PRODUCT && productId !== ANNUAL_PRODUCT) {
      return NextResponse.json({ received: true });
    }

    // Resolve our user/household from the original transaction id (stored as
    // providerSubscriptionId on the subscription doc by /api/billing/appstore).
    const db = getAdminDb();
    const subQuery = await db
      .collection("subscriptions")
      .where("providerSubscriptionId", "==", tx.originalTransactionId)
      .limit(1)
      .get();
    if (subQuery.empty) {
      console.error("appstore notification: no subscription for", tx.originalTransactionId, notification.notificationType);
      return NextResponse.json({ received: true, unresolved: true });
    }
    const subDoc = subQuery.docs[0];
    const userId = subDoc.id;
    const householdId = subDoc.data().householdId as string | undefined;
    if (!householdId) return NextResponse.json({ received: true, unresolved: true });

    const type = notification.notificationType;
    const expiresMs = tx.expiresDate;
    const expired = typeof expiresMs === "number" && expiresMs < Date.now();
    const isTrial = tx.offerType === 1;

    let status: "trialing" | "active" | "past_due" | "canceled" | "incomplete";
    if (type === NotificationTypeV2.REFUND || type === NotificationTypeV2.REVOKE) {
      status = "canceled";
    } else if (type === NotificationTypeV2.EXPIRED || type === NotificationTypeV2.GRACE_PERIOD_EXPIRED) {
      status = "canceled";
    } else if (type === NotificationTypeV2.DID_FAIL_TO_RENEW) {
      status = "past_due"; // grace window — the lapse ladder keeps access for ~7 days
    } else {
      status = expired ? "canceled" : isTrial ? "trialing" : "active";
    }

    const plan: "monthly" | "annual" = productId === ANNUAL_PRODUCT ? "annual" : "monthly";
    const periodEnd = typeof expiresMs === "number" ? new Date(expiresMs).toISOString() : undefined;

    const event: BillingEvent = {
      userId,
      householdId,
      provider: "appstore",
      providerSubscriptionId: tx.originalTransactionId,
      status,
      plan,
      trialEndsAt: isTrial ? periodEnd : undefined,
      currentPeriodEnd: periodEnd,
    };

    const current = subDoc.data() as { hasUsedTrial?: boolean; lapsedAt?: string };
    const applied = applyBillingEvent(current, event);

    const subData: Record<string, unknown> = { userId, ...applied.subscription, updatedAt: new Date().toISOString() };
    for (const k of Object.keys(subData)) if (subData[k] === undefined) delete subData[k];
    subData.lapsedAt = applied.subscription.lapsedAt === null ? FieldValue.delete() : applied.subscription.lapsedAt;

    const batch = db.batch();
    batch.set(subDoc.ref, subData, { merge: true });
    batch.set(
      db.collection("households").doc(householdId),
      { accessState: applied.accessState, stateChangedAt: new Date().toISOString() },
      { merge: true }
    );
    await batch.commit();

    return NextResponse.json({ received: true, type, accessState: applied.accessState });
  } catch (err) {
    console.error("appstore notification error:", err);
    return NextResponse.json({ error: "notification_failed" }, { status: 500 });
  }
}
