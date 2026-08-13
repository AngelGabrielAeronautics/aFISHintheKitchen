// Branded templates for the self-serve auth emails (email verification +
// password reset). We generate the Firebase action link server-side (Admin SDK)
// and send it through our own SendGrid sender so deliverability matches the
// invite email — Firebase's default senders land in spam. Mirrors the chrome of
// src/lib/invite-email.ts.
import { FROM_NAME } from "@/lib/email";

const LOGO_URL = "https://www.afishinthekitchen.com/logo.png";
const HEADING_FONT = "'Arial Narrow', Arial, Helvetica, sans-serif";

const COLOR = {
  cream: "#F0EBD8",
  white: "#FFFFFF",
  charcoal: "#1A1A1A",
  slate: "#3D3D3D",
  green: "#3D5A3E",
  muted: "#8A857F",
};

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

// Shared shell: a heading, one or more body lines, a single CTA button, and a
// muted "copy this link" fallback. `bodyLines` are plain text (already safe —
// we never interpolate user input here).
function shell(opts: {
  heading: string;
  bodyLines: string[];
  ctaLabel: string;
  actionUrl: string;
}): { html: string; text: string } {
  const { heading, bodyLines, ctaLabel, actionUrl } = opts;
  const bodyHtml = bodyLines
    .map(
      (line) =>
        `<tr><td style="padding:8px 40px 0 40px;font-size:16px;line-height:1.6;color:${COLOR.slate};">${line}</td></tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:${COLOR.cream};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLOR.charcoal};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.cream};padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:${COLOR.white};border-radius:16px;box-shadow:0 2px 14px rgba(26,26,26,0.08);overflow:hidden;">
            <tr>
              <td align="center" style="padding:36px 40px 0 40px;">
                <img src="${LOGO_URL}" alt="A Fish in the Kitchen" width="120" height="120" style="display:block;border-radius:50%;border:0;outline:none;text-decoration:none;" />
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 0 40px;">
                <h1 style="margin:0;font-family:${HEADING_FONT};font-weight:700;font-size:28px;line-height:1.2;color:${COLOR.charcoal};">${heading}</h1>
              </td>
            </tr>
            ${bodyHtml}
            <tr>
              <td align="center" style="padding:24px 40px 8px 40px;">
                <a href="${actionUrl}" style="display:inline-block;background:${COLOR.green};color:${COLOR.white};text-decoration:none;font-weight:600;padding:14px 32px;border-radius:10px;font-size:15px;">${ctaLabel}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 40px 36px 40px;font-size:13px;line-height:1.6;color:${COLOR.muted};">
                Or copy this link into your browser:<br />
                <a href="${actionUrl}" style="color:${COLOR.green};word-break:break-all;">${actionUrl}</a>
              </td>
            </tr>
          </table>
          <p style="margin:24px 0 0 0;font-style:italic;font-size:13px;color:${COLOR.muted};">A Fish in the Kitchen &mdash; the food your family is built on</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [heading, "", ...bodyLines, "", `${ctaLabel}: ${actionUrl}`, "", "— A Fish in the Kitchen"].join("\n");
  return { html, text };
}

export function buildVerifyEmail(actionUrl: string): BuiltEmail {
  const { html, text } = shell({
    heading: "Confirm your email",
    bodyLines: [
      `Welcome to ${FROM_NAME}! Please confirm this is your email address so you can add recipes and invite your family.`,
      "If you didn't create an account, you can safely ignore this email.",
    ],
    ctaLabel: "Confirm email",
    actionUrl,
  });
  return { subject: `Confirm your email for ${FROM_NAME}`, html, text };
}

// Sent once by the lapse sweep a few days before a signup trial expires —
// without it the first sign of an ended trial is a read-only cookbook.
export function buildTrialEndingEmail(daysLeft: number): BuiltEmail {
  const when = daysLeft <= 1 ? "tomorrow" : `in ${daysLeft} days`;
  const { html, text } = shell({
    heading: "Your free trial is ending soon",
    bodyLines: [
      `Your ${FROM_NAME} free trial ends ${when}. Subscribe in the app to keep adding recipes, planning meals, and cooking together — your family's recipes are safe either way.`,
      "If you don't subscribe, your cookbook becomes read-only for a while before pausing. Nothing is deleted.",
    ],
    ctaLabel: "Keep your cookbook going",
    actionUrl: "https://www.afishinthekitchen.com",
  });
  return { subject: `Your ${FROM_NAME} trial ends ${when}`, html, text };
}

