import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { sendTransactionalEmail } from "@/lib/email";
import { sendWeeklyRecipePushIfDue } from "@/lib/learn-weekly";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

// Does the service actually work? Crashlytics catches crashes in the apps;
// nothing was watching the routes the apps depend on. If /api/invite starts
// failing, the invite loop — the whole distribution mechanic — dies in silence.
//
// Two audiences, one implementation:
//
//   GET /api/health                     → bare 200 / 503, no detail.
//                                         For an external uptime monitor.
//   GET /api/health  + CRON_SECRET      → full detail, and emails on a change
//                                         of state. For the cron below.
//
// ⚠ The bare response is deliberately detail-free. A public endpoint listing
// which providers we use and which of their keys are missing is a map for
// somebody; the status code is all a monitor needs.
//
// ⚠ An external monitor is the point. A cron running INSIDE Vercel cannot tell
// you that Vercel is down, and that is one of the outages you most want to hear
// about. The cron here is the belt to the monitor's braces.
//
// The cron in vercel.json is deliberately DAILY. Vercel restricts cron frequency
// by plan and a schedule the plan disallows fails the whole deploy, so this errs
// on the safe side: it catches "broken since yesterday", and the external monitor
// provides minute-scale coverage. On Pro, change the schedule to "0 * * * *".
//
// Vercel attaches `Authorization: Bearer $CRON_SECRET` to cron invocations when
// CRON_SECRET is set, which is how the cron gets the detailed, alerting path
// without the secret living anywhere else.

/** Routes the apps cannot work without, and what they say when unauthenticated. */
const ROUTES: { path: string; expect: number; why: string }[] = [
  { path: "/api/invite", expect: 401, why: "the invite loop — distribution" },
  { path: "/api/join", expect: 401, why: "invited members getting in" },
  { path: "/api/import-recipe", expect: 401, why: "photo and paste import" },
  { path: "/api/suggest-recipe", expect: 401, why: "ask AI for a recipe" },
  { path: "/api/enhance-photo", expect: 401, why: "photo enhancement" },
  { path: "/api/push", expect: 401, why: "notifications to the family" },
  { path: "/api/register-device", expect: 401, why: "push registration" },
  // Apple's webhook rejects an unsigned body with 400, not 401.
  { path: "/api/billing/appstore/notifications", expect: 400, why: "renewals, refunds, cancellations" },
];

/**
 * Environment the routes read at request time. Presence only — we cannot check
 * a key is still VALID without spending money on every probe, so a revoked key
 * still reads as present. This catches the commoner failure: a deploy or a
 * config edit that drops a variable.
 */
const REQUIRED_ENV = [
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "SENDGRID_API_KEY",
  "FIREBASE_SERVICE_ACCOUNT_B64",
  "CRON_SECRET",
] as const;

type Check = { name: string; ok: boolean; detail?: string };

async function runChecks(origin: string): Promise<Check[]> {
  const checks: Check[] = [];

  for (const key of REQUIRED_ENV) {
    checks.push({ name: `env:${key}`, ok: !!process.env[key] });
  }

  // Firestore, via the Admin SDK the routes themselves use.
  try {
    await getAdminDb().collection("ops").doc("health").get();
    checks.push({ name: "firestore", ok: true });
  } catch (err) {
    checks.push({ name: "firestore", ok: false, detail: String(err).slice(0, 200) });
  }

  // The routes, in parallel — a serial pass would blow the function timeout.
  const probes = await Promise.all(
    ROUTES.map(async (r) => {
      try {
        const res = await fetch(origin + r.path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          cache: "no-store",
        });
        // The exact code matters less than "not missing and not broken": a 404
        // means it was renamed or dropped, a 5xx means it throws on every call.
        const ok = res.status === r.expect || (res.status < 500 && res.status !== 404);
        return { name: `route:${r.path}`, ok, detail: ok ? undefined : `HTTP ${res.status} (${r.why})` };
      } catch (err) {
        return { name: `route:${r.path}`, ok: false, detail: String(err).slice(0, 200) };
      }
    })
  );

  return [...checks, ...probes];
}

