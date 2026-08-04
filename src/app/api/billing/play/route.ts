import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { applyBillingEvent, type BillingEvent } from "@/lib/billing";
import {
  verifyPlayPurchase,
  obfuscatedAccountIdForUid,
  statusForState,
} from "@/lib/play-verify";
import { reportError } from "@/lib/error-reporting";

export const runtime = "nodejs";

// Syncs a Google Play subscription into Firestore — the Android counterpart to
// /api/billing/appstore, deliberately mirroring its checks so the two stores
// cannot drift into different security postures.
//
// The Android app sends a purchase TOKEN. We exchange it with the Play Developer
// API and act only on what Google says, never on what the client claims.
//
// ⚠ The app must not acknowledge the purchase until this returns ok. Google
// auto-refunds a subscription that goes unacknowledged for three days, so
// acknowledging first would risk taking money for access we never recorded —
// and acknowledging only after we've stored it means a failed sync retries
// instead of silently losing the sale. Same reasoning as leaving a StoreKit
// transaction unfinished on iOS.
const MONTHLY_PRODUCT = "afk_monthly";
const ANNUAL_PRODUCT = "afk_annual";

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

    const body = (await req.json()) as { householdId?: string; purchaseToken?: string };
    const householdId = body.householdId?.trim();
    const purchaseToken = body.purchaseToken?.trim();
    if (!householdId || !purchaseToken) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    // Ask Google what this token actually is.
    let purchase;
    try {
      purchase = await verifyPlayPurchase(purchaseToken);
    } catch (err) {
      // ⚠ 502, not 400. A failure here is usually Google being unreachable or a
      // credentials problem, NOT a bad purchase — answering "invalid" would tell
      // the app to give up on a sale the customer has already paid for. 502 says
      // "unknown, try again".
      console.error("play: purchase verification failed:", err);
      reportError(err, { route: "billing/play", stage: "verify" });
      return NextResponse.json({ error: "verification_unavailable" }, { status: 502 });
    }

    if (purchase.productId !== MONTHLY_PRODUCT && purchase.productId !== ANNUAL_PRODUCT) {
      return NextResponse.json({ error: "unknown_product" }, { status: 400 });
    }

    const db = getAdminDb();

    // Bind the purchase to the buyer, exactly as the App Store route does with
    // appAccountToken: the app stamps an obfuscated account id derived from the
    // Firebase uid, so a shared or replayed token cannot activate someone else's
    // account. Absent on purchases made before the app set it — the claim check
    // below still covers those.
    if (
      purchase.obfuscatedAccountId &&
      purchase.obfuscatedAccountId !== (await obfuscatedAccountIdForUid(uid))
    ) {
      console.warn(`play: obfuscatedAccountId mismatch for uid ${uid}`);
      return NextResponse.json({ error: "wrong_account" }, { status: 403 });
    }

    // One Play subscription activates ONE account.
    const claimed = await db
      .collection("subscriptions")
      .where("providerSubscriptionId", "==", purchase.subscriptionId)
      .limit(1)
      .get();
    if (!claimed.empty && claimed.docs[0].id !== uid) {
      console.warn(`play: subscription ${purchase.subscriptionId} already claimed`);
      return NextResponse.json({ error: "transaction_already_claimed" }, { status: 409 });
    }

    // Caller must own the household this subscription pays for.
    const hhRef = db.collection("households").doc(householdId);
    const hhSnap = await hhRef.get();
    if (!hhSnap.exists) return NextResponse.json({ error: "household_not_found" }, { status: 404 });
    if (hhSnap.data()!.ownerId !== uid) {
      return NextResponse.json({ error: "not_owner" }, { status: 403 });
    }

    // Build the event from VERIFIED fields.
    const plan: "monthly" | "annual" =
      purchase.productId === ANNUAL_PRODUCT ? "annual" : "monthly";
    const status = statusForState(purchase.state, purchase.isTrial);
    const periodEnd = purchase.expiryTime ?? undefined;

    const event: BillingEvent = {
      userId: uid,
      householdId,
      provider: "play",
      providerSubscriptionId: purchase.subscriptionId,
      status,
      plan,
      trialEndsAt: purchase.isTrial ? periodEnd : undefined,
      currentPeriodEnd: periodEnd,
    };

    const subRef = db.collection("subscriptions").doc(uid);
    const current = (await subRef.get()).data() as
      | { hasUsedTrial?: boolean; lapsedAt?: string }
      | undefined;
    const applied = applyBillingEvent(current ?? null, event);

    const subData: Record<string, unknown> = {
      userId: uid,
      ...applied.subscription,
      // ⚠ Stored so Play's server notifications can find this user again.
      // A resubscribe mints a brand-new order id, so providerSubscriptionId
      // stops matching and a cancellation would arrive for a subscription we
      // can't place — leaving someone entitled forever. This id is derived from
      // the uid and never changes.
      playAccountId: purchase.obfuscatedAccountId ?? (await obfuscatedAccountIdForUid(uid)),
      updatedAt: new Date().toISOString(),
    };
    for (const k of Object.keys(subData)) if (subData[k] === undefined) delete subData[k];
    subData.lapsedAt =
      applied.subscription.lapsedAt === null ? FieldValue.delete() : applied.subscription.lapsedAt;

    const batch = db.batch();
    batch.set(subRef, subData, { merge: true });
    batch.set(
      hhRef,
      { accessState: applied.accessState, stateChangedAt: new Date().toISOString() },
      { merge: true }
    );
    await batch.commit();

    // The app acknowledges only on this response — see the note at the top.
    return NextResponse.json({ ok: true, accessState: applied.accessState });
  } catch (err) {
    console.error("play billing sync failed:", err);
    reportError(err, { route: "billing/play", stage: "sync" });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
