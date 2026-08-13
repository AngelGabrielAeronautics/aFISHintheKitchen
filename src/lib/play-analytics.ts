/**
 * Google Play installs, from the monthly reports bucket.
 *
 * Ported from the Jersey Beach app. Every warning here is one it hit.
 *
 * ── WHY A CSV IN A BUCKET AND NOT AN API ──────────────────────────────────
 * Google has no installs API. The Play Developer Reporting API covers
 * crashes/ANRs/vitals only; install counts come out solely as monthly CSVs
 * dropped into a Cloud Storage bucket Google owns. Each file is
 * `installs_<package>_YYYYMM_overview.csv` and is rewritten daily for the
 * current month, so this is roughly a day behind — not live. The figure
 * carries its own as-of date for that reason, and must never share a date
 * with the iOS number, which is a different kind of measurement.
 *
 * ── THREE TRAPS, ALL SILENT ───────────────────────────────────────────────
 * 1. The CSVs are UTF-16LE with a BOM, not UTF-8. Read as UTF-8 they parse
 *    into a header of NUL-separated bytes, every column lookup misses, and
 *    you get a confident 0 rather than an error.
 * 2. "Total User Installs" is ALREADY CUMULATIVE to that date — summing the
 *    column multiplies the real number by the number of rows. Take the last
 *    row's value, never a sum.
 * 3. ⛔ GOOGLE PUBLISHES 0 IN "Total User Installs" FOR A SMALL AUDIENCE, on
 *    the same row that reports real installs — e.g. Daily User Installs 6,
 *    Active Device Installs 3, Total User Installs 0. A zero its own row
 *    contradicts is an ABSENCE, not a count. Fall back to the other columns.
 *
 * ── THE PERMISSION IS ACCOUNT-LEVEL, NOT APP-LEVEL ────────────────────────
 * Play Console → Users and permissions → the service account → ACCOUNT
 * permissions → "View app information and download bulk reports (read only)".
 * The similarly-named APP permission "View app information (read-only)" is NOT
 * enough — the bucket is bulk reports, and only the account-level grant
 * reaches it. Our service account currently has app-level Admin and gets a
 * 403 here.
 *
 * ⚠ The grant does NOT take effect immediately — Google propagates it to the
 * bucket ACL on its own schedule, documented as up to 24 hours. A denial right
 * after granting means WAIT, not that the permission is wrong.
 */

import { GoogleAuth } from "google-auth-library";

const PACKAGE = "angelgabriel.afishinthekitchen";
/**
 * The reports bucket is per Play DEVELOPER ACCOUNT, not per app. Overridable
 * because it is impossible to guess: it is shown in Play Console → Download
 * reports → Statistics, at the bottom, as a gs:// URI.
 */
const BUCKET = process.env.PLAY_REPORTS_BUCKET ?? "pubsite_prod_8780479644383391717";
const SCOPE = "https://www.googleapis.com/auth/devstorage.read_only";

function serviceAccount(): Record<string, unknown> | null {
  const b64 = process.env.PLAY_SERVICE_ACCOUNT_B64;
  if (!b64) return null;
  try {
    return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

export const hasPlayCreds = (): boolean => serviceAccount() !== null;

async function accessToken(): Promise<string> {
  const creds = serviceAccount();
  if (!creds) throw new Error("PLAY_SERVICE_ACCOUNT_B64 is not set");
  // Same GoogleAuth path play-verify.ts already uses in production here.
  const auth = new GoogleAuth({ credentials: creds as never, scopes: [SCOPE] });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("no access token");
  return token;
}

export interface PlayInstalls {
  /** Total user installs to date. */
  total: number;
  /** Month the figure came from, as YYYY-MM. */
  asOf: string | null;
}

/**
 * Installs to date, or null when Google has published nothing we can read.
 *
 * As with Apple, null means "no answer" and must not be rendered as 0.
 */
export async function fetchPlayInstalls(): Promise<PlayInstalls | null> {
  if (!hasPlayCreds()) return null;
  const token = await accessToken();

  const list = await fetch(
    `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o` +
      `?prefix=${encodeURIComponent(`stats/installs/installs_${PACKAGE}_`)}&maxResults=200`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!list.ok) throw new Error(`play reports ${list.status}`);
  const items = ((await list.json()) as { items?: { name: string }[] }).items ?? [];

  // Newest month wins — the file for the current month is rewritten daily.
  const overview = items
    .map((i) => i.name)
    .filter((n) => n.endsWith("_overview.csv"))
    .sort()
    .pop();
  if (!overview) return null;

  const file = await fetch(
    `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(overview)}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!file.ok) throw new Error(`play csv ${file.status}`);

  // ⚠ UTF-16LE, not UTF-8. Decoding wrongly yields a silent zero.
  const text = new TextDecoder("utf-16le").decode(await file.arrayBuffer()).replace(/^﻿/, "");
  const [head, ...lines] = text.trim().split(/\r?\n/);
  if (!head) return null;
  const cols = head.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  const rows = lines
    .filter((l) => l.trim())
    .map((l) => {
      const cells = l.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? ""]));
    });
  if (!rows.length) return null;

  // ⚠ CUMULATIVE COLUMN — take the LAST row, never a sum.
  const last = rows[rows.length - 1];
  const num = (v: string | undefined) => {
    const n = Number(String(v ?? "").replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  let total = num(last["Total User Installs"]);

  // ⛔ Trap 3: a 0 its own row contradicts is an absence. Prefer the
  // corroborating columns rather than publishing "nobody has it".
  if (total === 0) {
    const alt = Math.max(num(last["Active Device Installs"]), num(last["Daily User Installs"]));
    if (alt > 0) total = alt;
  }
  if (total === 0) return null;

  const month = overview.match(/_(\d{4})(\d{2})_overview\.csv$/);
  return { total, asOf: month ? `${month[1]}-${month[2]}` : null };
}
