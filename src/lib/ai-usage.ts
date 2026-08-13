/**
 * What the AI features actually cost.
 *
 * Every paid model call is recorded with its REAL token counts, which the
 * provider returns. Cost is derived from those, never counted as "calls × a
 * guess" — a long recipe import and a two-word tag suggestion are not the same
 * spend, and averaging them would hide exactly the runaway this exists to
 * catch.
 *
 * ⚠ TOKENS ARE THE FACT; MONEY IS AN ESTIMATE. The rates below are a local
 * copy of a published price list and will drift. When they do, the token
 * counts stay true and only [RATES] needs correcting — which is why the
 * console labels the money as an estimate and shows tokens beside it.
 */

import { getAdminDb } from "./firebase-admin";

/**
 * USD per MILLION tokens, per model.
 *
 * ⚠ CHECK AGAINST THE CURRENT PRICE LIST BEFORE TRUSTING A FIGURE. These are
 * not fetched from anywhere — nothing will tell you when they go stale.
 * Unknown models fall back to zero rather than inventing a number, and the
 * console says when it has seen a model it cannot price.
 */
const RATES: Record<string, { in: number; out: number }> = {
  "claude-sonnet-5": { in: 3, out: 15 },
};

export interface AiCall {
  route: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  uid?: string;
  householdId?: string;
  /** ISO day, so a month can be counted without reading every document. */
  day: string;
  at: string;
}

/**
 * Record one model call.
 *
 * ⚠ NEVER THROWS AND IS NEVER AWAITED ON THE CRITICAL PATH. Bookkeeping must
 * not be able to fail a recipe import the user is waiting on, or slow it down.
 */
export function recordAiCall(call: {
  route: string;
  model: string;
  usage?: { input_tokens?: number; output_tokens?: number } | null;
  uid?: string;
  householdId?: string;
}): void {
  const now = new Date();
  const doc: AiCall = {
    route: call.route,
    model: call.model,
    inputTokens: call.usage?.input_tokens ?? 0,
    outputTokens: call.usage?.output_tokens ?? 0,
    ...(call.uid ? { uid: call.uid } : {}),
    ...(call.householdId ? { householdId: call.householdId } : {}),
    day: now.toISOString().slice(0, 10),
    at: now.toISOString(),
  };
  void getAdminDb()
    .collection("aiUsage")
    .add(doc)
    .catch((e) => console.warn("[ai-usage] not recorded", e));
}

export interface AiSummary {
  since: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  /** USD, estimated from [RATES]. */
  estimatedUsd: number;
  byRoute: Record<string, { calls: number; usd: number }>;
  /** Models seen that [RATES] has no price for — their cost reads as 0. */
  unpricedModels: string[];
  /** Heaviest cookbooks, so an abusive or looping account is visible. */
  topHouseholds: { householdId: string; calls: number }[];
}

/**
 * Roll up the last [days] days.
 *
 * ⚠ ONE inequality filter and nothing else — Firestore needs a composite index
 * the moment you combine a range with anything, and an undeclared index throws
 * rather than running slowly. Filtering further is done in code.
 */
export async function summariseAiUsage(days = 30): Promise<AiSummary> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const snap = await getAdminDb().collection("aiUsage").where("day", ">=", since).get();

  const out: AiSummary = {
    since,
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    estimatedUsd: 0,
    byRoute: {},
    unpricedModels: [],
    topHouseholds: [],
  };
  const unpriced = new Set<string>();
  const byHousehold = new Map<string, number>();

  snap.docs.forEach((d) => {
    const c = d.data() as AiCall;
    const rate = RATES[c.model];
    if (!rate) unpriced.add(c.model);
    const usd = rate
      ? (c.inputTokens / 1e6) * rate.in + (c.outputTokens / 1e6) * rate.out
      : 0;

    out.calls++;
    out.inputTokens += c.inputTokens;
    out.outputTokens += c.outputTokens;
    out.estimatedUsd += usd;

    const r = (out.byRoute[c.route] ??= { calls: 0, usd: 0 });
    r.calls++;
    r.usd += usd;

    if (c.householdId) byHousehold.set(c.householdId, (byHousehold.get(c.householdId) ?? 0) + 1);
  });

  out.estimatedUsd = Math.round(out.estimatedUsd * 100) / 100;
  Object.values(out.byRoute).forEach((r) => (r.usd = Math.round(r.usd * 100) / 100));
  out.unpricedModels = [...unpriced];
  out.topHouseholds = [...byHousehold]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([householdId, calls]) => ({ householdId, calls }));
  return out;
}
