// Server-only Stripe client. Instantiated lazily so a missing key fails at the
// call site (with a clear error) rather than at module load — keeps the rest of
// the app booting in environments where billing isn't configured yet.
import Stripe from "stripe";
import type { SubscriptionStatus } from "./types";
import type { BillingEvent } from "./billing";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  // No apiVersion pin → use the account's default version, avoiding type drift.
  _stripe = new Stripe(key);
  return _stripe;
}

// Price IDs for the two plans, configured in the Stripe Dashboard.
export const STRIPE_PRICES = {
  get monthly() {
    return process.env.STRIPE_PRICE_MONTHLY ?? "";
  },
  get annual() {
    return process.env.STRIPE_PRICE_ANNUAL ?? "";
  },
};

export const TRIAL_PERIOD_DAYS = 14;

// Map a Stripe subscription status to our internal status (which drives the
// lapse ladder via isUnpaidStatus / applyBillingEvent).
function mapStripeStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  switch (s) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
    case "paused":
      return "past_due";
    case "incomplete":
      return "incomplete";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "incomplete";
  }
}

function isoFromUnix(seconds: number | null | undefined): string | undefined {
  return seconds ? new Date(seconds * 1000).toISOString() : undefined;
}

// Translate a Stripe Subscription into our normalized BillingEvent. userId +
// householdId come from the subscription metadata (stamped at checkout); a
// fallback object (e.g. the checkout session's metadata) covers older or
// partially-set subscriptions. Returns null if neither id can be resolved.
export function stripeSubToBillingEvent(
  sub: Stripe.Subscription,
  fallbackMeta?: { userId?: string | null; householdId?: string | null }
): BillingEvent | null {
  const userId = sub.metadata?.userId || fallbackMeta?.userId || "";
  const householdId = sub.metadata?.householdId || fallbackMeta?.householdId || "";
  if (!userId || !householdId) return null;

  const priceId = sub.items.data[0]?.price?.id;
  const plan: "monthly" | "annual" | null =
    priceId === STRIPE_PRICES.annual ? "annual" : priceId === STRIPE_PRICES.monthly ? "monthly" : null;

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

  return {
    userId,
    householdId,
    provider: "stripe",
    providerCustomerId: customerId,
    providerSubscriptionId: sub.id,
    status: mapStripeStatus(sub.status),
    plan,
    trialEndsAt: isoFromUnix(sub.trial_end),
    currentPeriodEnd: isoFromUnix(
      // current_period_end moved onto items in recent API versions; fall back
      // to the subscription-level field for older versions.
      sub.items.data[0]?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end
    ),
  };
}
