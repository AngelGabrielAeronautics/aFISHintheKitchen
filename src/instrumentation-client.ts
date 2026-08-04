/**
 * Browser-side error reporting. Inert without NEXT_PUBLIC_SENTRY_DSN.
 *
 * The public surface is small (landing, /our-story, /r and /m share pages,
 * /invited, the legal pages) but it is the FIRST thing an invited family
 * member ever loads — if a share page throws for them, they simply leave.
 */
import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/error-reporting";

if (sentryOptions.enabled) Sentry.init(sentryOptions);
