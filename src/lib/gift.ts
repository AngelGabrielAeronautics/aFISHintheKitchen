// Gifting — buy a year of A Fish in the Kitchen for someone else.
//
// ⚠⚠ READ THIS BEFORE TOUCHING ANYTHING HERE. A GIFT IS NOT AN INVITE.
//
// The app already has a flow that lets you bring somebody into YOUR cookbook:
// invites. It is right next door, it shares vocabulary, and it is the wrong
// answer here. A gift means:
//
//   • The recipient gets THEIR OWN cookbook, which they own outright.
//   • They get their own five seats, to invite their own family into it.
//   • The giver gets no access to it, no membership, no visibility — nothing.
//     They paid; that is the whole of their relationship to the book.
//   • The giver does not need a cookbook of their own, and if they have one it
//     is untouched. A gift never consumes one of the giver's seats.
//
// Dylan was explicit about this (2026-08-13), and the real customer email that
// prompted the feature had already worked around its absence three different
// ways. If a future change makes a gift add someone to the giver's household,
// it has broken the feature entirely, not tweaked it.
//
// ── Why it is a separate IAP product rather than a gifted subscription ──
//
// StoreKit has no API to buy an auto-renewing subscription on behalf of another
// account, so a gift cannot be an Apple subscription. It is a one-off product,
// and redeeming it grants a fixed period server-side.
//
// This is also what App Review requires. Guideline 3.1.1, verbatim:
//   "Digital gift cards, certificates, vouchers, and coupons which can be
//    redeemed for digital goods or services can only be sold in your app using
//    in-app purchase."
// So the gift is sold through IAP on both stores. Selling it on the website was
// never an option anyway — Stripe is blocked for Jersey, which is the reason
// billing went native in the first place.
//
// ── Why a redeemed gift looks like a long trial ──
//
// A store subscription tells us when it ends, via ASSN or RTDN. A gift has no
// such notifier — nobody is billed at the end of it. The signup trial has
// exactly the same problem and already solves it: the nightly lapse-sweep
// expires it by the clock and hands the household to the ordinary lapse ladder.
// A gift rides that same machinery rather than inventing a second expiry path.

import type { Subscription } from "./types";

/** How long a gift buys. One product, one duration — see project memory. */
export const GIFT_DAYS = 365;

/** The IAP product id, identical on both stores so the server needn't branch. */
export const GIFT_PRODUCT_ID = "gift_year";

// Unambiguous alphabet: no O/0, I/1/L, U/V, S/5, Z/2. A gift code gets read off
// a phone screen, written on a card, and typed by somebody who did not choose
// it — every removed character is a support email that never happens.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRTWXY3467689";
const CODE_LENGTH = 8;

/**
 * A human-transcribable gift code, formatted in two groups (`AFK-XXXX-XXXX`
 * without the prefix — the prefix is added for display only).
 *
 * ⚠ Uses crypto randomness, not Math.random. These are bearer tokens: anyone
 * holding a valid code can claim a year, so a guessable sequence is a way to
 * mint free subscriptions.
 */
