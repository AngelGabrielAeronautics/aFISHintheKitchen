// Shared builder for the transactional "you've been invited" email. Lives in
// one place so the server-side /api/invite route is the single source of truth
// for both invite enforcement and the email it sends.
import { FROM_NAME } from "@/lib/email";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/app-links";

// Absolute, always-reachable brand asset for the email header (email clients
// can't load localhost / relative paths).
const LOGO_URL = "https://www.afishinthekitchen.com/logo.png";
// Email-safe stand-in for the app's heading font (Francois One — a bold,
// condensed sans). Email clients can't load web fonts, so fall back gracefully.
const HEADING_FONT = "'Arial Narrow', Arial, Helvetica, sans-serif";

// App palette (globals.css) for an on-brand email. Note "terracotta" is green.
const COLOR = {
  cream: "#F0EBD8",
  white: "#FFFFFF",
  charcoal: "#1A1A1A",
  slate: "#3D3D3D",
  green: "#3D5A3E",
  greenDark: "#2D4A2E",
  sage: "#6B7D5E",
  muted: "#8A857F",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface InviteEmailParams {
  email: string;
  name: string;
  inviterName: string;
  householdName?: string;
  /** The app's /auth URL; invitee details are appended as query params. */
  signupUrl: string;
}

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

export function buildInviteEmail({
  email,
  name,
  inviterName,
  householdName,
  signupUrl,
}: InviteEmailParams): BuiltEmail {
  const subject = householdName
    ? `${inviterName} invited you to ${householdName} on ${FROM_NAME}`
    : `${inviterName} invited you to ${FROM_NAME}`;

  const safeName = escapeHtml(name);
  const safeInviter = escapeHtml(inviterName);
  const safeHousehold = householdName ? escapeHtml(householdName) : null;
  // Carry the invitee's details so /auth can greet them, prefill + lock the
  // email, and just ask for a password. Auth/join still verify server-side.
  const safeUrl =
    `${signupUrl}?email=${encodeURIComponent(email)}` +
    `&name=${encodeURIComponent(name)}` +
    (householdName ? `&book=${encodeURIComponent(householdName)}` : "");

  const intro = safeHousehold
    ? `<strong>${safeInviter}</strong> has invited you to join <strong>${safeHousehold}</strong> &mdash; your family&rsquo;s private cookbook for recipes, meal plans, and kitchen tips.`
    : `<strong>${safeInviter}</strong> has invited you to join <strong>A Fish in the Kitchen</strong> &mdash; a private family cookbook for recipes, meal plans, and kitchen tips.`;

  // One quiet line of the ethos (see project_brand_story) — this email is the
  // moment a family member is pulled in, so it carries the legacy thesis.
  const story = "It’s where our family’s recipes live now — so the ones worth keeping get passed down, not lost.";

  // Reassure the invitee there's no cost — the owner pays the subscription.
  const freeNote = `Joining is completely free &mdash; ${safeInviter} covers the subscription. All you need to do is choose a password.`;

  // The button depends on this email being opened on a phone. Spell out the
  // self-sufficient path too: get the app, sign up with THIS address (the
  // address IS the invitation — /api/join matches on it), and the cookbook
  // opens automatically. Without this, an invitee reading on a laptop, or one
  // who downloads the app on their own, has no instructions at all.
  const howTo =
    `A Fish in the Kitchen is an app for iPhone, iPad and Android. ` +
    `Download it, then sign up using <strong>${escapeHtml(email)}</strong> &mdash; ` +
    `this address is your invitation, so the cookbook opens automatically.`;

  const storeLinks =
    `<a href="${APP_STORE_URL}" style="display:inline-block;margin:0 6px;padding:10px 18px;border:1px solid ${COLOR.charcoal};border-radius:8px;color:${COLOR.charcoal};text-decoration:none;font-size:13px;font-weight:600;">App Store</a>` +
    (PLAY_STORE_URL
      ? `<a href="${PLAY_STORE_URL}" style="display:inline-block;margin:0 6px;padding:10px 18px;border:1px solid ${COLOR.charcoal};border-radius:8px;color:${COLOR.charcoal};text-decoration:none;font-size:13px;font-weight:600;">Google Play</a>`
      : "");

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
                <h1 style="margin:0;font-family:${HEADING_FONT};font-weight:700;font-size:30px;line-height:1.2;color:${COLOR.charcoal};">Hi ${safeName},</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 40px 4px 40px;font-size:16px;line-height:1.6;color:${COLOR.slate};">
                ${intro}
              </td>
            </tr>
            <tr>
              <td style="padding:4px 40px 18px 40px;font-style:italic;font-size:16px;line-height:1.6;color:${COLOR.sage};">
                ${story}
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 20px 40px;">
                <div style="background:${COLOR.cream};border-radius:10px;padding:14px 16px;font-size:14px;line-height:1.5;color:${COLOR.greenDark};">
                  ${freeNote}
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 40px 8px 40px;">
                <a href="${safeUrl}" style="display:inline-block;background:${COLOR.green};color:${COLOR.white};text-decoration:none;font-weight:600;padding:14px 32px;border-radius:10px;font-size:15px;">Accept invitation</a>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px 6px 40px;font-size:14px;line-height:1.6;color:${COLOR.slate};">
                ${howTo}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 40px 16px 40px;">
                ${storeLinks}
              </td>
            </tr>
            <tr>
              <td style="padding:4px 40px 36px 40px;font-size:13px;line-height:1.6;color:${COLOR.muted};">
                Or copy this link into your browser:<br />
                <a href="${safeUrl}" style="color:${COLOR.green};word-break:break-all;">${safeUrl}</a>
              </td>
            </tr>
          </table>
          <p style="margin:24px 0 0 0;font-style:italic;font-size:13px;color:${COLOR.muted};">A Fish in the Kitchen &mdash; the food your family is built on</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `Hi ${name},`,
    "",
    householdName
      ? `${inviterName} has invited you to join ${householdName} — your family's private cookbook for recipes, meal plans, and kitchen tips.`
      : `${inviterName} has invited you to join A Fish in the Kitchen — a private family cookbook for recipes, meal plans, and kitchen tips.`,
    "",
    story.replace(/[’]/g, "'"),
    "",
    `Joining is completely free — ${inviterName} covers the subscription. All you need to do is choose a password.`,
    "",
    `Accept your invitation: ${safeUrl}`,
    "",
    `A Fish in the Kitchen is an app for iPhone, iPad and Android. Download it, then sign up using ${email} — this address is your invitation, so the cookbook opens automatically.`,
    "",
    `App Store: ${APP_STORE_URL}`,
    ...(PLAY_STORE_URL ? [`Google Play: ${PLAY_STORE_URL}`] : []),
    "",
    "— A Fish in the Kitchen",
  ].join("\n");

  return { subject, html, text };
}
