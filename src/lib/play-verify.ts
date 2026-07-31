import { GoogleAuth } from "google-auth-library";

// Verify a Google Play subscription purchase server-side.
//
// The Android counterpart to appstore-verify.ts, and the same principle: the
// client sends a purchase TOKEN, never a claim about what it bought. Everything
// the billing state machine acts on is read back from Google, so a tampered or
// replayed client payload cannot activate a subscription.
//
// Apple and Google differ in how that verification works, which is why this
// isn't a copy of the Apple file:
//
//   - Apple signs the transaction itself (JWS), so verification is offline
//     against Apple's certificate chain.
//   - Google does not sign anything the app can forward. The token is an opaque
//     handle that only means something when exchanged with the Play Developer
//     API over an authenticated server-to-server call.
//
// ⚠ That makes this a NETWORK dependency on the purchase path. It needs
// credentials (below) and it can fail transiently — callers must treat a
// verification error as "unknown, retry", never as "not subscribed", or a
// Google outage would revoke access for paying customers.

const PACKAGE_NAME = "angelgabriel.afishinthekitchen";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

/**
 * The service account that may call the Play Developer API.
 *
 * ⚠ This is NOT the Firebase service account. It is a separate one that must be
 * granted access in **Play Console → Setup → API access**, with permission to
 * view financial data / manage orders for this app. Firebase's credentials have
 * no Play Developer API rights, and using them yields a 401 that reads like a
 * bad token rather than a missing grant.
 *
 * Falls back to FIREBASE_SERVICE_ACCOUNT_B64 only so local development fails
 * with Google's own "insufficient permissions" rather than a confusing
 * "credentials missing".
 */
function serviceAccount(): Record<string, unknown> {
  const b64 =
    process.env.PLAY_SERVICE_ACCOUNT_B64 ?? process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) throw new Error("PLAY_SERVICE_ACCOUNT_B64 is not set");
  return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
}

let _auth: GoogleAuth | null = null;
function auth(): GoogleAuth {
  if (!_auth) {
    _auth = new GoogleAuth({ credentials: serviceAccount() as never, scopes: [SCOPE] });
  }
  return _auth;
}

/** The subset of SubscriptionPurchaseV2 this app acts on. */
export interface PlaySubscription {
  /** LINKED_PURCHASE_TOKEN chains resolve to one stable id across renewals. */
  subscriptionId: string;
  productId: string | null;
  /** ISO-8601, or null for a state with no expiry (e.g. pending). */
  expiryTime: string | null;
  /** Google's own enum, e.g. SUBSCRIPTION_STATE_ACTIVE. */
  state: string;
  /** True while the user is inside a free-trial line item. */
  isTrial: boolean;
  /** Set by the app at purchase; binds the purchase to a Firebase uid. */
  obfuscatedAccountId: string | null;
  /** Google auto-REFUNDS a subscription that is never acknowledged. */
  acknowledged: boolean;
}

/**
 * Read a purchase back from Google.
 *
 * Uses `subscriptionsv2`, not the deprecated v1 `purchases.subscriptions`: v2 is
 * the one that reports `subscriptionState` directly rather than making callers
 * infer it from timestamps and a `paymentState` integer, and it is the only one
 * that models multi-line-item subscriptions.
 *
 * @throws on network failure, bad credentials, or an unknown token. Never
 *   returns a "not subscribed" shape for an error — see the note at the top.
 */
export async function verifyPlayPurchase(purchaseToken: string): Promise<PlaySubscription> {
  const client = await auth().getClient();
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
    `${PACKAGE_NAME}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;

  const res = await client.request<{
    subscriptionState?: string;
    latestOrderId?: string;
    linkedPurchaseToken?: string;
    acknowledgementState?: string;
    externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
    lineItems?: {
      productId?: string;
      expiryTime?: string;
      offerDetails?: { basePlanId?: string; offerId?: string };
      autoRenewingPlan?: unknown;
    }[];
  }>({ url, method: "GET" });

  const d = res.data;
  const line = d.lineItems?.[0];

  return {
    // latestOrderId is stable per subscription; the token itself rotates on
    // renewal, so it must NOT be used as the subscription identity.
    subscriptionId: (d.latestOrderId ?? purchaseToken).split("..")[0],
    productId: line?.productId ?? null,
    expiryTime: line?.expiryTime ?? null,
    state: d.subscriptionState ?? "SUBSCRIPTION_STATE_UNSPECIFIED",
    // A free trial is an OFFER on the line item, not a separate state — Google
    // reports a trialling subscription as ACTIVE, so reading state alone would
    // bill-flag a trial as a paying customer.
    isTrial: Boolean(line?.offerDetails?.offerId),
    obfuscatedAccountId: d.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null,
    acknowledged: d.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
  };
}

/**
 * The obfuscated account id the app must attach at purchase, derived from the
 * Firebase uid.
 *
 * Mirrors StoreKitManager.appAccountToken on iOS so both stores bind a purchase
 * to an account the same way. Google caps this field at 64 characters and wants
 * it non-identifying, so a hash is both required and correct.
 *
 * ⚠ The Android client must derive this identically (see BillingManager) or
 * every purchase will be rejected as belonging to someone else.
 */
export async function obfuscatedAccountIdForUid(uid: string): Promise<string> {
  const data = new TextEncoder().encode(uid);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 64);
}

/** Google's states that mean "this person may use the app". */
export function isEntitled(state: string): boolean {
  return (
    state === "SUBSCRIPTION_STATE_ACTIVE" ||
    state === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD" ||
    // Cancelled but not yet expired: they paid for the rest of the period.
    state === "SUBSCRIPTION_STATE_CANCELED"
  );
}

/**
 * Translate Google's subscription state into our own status.
 *
 * Shared by both Play routes on purpose — the purchase path and the
 * notification path must never disagree about what a state means, or a
 * subscription's status would flip depending on which one wrote last.
 *
 * ⚠ `SUBSCRIPTION_STATE_CANCELED` does **not** mean "canceled" in our sense. It
 * means auto-renew is switched off while the period they already paid for keeps
 * running. Mapping it to our `canceled` would start the lapse ladder on someone
 * who is still fully paid up — cutting off a customer weeks early, right after
 * they cancelled, which is exactly when they'd never come back.
 *
 * Grace period and account hold map to `past_due` so they get the same lapse
 * ladder as a failed card on iOS, rather than being cut off the instant a
 * payment bounces.
 */
export function statusForState(
  state: string,
  isTrial: boolean
): "trialing" | "active" | "past_due" | "canceled" | "incomplete" {
  switch (state) {
    case "SUBSCRIPTION_STATE_ACTIVE":
    case "SUBSCRIPTION_STATE_CANCELED":
      return isTrial ? "trialing" : "active";
    case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
    case "SUBSCRIPTION_STATE_ON_HOLD":
      return "past_due";
    // Payment hasn't cleared yet — no access, but nothing has gone wrong.
    case "SUBSCRIPTION_STATE_PENDING":
      return "incomplete";
    default:
      // EXPIRED, PAUSED, PENDING_PURCHASE_CANCELED, UNSPECIFIED.
      return "canceled";
  }
}