// Sent once by the lapse sweep before a GIFTED year runs out.
//
// ⚠ Not the trial email with a different number. Somebody a year into a gift
// has a real cookbook full of their own food by now, and "your free trial is
// ending" would read as though none of it counted. It also has to name the
// giver — a year is long enough that "your gift" alone is genuinely ambiguous.
export function buildGiftEndingEmail(daysLeft: number, fromName: string): BuiltEmail {
  const when = daysLeft <= 1 ? "tomorrow" : `in ${daysLeft} days`;
  const from = fromName.trim();
  const { html, text } = shell({
    heading: "Your gifted year is nearly up",
    bodyLines: [
      from
        ? `The year of ${FROM_NAME} that ${from} gave you ends ${when}.`
        : `Your gifted year of ${FROM_NAME} ends ${when}.`,
      "Subscribe in the app to carry on where you left off. Every recipe, photo and note stays exactly as it is — nothing is deleted, and your cookbook stays yours.",
    ],
    ctaLabel: "Keep your cookbook going",
    actionUrl: "https://www.afishinthekitchen.com",
  });
  return { subject: `Your ${FROM_NAME} gift ends ${when}`, html, text };
}

/**
 * Escape for interpolation into an email body.
 *
 * ⚠ The `shell` helper above says its bodyLines are "already safe — we never
 * interpolate user input here". The gift card is the first template that
 * breaks that assumption: it carries a recipient's name, the giver's name and
 * a free-text personal message, all typed by a member of the public. Anything
 * from those three goes through here first. Without it, a message containing
 * markup is delivered as markup, and the send is to a THIRD PARTY who never
 * used our app — the worst possible audience for it.
 */
function esc(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The gift card itself — sent to the RECIPIENT, who has almost certainly never
 * heard of us. It has to explain what the thing is before it asks for anything.
 *
 * ⚠ Sent to somebody who did not sign up. Keep it a single, obvious message
 * with one action; anything resembling a newsletter to a stranger is spam,
 * however well meant.
 */
export function buildGiftCardEmail(opts: {
  recipientName: string;
  fromName: string;
  message: string;
  code: string;
  redeemUrl: string;
}): BuiltEmail {
  const to = esc(opts.recipientName.trim());
  const from = esc(opts.fromName.trim());
  const note = esc(opts.message.trim());
  const code = esc(opts.code);

  const lines = [
    to ? `${to}, you have been given a year of ${FROM_NAME}.` : `You have been given a year of ${FROM_NAME}.`,
    from ? `It is from ${from}.` : "",
    note ? `<em style="color:${COLOR.slate};">&ldquo;${note}&rdquo;</em>` : "",
    `${FROM_NAME} is a private cookbook for your family's recipes — somewhere to keep them, cook them hands-free at the stove, plan the week and share a shopping list.`,
    // Say plainly that the book is theirs. The obvious assumption on receiving
    // this is that you are being added to somebody else's cookbook, and that is
    // exactly what a gift is NOT.
    `The cookbook will be <strong>yours</strong> — your own, private, with room to invite five people of your own into it.`,
    `Your code is <strong style="font-family:monospace;letter-spacing:2px;">${code}</strong>`,
  ].filter(Boolean);

  const { html, text } = shell({
    heading: to ? `A gift for ${to}` : "A gift for you",
    bodyLines: lines,
    ctaLabel: "Open your gift",
    actionUrl: opts.redeemUrl,
  });
  return {
    subject: from ? `${from} has given you a year of ${FROM_NAME}` : `A gift: a year of ${FROM_NAME}`,
    html,
    text,
  };
}

export function buildResetEmail(actionUrl: string): BuiltEmail {
  const { html, text } = shell({
    heading: "Reset your password",
    bodyLines: [
      `We received a request to reset the password for your ${FROM_NAME} account.`,
      "If you didn't ask for this, you can safely ignore this email — your password won't change.",
    ],
    ctaLabel: "Reset password",
    actionUrl,
  });
  return { subject: `Reset your ${FROM_NAME} password`, html, text };
}
