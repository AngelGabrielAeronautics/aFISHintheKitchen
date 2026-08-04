/**
 * Server-side error reporting (Next.js instrumentation hook).
 *
 * Inert without NEXT_PUBLIC_SENTRY_DSN — see lib/error-reporting.ts.
 */
import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/error-reporting";

export function register() {
  if (!sentryOptions.enabled) return;
  Sentry.init(sentryOptions);
}

// Catches anything thrown out of a route handler or server component that we
// didn't catch ourselves — the unknown-unknowns, which are the whole point.
export const onRequestError = Sentry.captureRequestError;
