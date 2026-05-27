import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { applyBillingEvent, type BillingEvent } from "@/lib/billing";

export const runtime = "nodejs";

// Provider-agnostic billing webhook. When a provider is chosen (Task 11), a
// provider adapter must (a) verify the provider's signature and (b) translate the
// raw event into a normalized BillingEvent. Until then this accepts a normalized
// payload guarded by a shared secret, so the subscription state machine and the
// mirrored household access state are fully testable now.
//
// TODO(provider): replace the shared-secret check with real provider signature
// verification, and parse the raw provider event into a BillingEvent.
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.BILLING_WEBHOOK_SECRET;
    if (!secret || req.headers.get("x-billing-secret") !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const event = (await req.json()) as Partial<BillingEvent>;
    if (!event.userId || !event.householdId || !event.status || !event.provider) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    const db = getAdminDb();
    const subRef = db.collection("subscriptions").doc(event.userId);
    const subSnap = await subRef.get();
    const current = subSnap.exists
      ? (subSnap.data() as { hasUsedTrial?: boolean; lapsedAt?: string })
      : null;

    const applied = applyBillingEvent(current, event as BillingEvent);

    // Firestore rejects undefined; strip it. lapsedAt === null means "clear the field".
    const subData: Record<string, unknown> = {
      ...applied.subscription,
      updatedAt: new Date().toISOString(),
    };
    for (const k of Object.keys(subData)) {
      if (subData[k] === undefined) delete subData[k];
    }
    subData.lapsedAt =
      applied.subscription.lapsedAt === null ? FieldValue.delete() : applied.subscription.lapsedAt;

    const batch = db.batch();
    batch.set(subRef, subData, { merge: true });
    // Mirror the access state onto the household so rules/UI can gate with one read.
    batch.set(
      db.collection("households").doc(event.householdId),
      { accessState: applied.accessState, stateChangedAt: new Date().toISOString() },
      { merge: true }
    );
    await batch.commit();

    return NextResponse.json({ ok: true, accessState: applied.accessState });
  } catch (err) {
    console.error("billing webhook error:", err);
    return NextResponse.json({ error: "webhook_failed" }, { status: 500 });
  }
}
