// Server-only. The single chokepoint for sending our own transactional email
// (invites, and future billing/account notices). Every send here is hardened
// against SendGrid's suppression behaviour so our mail — including anything to
// our own admin inbox — can never be silently lost:
//
//   * subscriptionTracking OFF  → no unsubscribe link/footer is added, so a
//     recipient (or we ourselves) can't accidentally unsubscribe.
//   * bypassUnsubscribeManagement ON → the send ignores the unsubscribe /
//     global-unsubscribe lists, so an already-unsubscribed address still gets
//     it. Bounces, blocks and spam reports are STILL honoured.
//
// Use this for transactional mail only — never marketing/bulk, where honouring
// unsubscribe is a legal requirement.
import sgMail from "@sendgrid/mail";
import { isNeverEmail } from "./never-email";

export const FROM_NAME = "A Fish in the Kitchen";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL ?? "noreply@afishinthekitchen.com";
const DEFAULT_REPLY_TO = process.env.SENDGRID_REPLY_TO_EMAIL ?? "admin@afishinthekitchen.com";

export interface TransactionalEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /**
   * Send even to a NEVER_EMAIL address.
   *
   * ⚠ ONLY for mail the recipient asked for and cannot proceed without — a
   * password reset, an email verification — and for our own ops alerts. Never
   * for anything we decided to send them: trial notices, gift chasers,
   * announcements. App Review must still be able to reset the demo account's
   * password; it must not receive "your trial is ending".
   *
   * The polarity is deliberate. Forgetting this flag means one functional email
   * does not arrive, which is visible and fixable. The opposite default means
   * mailing the people deciding whether we ship, which is neither.
   */
  allowSuppressed?: boolean;
}

export async function sendTransactionalEmail(msg: TransactionalEmail): Promise<void> {
  // ⚠ THE GUARD LIVES HERE, not in the callers. There are fourteen call sites
  // across invites, gifts, auth, the console and the nightly sweep; the two
  // console buttons checked the list and the cron never did. See lib/never-email.
  if (!msg.allowSuppressed && isNeverEmail(msg.to)) {
    console.warn(`email: suppressed "${msg.subject}" to ${msg.to} (NEVER_EMAIL)`);
    return;
  }
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error("SENDGRID_API_KEY is not set");
  sgMail.setApiKey(apiKey);
  await sgMail.send({
    to: msg.to,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    replyTo: { email: msg.replyTo ?? DEFAULT_REPLY_TO, name: FROM_NAME },
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    trackingSettings: { subscriptionTracking: { enable: false } },
    mailSettings: { bypassUnsubscribeManagement: { enable: true } },
  });
}
