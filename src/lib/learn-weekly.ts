import { getAdminDb, getAdminMessaging } from "@/lib/firebase-admin";

// The Monday push for "Learn this recipe this week" (docs/LEARN.md).
//
// The hero in the apps flips silently — the phones compute the week's pick
// themselves. Without a push, "a new dish every Monday" is a fact nobody is
// told, and content nobody is told about retains nobody. This announces it.
//
// ⚠ Rides the /api/health cron (07:00 UTC daily) because Vercel Hobby allows
// exactly two cron entries and both are taken. 07:00 UTC Monday is 08:00 in
// Jersey — a humane hour for a push, which the 03:00 lapse-sweep is not.
//
// ⚠ The pick logic MIRRORS LearnView.weeklyPick on iOS (and Android when it
// lands): pinned "MM-DD" items own the Monday–Sunday week containing that
// date; otherwise the unpinned pool rotates in sortOrder, weeks counted from
// the epoch Monday. If either side changes, change BOTH.

/** Monday 2026-08-24 00:00 UTC — the week the feature launched. */
const EPOCH_MS = 1_787_529_600_000;
const WEEK_MS = 7 * 86_400_000;

interface WeeklyDoc {
  id: string;
  title: string;
  sortOrder: number;
  pinnedDate: string | null;
}

/** The UTC Monday 00:00 that starts the week containing `ms`. */
function mondayOf(ms: number): number {
  const day = new Date(ms).getUTCDay(); // Sun=0 … Sat=6
  const sinceMonday = (day + 6) % 7;
  const midnight = new Date(ms).setUTCHours(0, 0, 0, 0);
  return midnight - sinceMonday * 86_400_000;
}

function pickOfTheWeek(pool: WeeklyDoc[], now: Date): WeeklyDoc | null {
  if (pool.length === 0) return null;
  const thisMonday = mondayOf(now.getTime());

  for (const item of pool) {
    if (!item.pinnedDate) continue;
    const [mm, dd] = item.pinnedDate.split("-").map(Number);
    const pinned = Date.UTC(now.getUTCFullYear(), mm - 1, dd);
    if (mondayOf(pinned) === thisMonday) return item;
  }

  const rotating = pool
    .filter((i) => !i.pinnedDate)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  if (rotating.length === 0) return null;
  const weeks = Math.max(0, Math.floor((now.getTime() - EPOCH_MS) / WEEK_MS));
  return rotating[weeks % rotating.length];
}

/**
 * Send the Monday broadcast, once per week. Safe to call daily: it does
 * nothing except on Mondays (UTC), and a stamp in config/learnWeekly stops a
 * re-run of the cron from sending twice.
 */
export async function sendWeeklyRecipePushIfDue(): Promise<Record<string, unknown>> {
  const now = new Date();
  if (now.getUTCDay() !== 1) return { skipped: "not_monday" };

  const db = getAdminDb();
  const thisMonday = new Date(mondayOf(now.getTime())).toISOString().slice(0, 10);

  const stampRef = db.collection("config").doc("learnWeekly");
  const stamp = await stampRef.get();
  if (stamp.data()?.lastPushMonday === thisMonday) return { skipped: "already_sent", week: thisMonday };

  const snap = await db.collection("learnItems").where("type", "==", "weekly").get();
  const pool: WeeklyDoc[] = snap.docs
    .filter((d) => d.data().status === "published")
    .map((d) => ({
      id: d.id,
      title: String(d.data().title ?? ""),
      sortOrder: Number(d.data().sortOrder ?? 0),
      pinnedDate: (d.data().pinnedDate as string | undefined) ?? null,
    }));
  const pick = pickOfTheWeek(pool, now);
  if (!pick) return { skipped: "empty_pool" };

  const tokensSnap = await db.collection("deviceTokens").get();
  const tokens = [...new Set(tokensSnap.docs.map((d) => d.data().token as string))].filter(Boolean);
  if (tokens.length === 0) {
    await stampRef.set({ lastPushMonday: thisMonday, pickId: pick.id, sent: 0 }, { merge: true });
    return { skipped: "no_devices", week: thisMonday };
  }

  const res = await getAdminMessaging().sendEachForMulticast({
    tokens,
    notification: {
      title: "Learn this recipe this week",
      body: pick.title.slice(0, 240),
    },
    data: { link: "/learn", type: "learn" },
    apns: { payload: { aps: { sound: "default" } } },
  });

  // Prune tokens Apple/FCM rejected as unregistered — same hygiene as /api/push.
  const stale: string[] = [];
  res.responses.forEach((r, i) => {
    const code = r.error?.code;
    if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
      stale.push(tokens[i]);
    }
  });
  await Promise.all(stale.map((t) => db.collection("deviceTokens").doc(t).delete().catch(() => {})));

  await stampRef.set(
    { lastPushMonday: thisMonday, pickId: pick.id, pickTitle: pick.title, sent: res.successCount, at: now.toISOString() },
    { merge: true }
  );
  return { week: thisMonday, pick: pick.title, sent: res.successCount, failed: res.failureCount };
}
