import { NextRequest, NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL ?? "invites@afishinthekitchen.com";
const FROM_NAME = "A Fish in the Kitchen";

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
    const safeUrl = encodeURI(signupUrl);

    const intro = safeHousehold
      ? `<strong>${safeInviter}</strong> has invited you to join <strong>${safeHousehold}</strong> on A Fish in the Kitchen — a private family cookbook for sharing recipes, meal plans, and kitchen tips.`
      : `<strong>${safeInviter}</strong> has invited you to join A Fish in the Kitchen — a private family cookbook for sharing recipes, meal plans, and kitchen tips.`;

    // One quiet line of the ethos (see project_brand_story) — this email is the
    // moment a family member is pulled in, so it carries the legacy thesis.
    const story = "It’s where our family’s recipes live now — so the ones worth keeping get passed down, not lost.";

    const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#faf6f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#2d2a26;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
            <tr>
              <td style="padding:40px 40px 0 40px;">
                <h1 style="margin:0 0 8px 0;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;color:#2d2a26;">Hi ${safeName},</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 40px 4px 40px;font-size:16px;line-height:1.6;color:#4a4540;">
                ${intro}
              </td>
            </tr>
            <tr>
              <td style="padding:4px 40px 16px 40px;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:16px;line-height:1.6;color:#6b6660;">
                ${story}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:16px 40px 8px 40px;">
                <a href="${safeUrl}" style="display:inline-block;background:#c06a4a;color:#ffffff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:10px;font-size:15px;">Accept invitation</a>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 40px 40px 40px;font-size:13px;line-height:1.6;color:#8a857f;">
                Or copy this link into your browser:<br />
                <a href="${safeUrl}" style="color:#c06a4a;word-break:break-all;">${safeUrl}</a>
              </td>
            </tr>
          </table>
          <p style="margin:24px 0 0 0;font-size:12px;color:#a8a39d;">A Fish in the Kitchen — the food your family is built on</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    const text = [
      `Hi ${name},`,
      "",
      householdName
        ? `${inviterName} has invited you to join ${householdName} on A Fish in the Kitchen — a private family cookbook for sharing recipes, meal plans, and kitchen tips.`
        : `${inviterName} has invited you to join A Fish in the Kitchen — a private family cookbook for sharing recipes, meal plans, and kitchen tips.`,
      "",
      story.replace(/[’]/g, "'"),
      "",
      `Accept your invitation: ${signupUrl}`,
      "",
      "— A Fish in the Kitchen",
    ].join("\n");

    await sgMail.send({
      to: email,
      from: { email: FROM_EMAIL, name: FROM_NAME },
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
