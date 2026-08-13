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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await verifySuperAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = getAdminDb();
  const [subsSnap, giftsSnap, reach, jobs, ai] = await Promise.all([
    db.collection("subscriptions").get(),
    db.collection("gifts").get(),
    getReachStats(),
    readHeartbeats(),
    // ⚠ Tolerated: usage logging only started on 2026-08-13, so this is empty
    // until the routes have run. An empty panel is correct, not an error.
    summariseAiUsage(30).catch(() => null),
  ]);

  // ── Money ────────────────────────────────────────────────────────────────
  // Counted by PROVIDER as well as status, because the three are genuinely
  // different things: "appstore"/"play" is somebody paying, "gift" is a year
  // already paid for by someone else, and "none" is the signup trial.
  const money = {
    active: 0,
    trialing: 0,
    lapsed: 0,
    canceled: 0,
    comped: 0,
    gifted: 0,
    byPlan: {} as Record<string, number>,
    byProvider: {} as Record<string, number>,
    /** Trials ending within 7 days — the ones worth a nudge. */
    trialsEndingSoon: 0,
  };
  const soon = Date.now() + 7 * 86_400_000;
  subsSnap.docs.forEach((d) => {
    const s = d.data();
    const status = String(s.status ?? "none");
    const provider = String(s.provider ?? "none");
    money.byProvider[provider] = (money.byProvider[provider] ?? 0) + 1;
    if (s.comped === true) money.comped++;
    if (provider === "gift" && status === "active") money.gifted++;
    if (status === "active") {
      money.active++;
      const plan = s.plan ? String(s.plan) : "unknown";
      money.byPlan[plan] = (money.byPlan[plan] ?? 0) + 1;
    } else if (status === "trialing") {
      money.trialing++;
      const ends = Date.parse(String(s.trialEndsAt ?? ""));
      if (Number.isFinite(ends) && ends <= soon) money.trialsEndingSoon++;
    } else if (status === "canceled") {
      money.canceled++;
    }
    if (s.lapsedAt) money.lapsed++;
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
