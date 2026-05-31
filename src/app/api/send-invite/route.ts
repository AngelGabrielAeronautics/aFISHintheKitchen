import { NextRequest, NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL ?? "noreply@afishinthekitchen.com";
const FROM_NAME = "A Fish in the Kitchen";
// noreply sends, but replies should reach a real inbox.
const REPLY_TO_EMAIL = process.env.SENDGRID_REPLY_TO_EMAIL ?? "admin@afishinthekitchen.com";
// Absolute, always-reachable brand asset for the email header (email clients
// can't load localhost / relative paths).
const LOGO_URL = "https://www.afishinthekitchen.com/logo.png";

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

interface InviteBody {
  email: string;
  name: string;
  inviterName: string;
  householdName?: string;
  signupUrl: string;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
    }
    sgMail.setApiKey(apiKey);

    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    let callerEmail: string | undefined;
    try {
      const decoded = await getAdminAuth().verifyIdToken(token);
      callerEmail = decoded.email?.toLowerCase().trim();
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    if (!callerEmail) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const settingsSnap = await getAdminDb().doc("config/settings").get();
    const adminEmails: string[] = settingsSnap.exists
      ? (settingsSnap.data()?.adminEmails ?? [])
      : [];
    if (!adminEmails.map((e) => e.toLowerCase().trim()).includes(callerEmail)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as Partial<InviteBody>;
    const { email, name, inviterName, householdName, signupUrl } = body;
    if (!email || !name || !inviterName || !signupUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

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

    const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:${COLOR.cream};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLOR.charcoal};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.cream};padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:${COLOR.white};border-radius:16px;box-shadow:0 2px 14px rgba(26,26,26,0.08);overflow:hidden;">
            <tr>
              <td align="center" style="padding:36px 40px 0 40px;">
                <img src="${LOGO_URL}" alt="A Fish in the Kitchen" width="60" height="60" style="display:block;border-radius:50%;border:0;outline:none;text-decoration:none;" />
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 0 40px;">
                <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.2;color:${COLOR.charcoal};">Hi ${safeName},</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 40px 4px 40px;font-size:16px;line-height:1.6;color:${COLOR.slate};">
                ${intro}
              </td>
            </tr>
            <tr>
              <td style="padding:4px 40px 18px 40px;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:16px;line-height:1.6;color:${COLOR.sage};">
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
              <td style="padding:12px 40px 36px 40px;font-size:13px;line-height:1.6;color:${COLOR.muted};">
                Or copy this link into your browser:<br />
                <a href="${safeUrl}" style="color:${COLOR.green};word-break:break-all;">${safeUrl}</a>
              </td>
            </tr>
          </table>
          <p style="margin:24px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:13px;color:${COLOR.muted};">A Fish in the Kitchen &mdash; the food your family is built on</p>
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
      "— A Fish in the Kitchen",
    ].join("\n");

    await sgMail.send({
      to: email,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      replyTo: { email: REPLY_TO_EMAIL, name: FROM_NAME },
      subject,
      html,
      text,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("send-invite error:", err);
    return NextResponse.json({ error: "Failed to send invite" }, { status: 500 });
  }
}
