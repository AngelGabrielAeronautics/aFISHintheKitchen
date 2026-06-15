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
