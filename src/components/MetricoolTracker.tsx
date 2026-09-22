"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

/**
 * Metricool's web tracker — puts site traffic in the "A Fish in the Kitchen"
 * Metricool brand alongside the social numbers. Same tracker the Angel Gabriel
 * site carries.
 *
 * ── WHY THIS IS NOT IN THE ROOT LAYOUT ────────────────────────────────────
 * The tracker is a one-pixel beacon. The whole of be.js is:
 *
 *   beTracker.t(a) -> a.u = document.location.href, a.bw/a.bh = viewport,
 *                     a.ref = document.referrer,
 *                     new Image().src = tracker.metricool.com/c3po.jpg?<those>
 *
 * No cookies, no localStorage, no fingerprinting — but it does send THE FULL
 * URL, and this site has capability URLs where the path *is* the credential:
 *
 *   /g/[code]     redeeming a gift
 *   /join/[code]  joining someone's family cookbook
 *   /m/[token]    a shared menu   ("token-only, noindex: sharing, not publishing")
 *   /r/[token]    a shared recipe (same)
 *
 * Beaconing those to a third party would hand out the very links those pages
 * are deliberately unlisted to protect. So the tracker is gated on pathname
 * and never fires on them. Private/admin areas are excluded too — they are
 * nobody's marketing funnel and there is no reason to ship their URLs out.
 *
 * ⚠️ If you add another route whose URL carries a token, code or anything else
 * secret, ADD ITS PREFIX TO EXCLUDED_PREFIXES BELOW.
 *
 * Referrer note: navigating FROM an excluded page to an included one can still
 * put the secret URL in document.referrer. The site's Referrer-Policy is
 * strict-origin-when-cross-origin (next.config.ts), so cross-origin requests
 * send only the origin — the beacon to tracker.metricool.com is cross-origin,
 * so the path never leaves. Do not loosen that header without revisiting this.
 */

/** Hash for the "A Fish in the Kitchen" brand, from Metricool → Manage
    connections → Web connection. */
const METRICOOL_HASH = "4cd082f48f9f619cda15366224549a79";

/** Route prefixes the beacon must never see. */
const EXCLUDED_PREFIXES = [
  "/g/",
  "/join/",
  "/m/",
  "/r/",
  "/auth",
  "/admin",
  "/superadmin",
  "/invited",
  "/delete-account",
];

export default function MetricoolTracker() {
  const pathname = usePathname();

  if (!pathname) return null;
  if (EXCLUDED_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p))) {
    return null;
  }

  return (
    <Script id="metricool-tracker" strategy="afterInteractive">
      {`function loadScript(a){var b=document.getElementsByTagName("head")[0],c=document.createElement("script");c.type="text/javascript",c.src="https://tracker.metricool.com/resources/be.js",c.onreadystatechange=a,c.onload=a,b.appendChild(c)}loadScript(function(){beTracker.t({hash:"${METRICOOL_HASH}"})});`}
    </Script>
  );
}
