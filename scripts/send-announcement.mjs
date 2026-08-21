// One-off announcement to the people who already use the app.
//
//   node scripts/send-announcement.mjs                 # dry run: lists recipients, writes a preview, sends NOTHING
//   node scripts/send-announcement.mjs --only you@x    # send a single test copy to yourself
//   node scripts/send-announcement.mjs --send          # the real thing
//
// ⚠ THIS IS NOT TRANSACTIONAL MAIL. lib/email.ts deliberately bypasses
// SendGrid's unsubscribe handling so an invite can never be silently dropped;
// doing that for an announcement would be wrong (and, at scale, illegal), so
// this script does NOT bypass suppression and carries its own opt-out line.
//
// ⚠ ONE MESSAGE PER RECIPIENT, never a shared To or BCC. A single message
// addressed to everybody would hand every user the email address of every
// other user — the families in here do not know each other.
//
// ⚠ It reads the PRODUCTION SendGrid identity, not .env.local's. The local
// file still holds the pre-2026-07-09 sender (`noreply@afishinthekitchen.com`),
// which is a Workspace address and makes Gmail show the wrong org logo. The
// live apps send from the `mail.` subdomain instead.
//
// The markup below mirrors lib/auth-email.ts by hand because a plain .mjs
// script cannot import the app's TypeScript. The templates there remain the
// source of truth for real product email; if this is ever run again, check it
// still matches them.

import { readFileSync, writeFileSync } from "node:fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import sgMail from "@sendgrid/mail";

const SITE_URL = "https://www.afishinthekitchen.com";
const LOGO_URL = `${SITE_URL}/logo.png`;
const COLOR = {
  cream: "#F5EFE3",
  white: "#FFFFFF",
  charcoal: "#1A1A1A",
  slate: "#4A4A4A",
  muted: "#8A8A8A",
  green: "#2F4F3A",
};
const HEADING_FONT = "Georgia,'Times New Roman',serif";

// Never write to these. The first two are Apple's: `demo@` is the account App
// Review signs into and `John Apple` is the reviewer who bought a sandbox year
// during the 1.5 review — mailing either would put our marketing in front of
// the people who decide whether we ship. The third is a test login.
const NEVER_EMAIL = new Set([
  "demo@afishinthekitchen.com",
  "rmdjz9nbwm@privaterelay.appleid.com",
  "dylan@coppard.co.za",
]);

const args = process.argv.slice(2);
const SEND = args.includes("--send");
// ⚠ Written carefully because the clever one-liner here silently addressed the
// whole run to the literal string "--send": with no --only flag, indexOf
// returned -1 and args[-1 + 1] is args[0]. It reported "0 recipients" and
// "0/0 sent" and exited 0 — a confident zero that had measured nothing.
const onlyEq = args.find((a) => a.startsWith("--only="));
const onlyIdx = args.indexOf("--only");
const ONLY = onlyEq
  ? onlyEq.slice("--only=".length)
  : onlyIdx !== -1
    ? args[onlyIdx + 1]
    : null;
const SKIP_NO_COOKBOOK = args.includes("--skip-no-cookbook");

