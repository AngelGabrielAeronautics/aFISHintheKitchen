import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { applyBillingEvent, type BillingEvent } from "@/lib/billing";

export const runtime = "nodejs";

// Syncs an Apple App Store subscription (StoreKit 2) into Firestore so the
// household's accessState reflects it. The iOS app reports a verified purchase
// here; we run the same provider-agnostic state machine the Stripe webhook used.
// Apple is the merchant of record (this is what unblocks billing for the Jersey
// entity).
//
// ⚠️ PRODUCTION HARDENING REQUIRED: this currently trusts the authenticated
// owner's reported purchase. Before charging real money, verify the signed
// transaction with Apple's App Store Server API (originalTransactionId → Apple),
// and/or move the source of truth to App Store Server Notifications V2. The
// Firebase ID token + owner check limit writes to one's own household, but a
// determined owner could still fake entitlement until this is added.
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

    const body = (await req.json()) as {
      householdId?: string;
      productId?: string;
      plan?: "monthly" | "annual";
      isTrial?: boolean;
      expiresMillis?: number;
      originalTransactionId?: string;
    };
    const householdId = body.householdId?.trim();
    if (!householdId || !body.originalTransactionId) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    const db = getAdminDb();

    // Caller must own the household this subscription pays for.
    const hhRef = db.collection("households").doc(householdId);
    const hhSnap = await hhRef.get();
    if (!hhSnap.exists) return NextResponse.json({ error: "household_not_found" }, { status: 404 });
    if (hhSnap.data()!.ownerId !== uid) {
      return NextResponse.json({ error: "not_owner" }, { status: 403 });
    }

    // Expired → treat as canceled so the lapse ladder takes over.
    const now = Date.now();
    const expired = typeof body.expiresMillis === "number" && body.expiresMillis < now;
    const status = expired ? "canceled" : body.isTrial ? "trialing" : "active";
    const periodEnd = body.expiresMillis ? new Date(body.expiresMillis).toISOString() : undefined;

    const event: BillingEvent = {
      userId: uid,
      householdId,
      provider: "appstore",
      providerSubscriptionId: body.originalTransactionId,
      status,
      plan: body.plan ?? "monthly",
      trialEndsAt: body.isTrial ? periodEnd : undefined,
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
