/**
 * Error reporting for the marketing site and — the part that matters — the API
 * routes both apps run on.
 *
 * INERT WITHOUT A DSN. Nothing initialises unless NEXT_PUBLIC_SENTRY_DSN is
 * set, so the site behaves exactly as before until one is supplied.
 *
 * Why this exists: the iOS and Android apps have Crashlytics, so a crash on a
 * phone reaches us within minutes. The server had nothing. Every route here
 * ends in `console.error` and a JSON error code, which lands in Vercel logs
 * that nobody watches and that age out — so a broken share link, a failed
 * invite email, or a Play RTDN webhook rejecting a real subscription renewal
 * was invisible until a customer complained. That is exactly how Meg's invite
 * and Pam's share link were found: by the customer, days later.
 */
import * as Sentry from "@sentry/nextjs";

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

export const sentryOptions = {
  dsn: SENTRY_DSN,
  enabled: !!SENTRY_DSN,
  // Errors only — performance tracing costs quota and tells us nothing we'd act on.
  tracesSampleRate: 0,
  sendDefaultPii: false,
  beforeSend(event: Sentry.ErrorEvent) {
    // ── NEVER SEND FAMILY CONTENT ────────────────────────────────────────────
    // Request bodies here carry recipes, family names, member emails, invite
    // addresses and photo URLs. Both stores are told this app doesn't hand
    // personal data to third parties, and that has to stay true of the crash
    // reporter as well as of the app.
    delete event.user;
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      delete event.request.headers;
    }

    // ── DROP ERRORS THAT AREN'T OURS ─────────────────────────────────────────
    // The Vercel Toolbar injects itself on production for logged-in team
    // members only and throws from its own bundle while text-selecting around
    // a React re-render. Real visitors never load it, so this is noise from a
    // script we neither ship nor control — and noise is the actual danger: an
    // error feed that cries wolf is one nobody reads when something real
    // breaks.
    //
    // Matched on the FRAME PATH, not the message, so a genuine selection bug
    // in our own code still reports.
    const framesFromToolbar = event.exception?.values?.some((v) =>
      v.stacktrace?.frames?.some((f) =>
        /\/_next-live\/|vercel\.live|vercel-toolbar/.test(f.filename ?? ""),
      ),
    );
    if (framesFromToolbar) return null;

    return event;
  },
};

/**
 * Report something caught and handled, where a failure would otherwise vanish.
 *
 * Use this in `catch` blocks that currently only `console.error` — the ones
 * where the caller gets a friendly message and we'd otherwise never know it
 * happened. Pass ids and codes as context, never names, emails or content.
 */
export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (!SENTRY_DSN) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
