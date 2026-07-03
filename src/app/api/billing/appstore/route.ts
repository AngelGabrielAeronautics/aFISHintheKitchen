import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { applyBillingEvent, type BillingEvent } from "@/lib/billing";
import { verifyAppStoreTransaction, appAccountTokenForUid } from "@/lib/appstore-verify";

export const runtime = "nodejs";

// Syncs an Apple App Store subscription (StoreKit 2) into Firestore. The iOS app
// sends the SIGNED transaction (JWS); we cryptographically verify it against
// Apple's certificate chain (so a forged/tampered purchase can't pass), then run
// the provider-agnostic state machine. Apple = merchant of record (this is what
// unblocked billing for the Jersey entity).
const MONTHLY_PRODUCT = "angelgabriel.afishinthekitchen.monthly";
const ANNUAL_PRODUCT = "angelgabriel.afishinthekitchen.annual";

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

    const body = (await req.json()) as { householdId?: string; jws?: string };
    const householdId = body.householdId?.trim();
    const jws = body.jws?.trim();
    if (!householdId || !jws) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    // Cryptographically verify the StoreKit transaction with Apple's chain.
    let transaction;
    try {
      transaction = await verifyAppStoreTransaction(jws);
    } catch (err) {
      console.error("appstore: transaction verification failed:", err);
      return NextResponse.json({ error: "invalid_transaction" }, { status: 400 });
    }

    const productId = transaction.productId;
    if (productId !== MONTHLY_PRODUCT && productId !== ANNUAL_PRODUCT) {
      return NextResponse.json({ error: "unknown_product" }, { status: 400 });
    }

    const db = getAdminDb();

    // Bind the transaction to the buyer. Purchases made by this build attach an
    // appAccountToken derived from the Firebase uid — if the token is present it
    // must match the caller, so a shared/replayed JWS can't activate someone
    // else's account. (Older transactions carry no token; the claim check below
    // still covers them.)
    const appAccountToken = (transaction.appAccountToken ?? "").toLowerCase();
    if (appAccountToken && appAccountToken !== appAccountTokenForUid(uid)) {
      console.warn(`appstore: appAccountToken mismatch for uid ${uid}`);
      return NextResponse.json({ error: "wrong_account" }, { status: 403 });
    }

    // One Apple subscription activates ONE account: reject a JWS whose
    // originalTransactionId is already recorded on a different user's
    // subscription doc.
    const originalTransactionId = transaction.originalTransactionId;
    if (originalTransactionId) {
      const claimed = await db
        .collection("subscriptions")
        .where("providerSubscriptionId", "==", originalTransactionId)
        .limit(1)
        .get();
      if (!claimed.empty && claimed.docs[0].id !== uid) {
        console.warn(`appstore: tx ${originalTransactionId} already claimed by another account`);
        return NextResponse.json({ error: "transaction_already_claimed" }, { status: 409 });
      }
    }

    // Caller must own the household this subscription pays for.
    const hhRef = db.collection("households").doc(householdId);
    const hhSnap = await hhRef.get();
    if (!hhSnap.exists) return NextResponse.json({ error: "household_not_found" }, { status: 404 });
    if (hhSnap.data()!.ownerId !== uid) {
      return NextResponse.json({ error: "not_owner" }, { status: 403 });
    }

    // Build the event from VERIFIED fields (not client-claimed).
    const plan: "monthly" | "annual" = productId === ANNUAL_PRODUCT ? "annual" : "monthly";
    const isTrial = transaction.offerType === 1; // 1 = introductory (free trial)
    const expiresMs = transaction.expiresDate;
    const expired = typeof expiresMs === "number" && expiresMs < Date.now();
    const status = expired ? "canceled" : isTrial ? "trialing" : "active";
    const periodEnd = typeof expiresMs === "number" ? new Date(expiresMs).toISOString() : undefined;

    const event: BillingEvent = {
      userId: uid,
      householdId,
      provider: "appstore",
      providerSubscriptionId: transaction.originalTransactionId,
      status,
      plan,
      trialEndsAt: isTrial ? periodEnd : undefined,
      currentPeriodEnd: periodEnd,
    };

    const subRef = db.collection("subscriptions").doc(uid);
    const current = (await subRef.get()).data() as { hasUsedTrial?: boolean; lapsedAt?: string } | undefined;
    const applied = applyBillingEvent(current ?? null, event);

    const subData: Record<string, unknown> = { userId: uid, ...applied.subscription, updatedAt: new Date().toISOString() };
    for (const k of Object.keys(subData)) if (subData[k] === undefined) delete subData[k];
    subData.lapsedAt = applied.subscription.lapsedAt === null ? FieldValue.delete() : applied.subscription.lapsedAt;

    const batch = db.batch();
    batch.set(subRef, subData, { merge: true });
    batch.set(hhRef, { accessState: applied.accessState, stateChangedAt: new Date().toISOString() }, { merge: true });
    await batch.commit();

    return NextResponse.json({ ok: true, accessState: applied.accessState });
  } catch (err) {
    console.error("appstore billing error:", err);
    return NextResponse.json({ error: "appstore_sync_failed" }, { status: 500 });
  }
}
