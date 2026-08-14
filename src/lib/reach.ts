/**
 * Reach figures — how many people actually have the app.
 *
 * Written to `stats/reach` by the nightly cron, read by the admin console.
 *
 * ⚠ EVERY FIELD IS NULLABLE AND EVERY SOURCE DEGRADES ON ITS OWN. One platform
 * being unavailable must never blank the other, and a source with no data yet
 * must write NOTHING rather than a confident zero. This is the number Dylan
 * will use to decide whether the business is working; a wrong one is worse
 * than a missing one.
 *
 * ⚠ THE TWO PLATFORMS ARE NOT THE SAME KIND OF NUMBER. iOS is near-daily from
 * Apple's Analytics Reports. Android is a monthly CSV rewritten daily, so it
 * lags about a day. They carry separate as-of dates; never present one date as
 * covering both, and never add them together without saying what you have done.
 */

import { getAdminDb } from "./firebase-admin";
import { fetchAppStoreDownloads, hasAppStoreCreds } from "./appstore-analytics";
import { fetchPlayInstalls, hasPlayCreds } from "./play-analytics";

export interface ReachStats {
  /** iOS first-time downloads to date. */
  appStore: number | null;
  appStoreAsOf: string | null;
  /**
   * First day Apple's data covers.
   *
   * ⚠ NOT the app's launch date. Apple reports forward from the day the report
   * request was registered, so a total shown without this reads as lifetime
   * when it may be a few days. The console shows the range, not just a number.
   */
  appStoreSince: string | null;
  /** Android installs to date. */
  play: number | null;
  playAsOf: string | null;
  updatedAt: number;
  /** Why a source is missing, surfaced in admin so silence is explainable. */
  notes: string[];
}

const DOC = "stats/reach";

/** Read the last-written figures. Null when the cron has never run. */
export async function getReachStats(): Promise<ReachStats | null> {
  const snap = await getAdminDb().doc(DOC).get();
  return snap.exists ? (snap.data() as ReachStats) : null;
}

/**
 * Refresh every source and persist.
 *
 * ⚠ Each source is wrapped INDEPENDENTLY so a failure in one leaves the others
 * — and the previous value — intact. Play currently 403s (the service account
 * needs the ACCOUNT-level bulk-reports grant), and that must not cost us the
 * iOS figure.
 */
export async function refreshReachStats(): Promise<ReachStats> {
  const db = getAdminDb();
  const previous = (await db.doc(DOC).get()).data() as ReachStats | undefined;
  const notes: string[] = [];

  let appStore = previous?.appStore ?? null;
  let appStoreAsOf = previous?.appStoreAsOf ?? null;
  let appStoreSince = previous?.appStoreSince ?? null;
  if (!hasAppStoreCreds()) {
    notes.push("iOS: ASC_KEY_ID / ASC_PRIVATE_KEY_B64 not set");
  } else {
    try {
      const d = await fetchAppStoreDownloads();
      if (d) {
        appStore = d.total;
        appStoreAsOf = d.latestDate;
        appStoreSince = d.earliestDate;
      } else {
        notes.push("iOS: Apple has not produced a report yet (24–48h after registering)");
      }
    } catch (e) {
      notes.push(`iOS: ${String(e).slice(0, 120)}`);
    }
  }

  let play = previous?.play ?? null;
  let playAsOf = previous?.playAsOf ?? null;
  if (!hasPlayCreds()) {
    notes.push("Android: PLAY_SERVICE_ACCOUNT_B64 not set");
  } else {
    try {
      const p = await fetchPlayInstalls();
      if (p) {
        play = p.total;
        playAsOf = p.asOf;
      } else {
        notes.push("Android: no readable install report yet");
      }
    } catch (e) {
      const msg = String(e);
      notes.push(
        msg.includes("403")
          ? "Android: 403 — the service account needs ACCOUNT-level " +
            "'View app information and download bulk reports' in Play Console " +
            "(app-level Admin is not enough), and it can take 24h to propagate"
          : `Android: ${msg.slice(0, 120)}`,
      );
    }
  }

  const stats: ReachStats = {
    appStore,
    appStoreAsOf,
    appStoreSince,
    play,
    playAsOf,
    updatedAt: Date.now(),
    notes,
  };
  await db.doc(DOC).set(stats);
  return stats;
}
