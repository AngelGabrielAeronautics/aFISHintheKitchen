import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { getStripe, STRIPE_PRICES, TRIAL_PERIOD_DAYS } from "@/lib/stripe";

export const runtime = "nodejs";

// Starts a Stripe Checkout Session for an owner to subscribe (with the 14-day,
// card-up-front trial). Auth-required; the caller must own the household the
// subscription pays for. userId + householdId are stamped on BOTH the Stripe
// customer and the subscription so every webhook event can resolve them.
export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    let uid: string;
    let email: string;
    try {
      const decoded = await getAdminAuth().verifyIdToken(token);
      uid = decoded.uid;
      email = (decoded.email ?? "").toLowerCase().trim();
    } catch {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }

    const body = (await req.json()) as {
      plan?: "monthly" | "annual";
      householdId?: string;
      successUrl?: string;
      cancelUrl?: string;
    };
    const plan = body.plan === "annual" ? "annual" : "monthly";
    const householdId = body.householdId?.trim();
    const successUrl = body.successUrl?.trim();
    const cancelUrl = body.cancelUrl?.trim();
    if (!householdId || !successUrl || !cancelUrl) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    const priceId = plan === "annual" ? STRIPE_PRICES.annual : STRIPE_PRICES.monthly;
    if (!priceId) return NextResponse.json({ error: "price_not_configured" }, { status: 500 });

    const db = getAdminDb();

    // Caller must own the household this subscription will pay for.
    const hhSnap = await db.collection("households").doc(householdId).get();
    if (!hhSnap.exists) return NextResponse.json({ error: "household_not_found" }, { status: 404 });
    if (hhSnap.data()!.ownerId !== uid) {
      return NextResponse.json({ error: "not_owner" }, { status: 403 });
    }

    const stripe = getStripe();

    // Reuse an existing Stripe customer if we have one; otherwise create one and
    // persist its id. Metadata lets webhook events map back to our records.
    const subRef = db.collection("subscriptions").doc(uid);
    const subSnap = await subRef.get();
    const sub = subSnap.exists ? subSnap.data()! : null;
    let customerId: string | undefined = sub?.providerCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email || undefined,
        metadata: { userId: uid, householdId },
      });
      customerId = customer.id;
      await subRef.set(
        { userId: uid, householdId, provider: "stripe", providerCustomerId: customerId },
        { merge: true }
      );
    }

    // One trial per user, ever. If they've already had one, skip the trial.
    const eligibleForTrial = !(sub?.hasUsedTrial === true);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        ...(eligibleForTrial ? { trial_period_days: TRIAL_PERIOD_DAYS } : {}),
        metadata: { userId: uid, householdId },
      },
      // Card up front even during the trial, per the agreed model.
      payment_method_collection: "always",
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: uid,
      metadata: { userId: uid, householdId },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (err) {
    console.error("checkout error:", err);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