/**
 * Email only when the state CHANGES — down, then back up.
 *
 * A monitor that mails every fifteen minutes while something is broken gets
 * filtered within a day, and then it is worse than nothing because everyone
 * believes it is watching.
 */
async function alertOnChange(failing: Check[]): Promise<"alerted" | "recovered" | "unchanged"> {
  const ref = getAdminDb().collection("ops").doc("health");
  const prev = (await ref.get()).data() as { failing?: string[] } | undefined;
  const wasFailing = (prev?.failing ?? []).length > 0;
  const nowFailing = failing.length > 0;
  const names = failing.map((f) => f.name);

  await ref.set({ failing: names, checkedAt: new Date().toISOString() }, { merge: true });

  if (!wasFailing && !nowFailing) return "unchanged";
  // Still broken, but re-alert if the SET of failures changed — a second thing
  // breaking during an outage is news.
  if (wasFailing && nowFailing) {
    const same = JSON.stringify((prev?.failing ?? []).sort()) === JSON.stringify([...names].sort());
    if (same) return "unchanged";
  }

  const to = process.env.SENDGRID_REPLY_TO_EMAIL ?? "admin@afishinthekitchen.com";
  if (nowFailing) {
    const lines = failing.map((f) => `• ${f.name}${f.detail ? ` — ${f.detail}` : ""}`);
    await sendTransactionalEmail({
      allowSuppressed: true, // ops alert to our own inbox — never suppress
      to,
      subject: `A Fish in the Kitchen — ${failing.length} check${failing.length === 1 ? "" : "s"} failing`,
      text: `These checks are failing:\n\n${lines.join("\n")}\n\nhttps://www.afishinthekitchen.com/api/health`,
      html: `<p>These checks are failing:</p><ul>${failing
        .map((f) => `<li><strong>${f.name}</strong>${f.detail ? ` — ${f.detail}` : ""}</li>`)
        .join("")}</ul>`,
    });
    return "alerted";
  }

  await sendTransactionalEmail({
      allowSuppressed: true, // ops alert to our own inbox — never suppress
    to,
    subject: "A Fish in the Kitchen — back to healthy",
    text: "Every check is passing again.",
    html: "<p>Every check is passing again.</p>",
  });
  return "recovered";
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorised = !!secret && req.headers.get("authorization") === `Bearer ${secret}`;

  // Probe ourselves on whatever origin we're actually served from, so this works
  // on a preview deployment as well as production.
  const origin = new URL(req.url).origin;

  let checks: Check[];
  try {
    checks = await runChecks(origin);
  } catch (err) {
    console.error("health: checks threw", err);
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const failing = checks.filter((c) => !c.ok);
  const ok = failing.length === 0;

  if (!authorised) {
    // Status code carries the whole message; no detail for the world.
    return NextResponse.json({ ok }, { status: ok ? 200 : 503 });
  }

  let alert: string = "skipped";
  try {
    alert = await alertOnChange(failing);
  } catch (err) {
    console.error("health: alerting failed", err);
    alert = "alert-failed";
  }

  // The Monday "Learn this recipe this week" push rides this cron because
  // both Hobby cron slots are taken and 07:00 UTC is a humane push hour.
  // Self-gating (Mondays only, once per week) and wrapped: a push failure
  // must never mark the service unhealthy.
  let weeklyPush: unknown = null;
  try {
    weeklyPush = await sendWeeklyRecipePushIfDue();
  } catch (err) {
    console.error("health: weekly recipe push failed", err);
    weeklyPush = { error: String(err).slice(0, 200) };
  }

  return NextResponse.json(
    { ok, alert, weeklyPush, checks, checkedAt: new Date().toISOString() },
    { status: ok ? 200 : 503 }
  );
}
