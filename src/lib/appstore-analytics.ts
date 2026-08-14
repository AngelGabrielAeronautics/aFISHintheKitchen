/**
 * App Store Connect Analytics Reports — iOS download numbers, server-only.
 *
 * Ported from the Jersey Beach app, which learned all of this the hard way and
 * published a wrong number to advertisers while doing so. The comments below
 * are the scar tissue; do not trim them.
 *
 * ── THE FLOW APPLE ACTUALLY REQUIRES ──────────────────────────────────────
 * Nothing is available on demand. You register an ONGOING
 * analyticsReportRequest ONCE — done for this app on 2026-08-13, id
 * `aa3944eb-d42e-48d4-a8ef-8c4c08363aa4` — and Apple then generates report
 * *instances* on its own schedule. The first data lands 24–48h after
 * registering. So: request → reports → instances → segments → a URL to fetch.
 *
 * ⚠ Until Apple has produced an instance this returns null, and null must be
 * rendered as "not yet", never as 0.
 *
 * ── NOT TRACKING ──────────────────────────────────────────────────────────
 * These are platform-level totals Apple already computes. Nothing is collected
 * in the app, which is what the privacy policy promises.
 */

import { gunzipSync } from "node:zlib";
import { createSign } from "node:crypto";

const ISSUER = "bd1c8cbc-2948-49d5-9afe-cd6c2753971a";
const APP_ID = "6780944935";
const BASE = "https://api.appstoreconnect.apple.com";

/** The report we want. Apple's naming is exact — a typo yields silence. */
const REPORT_NAME = "App Downloads Standard";

function creds(): { keyId: string; pem: string } | null {
  const keyId = process.env.ASC_KEY_ID;
  const raw = process.env.ASC_PRIVATE_KEY_B64;
  if (!keyId || !raw) return null;
  return { keyId, pem: Buffer.from(raw, "base64").toString("utf8") };
}

/** True when the deployment has been given App Store credentials. */
export const hasAppStoreCreds = (): boolean => creds() !== null;

/**
 * ES256 JWT, hand-rolled so this needs no new dependency.
 *
 * ⚠ The signature must be raw `r‖s` (64 bytes), NOT the DER blob Node returns
 * by default — with DER every call 401s and Apple tells you nothing useful.
 * `dsaEncoding: "ieee-p1363"` is what produces the JOSE form.
 */
function token(): string {
  const c = creds();
  if (!c) throw new Error("ASC credentials not configured");
  const b64 = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "ES256", kid: c.keyId, typ: "JWT" });
  const body = b64({ iss: ISSUER, iat: now, exp: now + 900, aud: "appstoreconnect-v1" });
  const sig = createSign("SHA256")
    .update(`${head}.${body}`)
    .sign({ key: c.pem, dsaEncoding: "ieee-p1363" })
    .toString("base64url");
  return `${head}.${body}.${sig}`;
}