export function generateGiftCode(random: (n: number) => Uint8Array): string {
  const bytes = random(CODE_LENGTH);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

/** Display form. Storage and lookup always use the bare, upper-cased code. */
export function formatGiftCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * Normalise anything a person might type or paste: lower case, the display
 * hyphen, stray spaces, and a pasted `.../g/CODE` URL.
 */
export function normaliseGiftCode(input: string): string {
  const fromUrl = input.trim().replace(/^.*\/g\//i, "");
  return fromUrl.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export type GiftStatus = "unredeemed" | "redeemed" | "revoked";

export interface Gift {
  code: string; // doc id, bare and upper-case
  productId: string;
  days: number;
  platform: "appstore" | "play";
  /**
   * ⚠ The store transaction, and the reason a gift can't be duplicated. Both
   * stores can deliver the same purchase more than once (a retried finish, a
   * restored transaction, a notification replayed). Keyed on this, a repeat
   * returns the gift that already exists instead of minting a second year.
   */
  transactionId: string;
  purchasedByUid: string;
  purchasedByName: string;
  recipientName: string;
  recipientEmail: string;
  message: string;
  /** ISO date the card should be delivered — the cron sends it on or after. */
  sendOn: string;
  /** null until delivered — see the sweep's query. Never omit it. */
  sentAt: string | null;
  createdAt: string;
  status: GiftStatus;
  redeemedByUid?: string;
  redeemedAt?: string;
  /** Stamped at redemption: when the granted year runs out. */
  expiresAt?: string;
  revokedAt?: string;
}

export type RedeemRefusal =
  | "not_found"
  | "already_redeemed"
  | "revoked"
  | "own_gift"
  | "already_subscribed";

/**
 * May this user redeem this gift, and if so when should the year start?
 *
 * Pure so the awkward cases are testable without Firestore. The awkward cases
 * are the whole point:
 *
 * ⚠ **A trial in progress is not wasted.** The year starts at the END of the
 * trial, not at redemption. Someone who signed up yesterday and is given a gift
 * today would otherwise silently lose thirteen days they were promised. It
 * costs nothing to be generous here and it removes a whole class of complaint.
 *
 * ⚠ **Somebody already paying is REFUSED, not overwritten.** Granting a gift
 * year on top of a live store subscription would leave them paying Apple every
 * month for something they already have, and we cannot cancel an Apple
 * subscription for them. Refusing keeps the code valid so they can redeem it
 * when their own subscription ends — the gift is banked, not burned.
 *
 * ⚠ **You cannot redeem your own gift.** Not fraud prevention — the store
 * already took the money. It is that doing so is always a mistake, and a
 * refusal that says so is kinder than a year silently landing on the wrong
 * account.
 */
export function canRedeem(params: {
  gift: Pick<Gift, "status" | "purchasedByUid">;
  redeemerUid: string;
  existing: Pick<Subscription, "provider" | "status" | "trialEndsAt" | "currentPeriodEnd"> | null;
  now?: Date;
}): { ok: true; startsAt: Date } | { ok: false; reason: RedeemRefusal } {
  const { gift, redeemerUid, existing } = params;
  const now = params.now ?? new Date();

  if (gift.status === "revoked") return { ok: false, reason: "revoked" };
  if (gift.status === "redeemed") return { ok: false, reason: "already_redeemed" };
  if (gift.purchasedByUid === redeemerUid) return { ok: false, reason: "own_gift" };

  // A live STORE subscription blocks; a gift or the signup trial does not.
  //
  // ⚠ FAIL CLOSED — an ALLOW-list of what may be replaced, not a block-list of
  // what may not. The first version of this listed the blocking providers and
  // omitted "play", which meant an Android subscriber could redeem a gift on
  // top of a live Google subscription: their subscription doc would be
  // overwritten with provider "gift" while Google carried on billing them, and
  // we would have lost the record that a Play subscription existed at all.
  // (Found by Dylan asking whether gifting works across platforms — the guard
  // protected iOS subscribers and not Android ones, which is exactly the
  // asymmetry a block-list produces.)
  //
  // Written this way, a provider added in future blocks by default. The failure
  // mode of over-blocking is a support email; the failure mode of
  // under-blocking is charging somebody twice.
  const REPLACEABLE = new Set(["none", "gift"]);
  const live = existing != null && (existing.status === "active" || existing.status === "trialing");
  if (live && !REPLACEABLE.has(existing!.provider ?? "")) {
    return { ok: false, reason: "already_subscribed" };
  }

  // Start at the later of now and whatever they have already been promised —
  // an unexpired trial, or an unexpired gift being topped up.
  let startsAt = now;
  for (const iso of [existing?.trialEndsAt, existing?.currentPeriodEnd]) {
    if (!iso) continue;
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime()) && d > startsAt) startsAt = d;
  }
  return { ok: true, startsAt };
}

/** When a gift redeemed at `startsAt` runs out. */
export function giftExpiryFrom(startsAt: Date, days = GIFT_DAYS): string {
  return new Date(startsAt.getTime() + days * 86_400_000).toISOString();
}
