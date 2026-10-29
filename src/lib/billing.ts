// Provider-agnostic billing state machine. No Firebase, no provider SDK — a
// provider adapter (Stripe/Paddle, added at the billing milestone) translates a
// raw webhook into a normalized BillingEvent, and this computes the resulting
// subscription fields + the household's mirrored access state.

import type { SubscriptionStatus, HouseholdAccessState } from "./types";
import { computeAccessStateFromLapse } from "./access";

export interface BillingEvent {
  userId: string; // resolved from the provider customer (e.g. checkout metadata)
  householdId: string; // the one book this subscription pays for
  provider: "stripe" | "paddle" | "appstore" | "play";
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  status: SubscriptionStatus;
  plan: "monthly" | "annual" | null;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
}

// Statuses where the subscription is NOT in good standing → drives the lapse ladder.
export function isUnpaidStatus(status: SubscriptionStatus): boolean {
  return status === "past_due" || status === "canceled" || status === "incomplete";
}

export interface AppliedBilling {
  subscription: {
    householdId: string;
    provider: "stripe" | "paddle" | "appstore" | "play";
    providerCustomerId?: string;
    providerSubscriptionId?: string;
    status: SubscriptionStatus;
    plan: "monthly" | "annual" | null;
    trialEndsAt?: string;
    currentPeriodEnd?: string;
    hasUsedTrial: boolean;
    lapsedAt: string | null; // null → clear the field
  };
  accessState: HouseholdAccessState;
}

/**
 * Given the current subscription (if any) and an incoming event, compute the new
 * subscription fields and the household's mirrored access state. Pure & testable.
 */
/**
 * True while something WE granted outranks the store on this subscription doc:
 * a comp (free, open-ended), a redeemed gift year, or an admin-extended trial,
 * still inside its end date.
 *
 * ⚠ Audit F11 (2026-10-29). The store notification handlers find the doc by
 * providerSubscriptionId, which gift redemption, comp and extend_trial all
 * leave in place, and applyBillingEvent then overwrote provider/status. A
 * subscriber in billing retry who redeemed a gift lost it either way: an
 * EXPIRED notification walked the book to read-only while it held a paid year,
 * or a DID_RENEW flipped provider back to the store and the gift vanished.
 * While a grant is live, store notifications are ignored; once it ends they
 * apply again. A real purchase still arrives through /api/billing/appstore or
 * /api/billing/play, which is unaffected.
 */
export function grantOverridesStore(
  sub: { provider?: string; comped?: boolean; trialGrantedAt?: string; trialEndsAt?: string; currentPeriodEnd?: string } | undefined,
  now: number = Date.now(),
): boolean {
  if (!sub) return false;
  if (sub.comped === true) return true;
  const until = (iso?: string) => (iso ? Date.parse(iso) || 0 : 0);
  if (sub.provider === "gift" && until(sub.currentPeriodEnd) > now) return true;
  if (sub.trialGrantedAt && until(sub.trialEndsAt) > now) return true;
  return false;
}

export function applyBillingEvent(
  current: { hasUsedTrial?: boolean; lapsedAt?: string } | null,
  event: BillingEvent,
  now: Date = new Date()
): AppliedBilling {
  const unpaid = isUnpaidStatus(event.status);

  // lapsedAt is stamped when first entering an unpaid state and preserved while
  // unpaid (so the ladder counts from the original lapse); cleared on recovery.
  const lapsedAt: string | null = unpaid ? (current?.lapsedAt ?? now.toISOString()) : null;

  // Once a trial has been seen it can never be granted again.
  const hasUsedTrial =
    (current?.hasUsedTrial ?? false) || event.status === "trialing" || Boolean(event.trialEndsAt);

  const accessState = computeAccessStateFromLapse(lapsedAt ?? undefined, now).accessState;

  return {
    subscription: {
      householdId: event.householdId,
      provider: event.provider,
      providerCustomerId: event.providerCustomerId,
      providerSubscriptionId: event.providerSubscriptionId,
      status: event.status,
      plan: event.plan,
      trialEndsAt: event.trialEndsAt,
      currentPeriodEnd: event.currentPeriodEnd,
      hasUsedTrial,
      lapsedAt,
    },
    accessState,
  };
}