async function api(path: string, jwt: string): Promise<Record<string, unknown>> {
  const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${jwt}` } });
  if (!res.ok) throw new Error(`ASC ${res.status} on ${path}`);
  return res.json();
}

type Row = Record<string, string>;

/** Parse Apple's gzipped TSV into rows keyed by their header names. */
function parseTsvGz(buf: ArrayBuffer): Row[] {
  const text = gunzipSync(Buffer.from(buf)).toString("utf8");
  const [head, ...lines] = text.trim().split("\n");
  if (!head) return [];
  const cols = head.split("\t").map((c) => c.trim());
  return lines.map((l) => {
    const cells = l.split("\t");
    return Object.fromEntries(cols.map((c, i) => [c, (cells[i] ?? "").trim()]));
  });
}

export interface AppStoreDownloads {
  /** Cumulative first-time downloads across every day Apple has reported. */
  total: number;
  /** The most recent day present in the data (YYYY-MM-DD), if any. */
  latestDate: string | null;
  /**
   * The EARLIEST day present.
   *
   * ⚠ THE TOTAL IS NOT NECESSARILY LIFETIME, and this is the field that says
   * so. An ONGOING request only reports forward from the day it was registered
   * (2026-08-13 here), while the app went live on 2026-07-28. A
   * ONE_TIME_SNAPSHOT request was added to backfill the rest; until Apple
   * produces it, the total covers only the days below. Showing a partial figure
   * as "downloads" would understate the app to the person deciding whether it
   * is working.
   */
  earliestDate: string | null;
}

/**
 * Total iOS downloads to date, or null when Apple has nothing yet.
 *
 * null is a FIRST-CLASS answer, not a failure: for the first day or two after
 * registering, Apple genuinely returns no instances. The caller must not write
 * a 0 in that case — a confident zero is worse than an honest blank.
 */
export async function fetchAppStoreDownloads(): Promise<AppStoreDownloads | null> {
  if (!hasAppStoreCreds()) return null;
  const jwt = token();

  const requests = (await api(
    `/v1/apps/${APP_ID}/analyticsReportRequests?limit=10`,
    jwt,
  )) as { data?: { id: string; attributes?: { accessType?: string } }[] };
  if (!requests.data?.length) return null;

  // ⚠ EVERY request, not just the ONGOING one. There are two by design: ONGOING
  // reports forward from the day it was registered, and ONE_TIME_SNAPSHOT
  // backfills what came before. Reading only the first would silently drop the
  // app's entire history — and the code did exactly that until 2026-08-14.
  // Merging is safe because days are keyed by the row's own Date below.
  const instanceIds: { id: string; processingDate: string }[] = [];
  for (const req of requests.data) {
    const reports = (await api(
      `/v1/analyticsReportRequests/${req.id}/reports?limit=200`,
      jwt,
    )) as { data?: { id: string; attributes?: { name?: string } }[] };
    const report = reports.data?.find((r) => r.attributes?.name === REPORT_NAME);
    if (!report) continue; // this request hasn't produced downloads yet

    const instances = (await api(
      `/v1/analyticsReports/${report.id}/instances?limit=200`,
      jwt,
    )) as { data?: { id: string; attributes?: { processingDate?: string } }[] };
    for (const i of instances.data ?? []) {
      instanceIds.push({ id: i.id, processingDate: i.attributes?.processingDate ?? "" });
    }
  }
  if (!instanceIds.length) return null;

  /**
   * ⛔ TWO WAYS THIS OVERCOUNTED ON THE APP IT CAME FROM — 3.7× too high, in
   * public — because it summed every row of every instance:
   *
   * 1. UPDATES ARE ROWS IN THIS REPORT. `Download Type` is one of First-time
   *    download · Redownload · Auto-update · Manual update. Most rows are
   *    existing users' phones fetching a new build. An update is not a person.
   * 2. THE DAILY INSTANCES OVERLAP. Each carries about two days, so
   *    consecutive instances restate the same day:
   *      processingDate 08-03 → rows for 08-02 AND 08-01
   *      processingDate 08-04 → rows for 08-03 AND 08-02   ← 08-02 again
   *
   * So: keep first-time downloads only, and key by the row's own Date rather
   * than adding instances up. A later instance restating a day WINS, because
   * Apple revises figures — that is the point of restating them.
   */
  const firstTimeByDate = new Map<string, number>();
  let sawDownloadType = false;

  // Oldest first, so a later instance's revision of a day overwrites it.
  const ordered = [...instanceIds].sort((a, b) =>
    a.processingDate.localeCompare(b.processingDate),
  );

  for (const inst of ordered) {
    const segs = (await api(`/v1/analyticsReportInstances/${inst.id}/segments`, jwt)) as {
      data?: { attributes?: { url?: string } }[];
    };
    // This instance's own view of each day, built up before it replaces
    // anything — one instance spans several days and many rows per day
    // (device, territory, source), so it must be complete before it wins.
    const thisInstance = new Map<string, number>();

    for (const seg of segs.data ?? []) {
      if (!seg.attributes?.url) continue;
      const res = await fetch(seg.attributes.url); // pre-signed; no auth header
      if (!res.ok) continue;
      for (const row of parseTsvGz(await res.arrayBuffer())) {
        const kind = row["Download Type"];
        if (kind !== undefined) {
          sawDownloadType = true;
          // A redownload is a returning user reinstalling, not a new one.
          if (kind !== "First-time download") continue;
        }
        const date = row["Date"] ?? row["Processing Date"];
        if (!date) continue;
        // Apple's column naming has shifted between report versions — accept
        // any spelling rather than silently summing nothing.
        const units = row["Counts"] ?? row["Units"] ?? row["Total Downloads"] ?? "0";
        const n = Number(units.replace(/,/g, ""));
        if (Number.isFinite(n)) thisInstance.set(date, (thisInstance.get(date) ?? 0) + n);
      }
    }
    for (const [date, n] of thisInstance) firstTimeByDate.set(date, n);
  }

  // ⚠ If Apple ever drops the Download Type column this counts updates as
  // downloads again — silently. Say so rather than publish a number whose
  // meaning changed underneath us.
  if (!sawDownloadType && firstTimeByDate.size > 0) {
    console.warn("[appstore-analytics] no Download Type column — total may include updates");
  }

  let total = 0;
  let latestDate: string | null = null;
  let earliestDate: string | null = null;
  for (const [date, n] of firstTimeByDate) {
    total += n;
    if (!latestDate || date > latestDate) latestDate = date;
    if (!earliestDate || date < earliestDate) earliestDate = date;
  }

  if (!latestDate && total === 0) return null; // parsed nothing meaningful
  return { total, latestDate, earliestDate };
}
