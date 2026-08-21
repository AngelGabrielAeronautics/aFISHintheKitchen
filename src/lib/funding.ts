/**
 * How a cookbook is being paid for — ONE label per cookbook, decided in one
 * place.
 *
 * ⚠ THIS EXISTS BECAUSE THE CONSOLE COULD NOT ANSWER ITS OWN QUESTION. The
 * Money panel said "Comped 2" and the table below it said "active" on four
 * different rows, because a comped year, a gifted year and a real store
 * subscription all carry `status: "active"`. The panel and the table were also
 * counting DIFFERENT THINGS in different files — the panel derived "paying" by
 * subtracting two overlapping sets (`active - gifted - comped`, which
 * double-subtracts anything that is both and can go negative), while the table
 * printed the raw status.
 *
 * Every bucket below is MUTUALLY EXCLUSIVE and every cookbook lands in exactly
 * one, so the panel's counts are literally "the rows carrying this label" and
 * clicking one can filter the table honestly.
 */

export type Funding =
  | "paying"
  | "gifted"
  | "comped"
  | "trialing"
  | "lapsed"
  | "canceled"
  | "uncovered"
  | "none";

/** Only the fields that decide funding. Deliberately loose: this reads raw
 *  Firestore documents from two routes, where older records may be missing
 *  anything. */
export interface FundingInput {
  status?: unknown;
  provider?: unknown;
  comped?: unknown;
  householdId?: unknown;
  lapsedAt?: unknown;
}

/**
 * @param sub the owner's subscription document, or undefined if they have none
 * @param householdId the cookbook being classified — a subscription pays for
 *        exactly ONE owned cookbook, so an owner's second cookbook is not
 *        covered by it
 */
export function classifyFunding(sub: FundingInput | undefined, householdId: string): Funding {
  if (!sub) return "none";

  const status = String(sub.status ?? "none");
  const provider = String(sub.provider ?? "none");

  // ⚠ A subscription names the one cookbook it pays for. If it names a
  // DIFFERENT one, this cookbook is riding on nothing — surfacing that beats
  // showing the other book's "active" against it. Older records may not carry
  // householdId at all; those fall through and are treated as covering, which
  // is the behaviour the console has always had.
  if (sub.householdId && String(sub.householdId) !== householdId) return "uncovered";

  // Comped first: free access granted by us, never billed, never lapses. It
  // wins over status because the comp action writes status "active" — a comped
  // book that showed as "paying" was the original complaint.
  if (sub.comped === true) return "comped";

  // A gift is PAID (someone really bought a year) but it is NOT RENEWING, so it
  // can never be counted as recurring revenue. See the note on Subscription
  // .provider in types.ts.
  if (status === "active" && provider === "gift") return "gifted";
  if (status === "active") return "paying";
  if (status === "trialing") return "trialing";

  // lapsedAt outranks "canceled": the sweep marks an expired trial canceled AND
  // stamps lapsedAt, and what matters about that book is that it is walking the
  // ladder towards deletion, not the word in its status field.
  if (sub.lapsedAt) return "lapsed";
  if (status === "canceled") return "canceled";
  return "none";
}

/** The words used in the Money panel, the table badge and the key — one
 *  source, so the three can never drift apart. */
export const FUNDING_LABELS: Record<Funding, string> = {
  paying: "Paying",
  gifted: "On a gifted year",
  comped: "Comped",
  trialing: "In trial",
  lapsed: "Lapsed",
  canceled: "Cancelled",
  uncovered: "Not covered",
  none: "No subscription",
};

/** What each label means, in terms of money rather than database state. */
export const FUNDING_MEANING: Record<Funding, string> = {
  paying: "A real store subscription is billing them. This is the revenue line.",
  gifted: "Someone bought them a year. Already paid for, and it will NOT renew.",
  comped: "Free access we granted. Never billed, never lapses.",
  trialing: "Inside the 14-day free trial. Nothing has been charged yet.",
  lapsed: "Payment ended and the ladder has started: full access 7 days, then read-only, then suspended.",
  canceled: "Cancelled but still inside the period they paid for.",
  uncovered: "The owner has a subscription, but it pays for a different cookbook of theirs.",
  none: "No subscription record at all.",
};

/** Panel order, which is also the order a person reads them in: money first,
 *  problems last. */
export const FUNDING_ORDER: Funding[] = [
  "paying",
  "gifted",
  "comped",
  "trialing",
  "lapsed",
  "canceled",
  "uncovered",
  "none",
];
