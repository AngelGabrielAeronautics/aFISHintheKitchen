import { NextRequest, NextResponse } from "next/server";

// ── Native-only launch switch ───────────────────────────────────────────────
// The product is the iOS/Android app; the in-browser version of the app is not
// offered. When BLOCK_WEB_APP is true, the authenticated app pages (and /auth)
// redirect to the marketing landing page. Everything the platform still needs
// stays reachable: the /api backend the apps run on, the legal pages, the
// public share links, invite/auth-email deep-links, and the marketing site.
//
// Flip this to `true` on launch day (and swap the landing's "Sign Up" buttons
// for the App Store badge). Off for now so nothing changes while we build/test.
const BLOCK_WEB_APP = true;

// Reachable even when the app is blocked (exact matches).
//
// ⚠ /delete-account MUST stay here. Google Play requires a publicly reachable
// account-deletion URL and checks it; if the proxy bounced it to the landing,
// the Data safety declaration would point at a page that doesn't exist.
const ALLOWED_EXACT = new Set([
  "/",
  "/our-story",
  "/terms",
  "/privacy",
  "/delete-account",
]);

// Reachable even when the app is blocked (prefix matches): public share pages,
// the auth-email action handler, invite deep-link file, and staff tools.
const ALLOWED_PREFIXES = ["/r/", "/m/", "/auth/action", "/.well-known/", "/admin", "/superadmin"];

export function proxy(req: NextRequest) {
  if (!BLOCK_WEB_APP) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (ALLOWED_EXACT.has(pathname)) return NextResponse.next();
  if (ALLOWED_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // Everything else is the in-browser app or /auth — send it to the landing.
  const url = req.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Run on page routes only. Exclude /api (the app backend), Next internals,
  // and anything with a file extension — i.e. every static asset (images,
  // videos, fonts, the-kookbook.pdf, robots.txt, sitemap.xml, the AASA file).
  // Matching "any path containing a dot" is more robust than enumerating
  // extensions (an omitted one — e.g. .mp4 — was redirecting the hero video).
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
