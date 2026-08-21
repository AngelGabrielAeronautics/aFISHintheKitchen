/**
 * The business console's numbers: money, gifts, reach and job health.
 *
 * Separate from /api/admin/overview, which is the per-cookbook table and its
 * actions. This route answers "how is the business doing?" rather than "what
 * is this household's state?".
 *
 * ⚠ Reach is READ here, never refreshed — pulling Apple and Play on a page
 * load would make the console slow and hammer both APIs. The nightly cron
 * writes it; this shows what it wrote, with its own timestamp so a stale
 * figure is visible as stale rather than passing for current.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifySuperAdmin } from "@/lib/admin-auth";
import { getReachStats } from "@/lib/reach";
import { readHeartbeats } from "@/lib/heartbeat";
import { summariseAiUsage } from "@/lib/ai-usage";
import { PLAN_PRICES } from "@/lib/prices";
import { classifyFunding } from "@/lib/funding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await verifySuperAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = getAdminDb();
  const [householdsSnap, subsSnap, giftsSnap, reach, jobs, ai] = await Promise.all([
    // ⚠ Money is counted per COOKBOOK, not per subscription document, because
    // the table underneath the panel is a list of cookbooks. Counting subs here
    // and households there is what let the panel say "Comped 2" while no row
    // could be identified as one of them.
    db.collection("households").get(),
    db.collection("subscriptions").get(),
    db.collection("gifts").get(),
    getReachStats(),
    readHeartbeats(),
    // ⚠ Tolerated: usage logging only started on 2026-08-13, so this is empty
    // until the routes have run. An empty panel is correct, not an error.
    summariseAiUsage(30).catch(() => null),
  ]);

  // ── Money ────────────────────────────────────────────────────────────────
  // One cookbook, one bucket — classifyFunding decides, and the table's rows
  // carry the very same label, so "Comped 2" can be clicked and the two rows
  // it means will be the two rows shown. Nothing is derived by subtracting one
  // overlapping count from another; that is how "Paying" used to be computed
  // and it double-subtracted anything both comped and gifted.
  const subsByOwner = new Map<string, FirebaseFirestore.DocumentData>();
  subsSnap.docs.forEach((d) => subsByOwner.set(d.id, d.data()));

  const money = {
    /** Keyed by Funding — the panel reads these in FUNDING_ORDER. */
    byFunding: {} as Record<string, number>,
    /** Plans of the PAYING cookbooks only. A comped year has no plan, and
     *  counting it as "unknown" made the footer read "2 annual · 2 unknown"
     *  about four cookbooks the reader could not identify. */
    byPlan: {} as Record<string, number>,
    byProvider: {} as Record<string, number>,
    /** Trials ending within 7 days — the ones worth a nudge. */
    trialsEndingSoon: 0,
  };
  const soon = Date.now() + 7 * 86_400_000;
  householdsSnap.docs.forEach((d) => {
    const h = d.data();
    const sub = subsByOwner.get(String(h.ownerId ?? ""));
    const funding = classifyFunding(sub, d.id);
    money.byFunding[funding] = (money.byFunding[funding] ?? 0) + 1;

    if (funding === "paying") {
      const plan = sub?.plan ? String(sub.plan) : "no plan recorded";
      money.byPlan[plan] = (money.byPlan[plan] ?? 0) + 1;
      const provider = String(sub?.provider ?? "none");
      money.byProvider[provider] = (money.byProvider[provider] ?? 0) + 1;
    }
    if (funding === "trialing") {
      const ends = Date.parse(String(sub?.trialEndsAt ?? ""));
      if (Number.isFinite(ends) && ends <= soon) money.trialsEndingSoon++;
    }
  });

  // ── Gifts ────────────────────────────────────────────────────────────────
  // ⚠ "unclaimed" is the number that needs a human: somebody paid and the
  // recipient never redeemed. Nothing else in the product surfaces it.
  const gifts = {
    bought: giftsSnap.size,
    redeemed: 0,
    unredeemed: 0,
    revoked: 0,
    withCookbook: 0,
    /** Sent more than 14 days ago and still unclaimed. */
    staleUnclaimed: 0,
  };
  const staleBefore = Date.now() - 14 * 86_400_000;
  giftsSnap.docs.forEach((d) => {
    const g = d.data();
    const status = String(g.status ?? "unredeemed");
    if (status === "redeemed") gifts.redeemed++;
    else if (status === "revoked") gifts.revoked++;
    else {
      gifts.unredeemed++;
      const sent = Date.parse(String(g.sentAt ?? g.createdAt ?? ""));
      if (Number.isFinite(sent) && sent < staleBefore) gifts.staleUnclaimed++;
    }
    if (g.includeCookbook === true) gifts.withCookbook++;
  });

  return NextResponse.json({
    money,
    gifts,
    // ⚠ NO GROSS FIGURE. Gifts sell in five currencies and the gift document
    // does not record which one was charged, so any single total would be a
    // guess dressed as revenue. The count is honest; the money lives in App
    // Store Connect and Play Console.
    giftPrice: PLAN_PRICES.GBP.gift,
    reach,
    jobs,
    ai,
  });
}
