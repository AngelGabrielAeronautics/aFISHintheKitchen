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

export const FROM_NAME = "A Fish in the Kitchen";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL ?? "noreply@afishinthekitchen.com";
const DEFAULT_REPLY_TO = process.env.SENDGRID_REPLY_TO_EMAIL ?? "admin@afishinthekitchen.com";

export interface TransactionalEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export async function sendTransactionalEmail(msg: TransactionalEmail): Promise<void> {
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