function readEnvVar(name, file = "../.env.local") {
  const text = readFileSync(new URL(file, import.meta.url), "utf-8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1 || t.slice(0, eq).trim() !== name) continue;
    return t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

// ── The letter ──────────────────────────────────────────────────────────────
// Written for BOTH platforms in one email because nothing in our data records
// which phone a person carries — deviceTokens stores no platform.
//
// ⚠ IT WAS BOTH PHONES, and the first draft of this letter said Android only.
// The two faults are unrelated and look identical from the kitchen: on Android
// the "+" sat behind the navigation bar (54c59ef), and on iOS a brand-new
// cookbook's empty state carried NO action at all, so the floating "+" was the
// only route in and anyone who could not see it was stuck (0f38cda, reported
// by Meg on 2026-08-14). Naming which phone each fault belongs to is what
// keeps the apology true for whoever is reading it.
const SUBJECT = "Sorry about that — and what's new";
const HEADING = "Sorry about that";
const PARAGRAPHS = [
  "If you tried to add a recipe recently and couldn't, that was us, not you — and I'm sorry. Adding a recipe is the whole point of the app.",
  // ⚠ "both phones" carries the whole correction: the fault was Android's "+"
  // hidden behind the navigation bar (54c59ef) AND, separately, an iOS empty
  // cookbook that offered no way in at all (0f38cda, Meg on 2026-08-14). The
  // detail is gone from the letter, not from the truth of it.
  "It's fixed on both phones, and the updates are live now — on the App Store today, and on Google Play since Tuesday.",
  "We're building on this all the time. If something is broken, missing, or just annoying — <strong>reply to this email</strong>. It comes straight to me.",
  "Thank you for cooking with us.<br />— Dylan",
];
const CTA_LABEL = "Get the update";
const OPT_OUT = "You're getting this because you have an A Fish in the Kitchen account. If you'd rather not get the occasional note like this, just reply and say so.";

function stripTags(html) {
  return html
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&mdash;/g, "—").replace(/&rsquo;/g, "’").replace(/&amp;/g, "&")
    .replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”");
}

function buildEmail() {
  const para = (html) =>
    `<tr><td style="padding:0 40px 18px 40px;font-size:16px;line-height:1.65;color:${COLOR.slate};">${html}</td></tr>`;

  const html = `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
  <body style="margin:0;padding:0;background:${COLOR.cream};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLOR.charcoal};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.cream};padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:${COLOR.white};border-radius:16px;box-shadow:0 2px 14px rgba(26,26,26,0.08);overflow:hidden;">
            <tr>
              <td align="center" style="padding:40px 40px 4px 40px;">
                <a href="${SITE_URL}" style="text-decoration:none;border:0;"><img src="${LOGO_URL}" alt="A Fish in the Kitchen" width="120" height="120" style="display:block;border-radius:50%;border:0;outline:none;text-decoration:none;" /></a>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 40px 18px 40px;">
                <h1 style="margin:0;font-family:${HEADING_FONT};font-weight:700;font-size:30px;line-height:1.15;color:${COLOR.charcoal};">${HEADING}</h1>
              </td>
            </tr>
            ${PARAGRAPHS.map(para).join("")}
            <tr>
              <td align="center" style="padding:10px 40px 8px 40px;">
                <a href="${SITE_URL}" style="display:inline-block;background:${COLOR.green};color:${COLOR.white};text-decoration:none;font-weight:600;padding:15px 36px;border-radius:10px;font-size:16px;">${CTA_LABEL}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 40px 30px 40px;font-size:13px;line-height:1.6;color:${COLOR.muted};">
                Both stores are linked from <a href="${SITE_URL}" style="color:${COLOR.green};">www.afishinthekitchen.com</a> — or just open the App Store or Google Play and check for updates.
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 34px 40px;border-top:1px solid #EEE8DC;">
                <p style="margin:16px 0 0 0;font-size:12px;line-height:1.6;color:${COLOR.muted};">${OPT_OUT}</p>
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
    HEADING,
    "",
    ...PARAGRAPHS.map(stripTags),
    "",
    `${CTA_LABEL}: ${SITE_URL}`,
    "",
    OPT_OUT,
    "",
    "— A Fish in the Kitchen",
    SITE_URL,
  ].join("\n");

  return { html, text };
}

// ── Recipients ──────────────────────────────────────────────────────────────
const b64 = readEnvVar("FIREBASE_SERVICE_ACCOUNT_B64");
if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(Buffer.from(b64, "base64").toString("utf-8"))) });
}
const db = getFirestore();

const members = await db.collection("householdMembers").get();
const inACookbook = new Set(members.docs.map((d) => d.data().userId).filter(Boolean));

const page = await getAuth().listUsers(1000);
let recipients = page.users
  .filter((u) => u.email)
  .map((u) => ({ email: u.email, name: u.displayName ?? "", hasCookbook: inACookbook.has(u.uid) }))
  .filter((r) => !NEVER_EMAIL.has(r.email.toLowerCase()))
  .filter((r) => (SKIP_NO_COOKBOOK ? r.hasCookbook : true));

if (ONLY) recipients = recipients.filter((r) => r.email.toLowerCase() === ONLY.toLowerCase());

const { html, text } = buildEmail();

const previewPath = new URL("../.announcement-preview.html", import.meta.url);
writeFileSync(previewPath, html);

console.log(`Subject: ${SUBJECT}`);
console.log(`Preview written to ${previewPath.pathname}\n`);
console.log(`${recipients.length} recipient(s):`);
recipients.forEach((r) => console.log(`  ${r.email.padEnd(36)} ${r.name || "-"}${r.hasCookbook ? "" : "   (no cookbook)"}`));
console.log(`\nExcluded by name: ${[...NEVER_EMAIL].join(", ")}`);

if (recipients.length === 0) {
  console.error("\nNo recipients matched — refusing to report a send that reached nobody.");
  process.exit(1);
}

if (!SEND && !ONLY) {
  console.log("\nDRY RUN — nothing sent. Add --send to send it for real.");
  process.exit(0);
}

// ── Send ────────────────────────────────────────────────────────────────────
// Production identity, read from the file `vercel env pull --environment=
// production` wrote. Falls back to nothing rather than quietly sending from
// the wrong address.
const from = readEnvVar("SENDGRID_FROM_EMAIL", "../.env.production.local") ?? null;
const replyTo = readEnvVar("SENDGRID_REPLY_TO_EMAIL", "../.env.production.local") ?? null;
// ⚠ `||`, not `??`. Vercel pulls sensitive values as an EMPTY STRING rather
// than omitting them, and "" is not null — with `??` the fallback never fired
// and the send died claiming the config was missing when the key was sitting
// in .env.local all along.
const apiKey = readEnvVar("SENDGRID_API_KEY", "../.env.production.local") || readEnvVar("SENDGRID_API_KEY");
if (!from || !replyTo || !apiKey) {
  console.error("\nMissing production SendGrid config. Run:\n  npx vercel env pull --environment=production .env.production.local");
  process.exit(1);
}
console.log(`\nSending from ${from} (replies to ${replyTo})…`);
sgMail.setApiKey(apiKey);

let sent = 0;
for (const r of recipients) {
  try {
    await sgMail.send({
      to: r.email,
      from: { email: from, name: "A Fish in the Kitchen" },
      replyTo: { email: replyTo, name: "Dylan at A Fish in the Kitchen" },
      subject: SUBJECT,
      html,
      text,
      // ⚠ The opposite of lib/email.ts on both counts, and deliberately so:
      // this is an announcement, so a suppression must be honoured and no
      // unsubscribe machinery is bypassed.
      trackingSettings: { subscriptionTracking: { enable: false } },
      mailSettings: { bypassUnsubscribeManagement: { enable: false } },
    });
    sent++;
    console.log(`  sent → ${r.email}`);
  } catch (err) {
    // One bad address must not stop the rest of the list.
    console.error(`  FAILED → ${r.email}:`, err?.response?.body ?? err.message);
  }
}
console.log(`\n${sent}/${recipients.length} sent.`);
