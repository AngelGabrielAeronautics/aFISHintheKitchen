/**
 * Addresses we must never send our own lifecycle mail to.
 *
 * ⚠ `demo@` is the account App Review signs into and the privaterelay address
 * is the reviewer who bought a sandbox year during the 1.5 review — mailing
 * either puts our post at the feet of the people deciding whether we ship. The
 * third is a test login.
 *
 * ⚠⚠ THIS LIVES IN ONE PLACE ON PURPOSE. It was previously a private const in
 * admin/actions with a comment saying it "mirrors scripts/send-announcement.mjs",
 * and the nightly lapse-sweep — which mails trial warnings, trial-ended notices,
 * gift cards and gift reminders — never got a copy at all. So the console's
 * comp and extend buttons were careful and the cron that runs every night was
 * not. Duplicated tables diverge; this one is imported.
 *
 * The enforcement point is `sendTransactionalEmail`, not the callers, so a new
 * send cannot forget it.
 */
export const NEVER_EMAIL: ReadonlySet<string> = new Set([
  "demo@afishinthekitchen.com",
  "rmdjz9nbwm@privaterelay.appleid.com",
  "dylan@coppard.co.za",
]);

/** Case-insensitive, and tolerant of a missing/odd value rather than throwing. */
export function isNeverEmail(address: unknown): boolean {
  return typeof address === "string" && NEVER_EMAIL.has(address.trim().toLowerCase());
}
