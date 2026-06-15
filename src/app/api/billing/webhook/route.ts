import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { applyBillingEvent, type BillingEvent } from "@/lib/billing";
import { getStripe, stripeSubToBillingEvent } from "@/lib/stripe";

export const runtime = "nodejs";

// Stripe billing webhook. Verifies the signature against STRIPE_WEBHOOK_SECRET,
// translates the relevant events into a normalized BillingEvent, then runs the
// provider-agnostic state machine (applyBillingEvent) to update the subscription
// and mirror the household's access state in one batch.
//
// Source of truth = customer.subscription.* events. checkout.session.completed
// handles the very first activation; invoice.* events are acked as no-ops (the
// subscription.updated they trigger carries the status change).
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "missing_signature" }, { status: 400 });

  // Raw body is required for signature verification — do NOT parse as JSON first.
  const raw = await req.text();
  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error("stripe signature verification failed:", err);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  try {
    let billingEvent: BillingEvent | null = null;

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subId =
          typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          billingEvent = stripeSubToBillingEvent(sub, {
            userId: session.metadata?.userId,
            householdId: session.metadata?.householdId,
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        billingEvent = stripeSubToBillingEvent(sub);
        break;
      }

      default:
        // Acknowledge everything else (incl. invoice.*) so Stripe stops retrying.
        return NextResponse.json({ received: true });
    }

    if (!billingEvent) {
      // Couldn't resolve our userId/householdId — ack so Stripe doesn't retry,
      // but log it: it means metadata wasn't stamped (investigate the source).
      console.error("billing webhook: unresolved event", event.type, event.id);
      return NextResponse.json({ received: true, unresolved: true });
    }

    const db = getAdminDb();
    const subRef = db.collection("subscriptions").doc(billingEvent.userId);
    const subSnap = await subRef.get();
    const current = subSnap.exists
      ? (subSnap.data() as { hasUsedTrial?: boolean; lapsedAt?: string })
      : null;

    const applied = applyBillingEvent(current, billingEvent);

    // Firestore rejects undefined; strip it. lapsedAt === null means "clear".
    const subData: Record<string, unknown> = {
      userId: billingEvent.userId,
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
    // Mirror the access state onto the household so rules/UI gate with one read.
    batch.set(
      db.collection("households").doc(billingEvent.householdId),
      { accessState: applied.accessState, stateChangedAt: new Date().toISOString() },
      { merge: true }
    );
    await batch.commit();

    return NextResponse.json({ received: true, accessState: applied.accessState });
  } catch (err) {
    console.error("billing webhook error:", err);
    return NextResponse.json({ error: "webhook_failed" }, { status: 500 });
  }
}
