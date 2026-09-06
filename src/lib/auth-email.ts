// Branded templates for the self-serve auth emails (email verification +
// password reset). We generate the Firebase action link server-side (Admin SDK)
// and send it through our own SendGrid sender so deliverability matches the
// invite email — Firebase's default senders land in spam. Mirrors the chrome of
// src/lib/invite-email.ts.
import { FROM_NAME } from "@/lib/email";

/** The site itself. Every email links back to it — see the footer. */
const SITE_URL = "https://www.afishinthekitchen.com";
const LOGO_URL = "https://www.afishinthekitchen.com/logo.png";
/**
 * The gift-branded mark — the fish wearing a bow.
 *
 * ⚠ A SEPARATE FILE from the app logo, flattened onto the brand cream rather
 * than transparent: some mail clients still render PNG alpha badly, and every
 * one of them renders a flat image correctly. The transparent version lives at
 * /gift-logo.png and is for the web page.
 */
const GIFT_LOGO_URL = "https://www.afishinthekitchen.com/gift-logo-email.png";
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

// ⚠ The <head> carries an explicit charset. SendGrid does set utf-8 on the MIME
// part, so this is belt-and-braces — but every line of this copy uses em dashes
// and curly quotes, and a client that falls back to windows-1252 renders them as
// "â€"" in somebody's inbox. One line to remove the possibility.
//
// Shared shell: a heading, one or more body lines, a single CTA button, and a
// muted "copy this link" fallback. `bodyLines` are plain text (already safe —
// we never interpolate user input here).
/**
 * A row in an email body.
 *
 * ⚠ Exists because the gift card was a WALL OF EQUAL PARAGRAPHS — the personal
 * note and the code, the only two things on the page that carry any weight,
 * rendered exactly like the boilerplate around them. Types let a template give
 * those presence while every email keeps the same chrome.
 */
export type EmailRow =
  | { kind: "p"; html: string }
  /** A pull-quote: left rule, warm ground. Mirrors the recipe story block. */
  | { kind: "quote"; html: string }
  /** A boxed, letter-spaced code. */
  | { kind: "code"; label: string; value: string };

/** Plain-text form of a row: entities decoded, tags removed. */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&mdash;/g, "—").replace(/&rsquo;/g, "’")
    .replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function shell(opts: {
  heading: string;
  bodyLines: string[];
  /** Richer alternative to bodyLines; when present, bodyLines is ignored. */
  bodyRows?: EmailRow[];
  ctaLabel: string;
  actionUrl: string;
  /**
   * Overrides the round app logo. ⚠ `round` must be false for any mark that
   * is not square — the default crops to a circle, which would take the bow
   * clean off the gift logo.
   */
  logo?: { url: string; width: number; height: number; round?: boolean };
}): { html: string; text: string } {
  const { heading, bodyLines, ctaLabel, actionUrl } = opts;
  const logo = opts.logo ?? { url: LOGO_URL, width: 120, height: 120, round: true };
  // ⚠ 18px between paragraphs, not 8. At 8 the lines packed into a slab with
  // no rhythm — the reader had nothing to rest on and no sense of where one
  // thought ended.
  const para = (html: string) =>
    `<tr><td style="padding:0 40px 18px 40px;font-size:16px;line-height:1.65;color:${COLOR.slate};">${html}</td></tr>`;

  const rows: EmailRow[] =
    opts.bodyRows ?? bodyLines.map((line) => ({ kind: "p", html: line }) as EmailRow);

  const bodyHtml = rows
    .map((row) => {
      if (row.kind === "quote") {
        // Left rule + warm ground: the same treatment a recipe's story gets in
        // the app, so a handwritten note looks like the app's own voice.
        return `<tr><td style="padding:6px 40px 22px 40px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.cream};border-radius:10px;">
            <tr>
              <td width="4" style="background:${COLOR.green};border-radius:10px 0 0 10px;font-size:0;line-height:0;">&nbsp;</td>
              <td style="padding:16px 20px;font-size:16px;line-height:1.6;color:${COLOR.slate};font-style:italic;">${row.html}</td>
            </tr>
          </table>
        </td></tr>`;
      }
      if (row.kind === "code") {
        return `<tr><td style="padding:6px 40px 24px 40px;" align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" style="border:1px dashed ${COLOR.muted};border-radius:12px;">
            <tr><td align="center" style="padding:16px 28px;">
              <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${COLOR.muted};padding-bottom:6px;">${row.label}</div>
              <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:26px;font-weight:700;letter-spacing:5px;color:${COLOR.charcoal};">${row.value}</div>
            </td></tr>
          </table>
        </td></tr>`;
      }
      return para(row.html);
    })
    .join("");

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
                <a href="${SITE_URL}" style="text-decoration:none;border:0;"><img src="${logo.url}" alt="A Fish in the Kitchen" width="${logo.width}" height="${logo.height}" style="display:block;${logo.round === false ? "" : "border-radius:50%;"}border:0;outline:none;text-decoration:none;" /></a>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 40px 18px 40px;">
                <h1 style="margin:0;font-family:${HEADING_FONT};font-weight:700;font-size:30px;line-height:1.15;color:${COLOR.charcoal};">${heading}</h1>
              </td>
            </tr>
            ${bodyHtml}
            <tr>
              <td align="center" style="padding:10px 40px 8px 40px;">
                <a href="${actionUrl}" style="display:inline-block;background:${COLOR.green};color:${COLOR.white};text-decoration:none;font-weight:600;padding:15px 36px;border-radius:10px;font-size:16px;">${ctaLabel}</a>
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
          <p style="margin:10px 0 0 0;font-size:14px;">
            <a href="${SITE_URL}" style="color:${COLOR.green};font-weight:600;text-decoration:underline;">www.afishinthekitchen.com</a>
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  // ⚠ Built from `rows`, not bodyLines — the gift card passes rows only, and
  // reading bodyLines here shipped it with an EMPTY text/plain part. Plenty of
  // clients (and every spam filter) read that half.
  const textLines = rows.map((r) =>
    // ⚠ No extra quotes around a quote row — it already carries its own.
    r.kind === "code" ? `${r.label}: ${r.value}` : stripTags(r.html)
  );
  const text = [heading, "", ...textLines, "", `${ctaLabel}: ${actionUrl}`, "", "— A Fish in the Kitchen", SITE_URL].join("\n");
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

// A member asked the owner to let somebody in (lib/member-requests.ts). The
// owner is the only one who can add people, so this is the nudge that turns
// their member's request into a decision — nobody else can make it.
export function buildMemberRequestEmail(opts: {
  requesterName: string;
  forName: string;
  bookName: string;
  note?: string;
}): BuiltEmail {
  const { requesterName, forName, bookName, note } = opts;
  const { html, text } = shell({
    heading: `${requesterName} wants to add someone`,
    bodyLines: [
      `${requesterName} has asked to add <strong>${forName}</strong> to ${bookName}.`,
      ...(note ? [`They said: “${note}”`] : []),
      `Open the app and go to Invite — approve it and a join code is made, which ${requesterName} can pass on to ${forName} themselves. You can also say no; nothing happens until you decide.`,
    ],
    ctaLabel: "Open the app",
    actionUrl: "https://www.afishinthekitchen.com",
  });
  return { subject: `${requesterName} wants to add ${forName} to ${bookName}`, html, text };
}

// The answer, back to whoever asked. Approved carries the code — they are the
// one who knows the person, so they are the one who passes it on.
export function buildMemberRequestDecidedEmail(opts: {
  forName: string;
  bookName: string;
  approved: boolean;
  code?: string;
}): BuiltEmail {
  const { forName, bookName, approved, code } = opts;
  if (!approved) {
    const { html, text } = shell({
      heading: "Not this time",
      bodyLines: [
        `Your request to add <strong>${forName}</strong> to ${bookName} wasn’t approved.`,
        "If you think it was a mistake, have a word with whoever owns the cookbook — they can add anyone at any time.",
      ],
      ctaLabel: "Open the app",
      actionUrl: "https://www.afishinthekitchen.com",
    });
    return { subject: `About adding ${forName} to ${bookName}`, html, text };
  }
  const pretty = code && code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code ?? "";
  const { html, text } = shell({
    heading: `${forName} can join`,
    bodyLines: [
      `Your request to add <strong>${forName}</strong> to ${bookName} was approved.`,
      `Their join code is <strong>${pretty}</strong>. Send it to them any way you like — they open the app, sign in with whatever account they already have, and enter it under “Join a cookbook”.`,
      "It works once and lasts seven days.",
    ],
    ctaLabel: "Open the app",
    actionUrl: "https://www.afishinthekitchen.com",
  });
  return { subject: `${forName} can join ${bookName}`, html, text };
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

// Sent once by the lapse sweep the day a signup trial actually expires.
// The "ending soon" warning above fires days earlier and can be missed or
// spam-foldered; without this, the next thing the owner hears from us is a
// read-only cookbook a week later. Honest about the ladder, no false urgency.
export function buildTrialEndedEmail(): BuiltEmail {
  const { html, text } = shell({
    heading: "Your free trial has ended",
    bodyLines: [
      `Your ${FROM_NAME} free trial ended today. Everything is still there — every recipe, photo and note is safe, and nothing has been deleted.`,
      "You have full access for the next 7 days. After that your cookbook becomes read-only, so subscribe in the app whenever you're ready to keep adding to it.",
    ],
    ctaLabel: "Keep your cookbook going",
    actionUrl: "https://www.afishinthekitchen.com",
  });
  return { subject: `Your ${FROM_NAME} trial has ended`, html, text };
}

// Sent when a super-admin extends someone's trial.
//
// ⚠ Unlike the comp email this SHOULD send every time. Comping twice is the
// same gift stated twice; extending twice is genuinely more time, and the new
// date is the whole point of the message.
//
// ⚠ It must not read as "your trial has ended" — the lapse sweep already sends
// that, and the two landing together would be baffling. This one only ever
// says the deadline moved outwards.
export function buildTrialExtendedEmail(endsAt: string): BuiltEmail {
  const when = new Date(endsAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const { html, text } = shell({
    heading: "We've extended your trial",
    bodyLines: [
      `We've added more time to your ${FROM_NAME} trial — it now runs until ${when}, with everything unlocked.`,
      "Keep adding recipes, bring the family in, and cook hands-free at the stove. Nothing is deleted when a trial ends, so your cookbook stays yours either way.",
      "If you have any questions, just reply to this email — it comes straight to us.",
    ],
    ctaLabel: "Open your cookbook",
    actionUrl: "https://www.afishinthekitchen.com",
  });
  return { subject: `Your ${FROM_NAME} trial now runs until ${when}`, html, text };
}

// Sent when a super-admin comps a subscription — we have given this household
// the app for nothing.
//
// ⚠ Not the gift email. A gift comes from another CUSTOMER and runs for a year,
// so that one names the giver and counts down. This comes from US and has no
// end date, so it must not imply either: no "your gift from…", no "expires on…".
// Somebody who reads a deadline into it will spend the year waiting to be
// charged.
//
// ⚠ It also must not read as an apology. Comping is usually generosity, not
// compensation, and "sorry for the trouble" invents a problem they may not have
// had.
export function buildCompedEmail(): BuiltEmail {
  const { html, text } = shell({
    heading: "Your cookbook is on us",
    bodyLines: [
      `We've unlocked ${FROM_NAME} for you, free of charge — there's no subscription to pay and nothing to renew.`,
      "Everything is open: add as many recipes as you like, bring the family in, and cook hands-free at the stove. Your cookbook stays yours either way.",
      "If you have any questions, just reply to this email — it comes straight to us.",
    ],
    ctaLabel: "Open your cookbook",
    actionUrl: "https://www.afishinthekitchen.com",
  });
  return { subject: `Your ${FROM_NAME} cookbook is on us`, html, text };
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

// Sent once by the lapse sweep the day a gifted year actually runs out —
// the same gap the trial-ended email closes: the pre-warning above can be
// missed, and without this the next thing they hear is a read-only cookbook.
// Names the giver for the same reason the warning does.
export function buildGiftEndedEmail(fromName: string): BuiltEmail {
  const from = fromName.trim();
  const { html, text } = shell({
    heading: "Your gifted year has ended",
    bodyLines: [
      from
        ? `The year of ${FROM_NAME} that ${from} gave you ended today. Everything you've added is still there — every recipe, photo and note is safe, and nothing has been deleted.`
        : `Your gifted year of ${FROM_NAME} ended today. Everything you've added is still there — every recipe, photo and note is safe, and nothing has been deleted.`,
      "You have full access for the next 7 days. After that your cookbook becomes read-only, so subscribe in the app whenever you're ready to keep adding to it.",
    ],
    ctaLabel: "Keep your cookbook going",
    actionUrl: "https://www.afishinthekitchen.com",
  });
  return { subject: `Your gifted year of ${FROM_NAME} has ended`, html, text };
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
  /** A copy of the giver's cookbook comes with the year. */
  includesCookbook?: boolean;
}): BuiltEmail {
  const to = esc(opts.recipientName.trim());
  const from = esc(opts.fromName.trim());
  const note = esc(opts.message.trim());
  const code = esc(opts.code);
  const pretty = code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;

  // ⚠ Ordered for a STRANGER. They have never heard of us and were sent this by
  // a friend, so: who it is from and what they said, then what the thing even
  // is, then the one line that prevents the obvious misreading, then the code.
  const rows: EmailRow[] = [
    {
      kind: "p",
      html: from
        ? `<strong style="color:${COLOR.charcoal};">${from}</strong> has given you a year of ${FROM_NAME}.`
        : `You have been given a year of ${FROM_NAME}.`,
    },
  ];
  // The most personal thing on the page gets the most presence.
  if (note) rows.push({ kind: "quote", html: `&ldquo;${note}&rdquo;` });
  // ⚠ Dylan's wording (2026-08-13). Note what it does: "YOUR cookbook … share
  // it with five of your friends" carries the ownership point by implication
  // rather than stating it. The explicit line it replaced ("The cookbook will
  // be yours") existed to kill the obvious misreading — that you are being
  // added to somebody else's book. If that misunderstanding ever shows up in
  // support, this sentence is the place to look first.
  rows.push({
    kind: "p",
    html: `${FROM_NAME} is a cookbook app for your recipes &mdash; somewhere to keep them, cook them hands-free at the stove, plan the week and share a shopping list. Share <strong style="color:${COLOR.charcoal};">your cookbook</strong> with five of your friends or family.`,
  });
  if (opts.includesCookbook) {
    // ⚠ First name only in the second half, which is why it is derived rather
    // than reusing `from`. "from Jane Whitfield's own cookbook" is a stranger
    // signing a legal document; "from Jane's own cookbook" is a friend. A
    // single-word name yields itself, and an empty one falls back to the
    // impersonal wording rather than printing "from 's own cookbook".
    const firstName = from.split(" ")[0] ?? "";
    rows.push({
      kind: "p",
      html: from
        ? `And it does not arrive empty: ${from} has added a copy of their whole cookbook with it &mdash; every recipe and kitchen tip, from ${firstName}&rsquo;s own cookbook. Arguably this is the real gift!`
        : `And it does not arrive empty &mdash; a copy of the giver&rsquo;s whole cookbook comes with it, every recipe and kitchen tip. Arguably this is the real gift!`,
    });
  }
  rows.push({ kind: "code", label: "Your gift code", value: pretty });

  const { html, text } = shell({
    heading: to ? `A gift for ${to}` : "A gift for you",
    bodyLines: [],
    bodyRows: rows,
    ctaLabel: "Open your gift",
    actionUrl: opts.redeemUrl,
    logo: { url: GIFT_LOGO_URL, width: 170, height: 163, round: false },
  });
  return {
    subject: from ? `${from} has given you a year of ${FROM_NAME}` : `A gift: a year of ${FROM_NAME}`,
    html,
    text,
  };
}

/**
 * The buyer's own copy of the card — "here is what we sent".
 *
 * ⚠ Deliberately NOT the same email. A buyer forwarded their own gift card
 * would see "A gift for Sarah" addressed to them, with a Redeem button they
 * must not press (redeeming your own gift is refused). This is a receipt with
 * the card's contents quoted inside it.
 */
export function buildGiftSentEmail(opts: {
  recipientName: string;
  recipientEmail: string;
  message: string;
  code: string;
  sendOn: string | null;
  includesCookbook: boolean;
}): BuiltEmail {
  const to = esc(opts.recipientName.trim());
  const when = opts.sendOn
    ? `It will be sent on ${esc(opts.sendOn)}.`
    : "It has been sent.";
  const lines = [
    `Your gift for ${to || "them"} is all set. ${when}`,
    opts.includesCookbook
      ? "A copy of your cookbook goes with it — every published recipe and kitchen tip, with who contributed each one kept intact. Your own cookbook is untouched."
      : "They will start with an empty cookbook of their own.",
    opts.message
      ? `Your note: <em style="color:${COLOR.slate};">&ldquo;${esc(opts.message)}&rdquo;</em>`
      : "",
    `Sent to <strong>${esc(opts.recipientEmail)}</strong>`,
    // ⚠ The code is in here because this is the buyer's only durable copy. If
    // the address was mistyped, this email is how they recover the gift they
    // have already paid for.
    `Their code is <strong style="font-family:monospace;letter-spacing:2px;">${esc(opts.code)}</strong> — keep it, in case the card goes astray.`,
  ].filter(Boolean);

  const { html, text } = shell({
    heading: "Your gift is on its way",
    bodyLines: lines,
    ctaLabel: "See the gift",
    actionUrl: `https://www.afishinthekitchen.com/g/${opts.code}`,
    logo: { url: GIFT_LOGO_URL, width: 200, height: 192, round: false },
  });
  return { subject: `Your gift for ${to || "them"} is on its way`, html, text };
}

/**
 * Nudge a recipient who has not claimed their gift.
 *
 * ⚠ Worth sending because the buyer has ALREADY PAID. A gift is a one-off
 * purchase taken at checkout, so an unclaimed code is money spent and nothing
 * delivered — the one failure in this feature that costs a customer real money
 * for nothing.
 */
export function buildGiftReminderEmail(opts: {
  recipientName: string;
  fromName: string;
  code: string;
}): BuiltEmail {
  const to = esc(opts.recipientName.trim());
  const from = esc(opts.fromName.trim());
  const { html, text } = shell({
    heading: to ? `${to}, your gift is waiting` : "Your gift is waiting",
    bodyLines: [
      from
        ? `${from} gave you a year of ${FROM_NAME} and it has not been claimed yet.`
        : `You were given a year of ${FROM_NAME} and it has not been claimed yet.`,
      "It is a cookbook app for your recipes — somewhere to keep them, cook them hands-free at the stove, plan the week and share a shopping list. Share your cookbook with five of your friends or family.",
      `Your code is <strong style="font-family:monospace;letter-spacing:2px;">${esc(opts.code)}</strong>`,
      "There is no rush and the code does not expire — but it is sitting here unused.",
    ],
    ctaLabel: "Claim your gift",
    actionUrl: `https://www.afishinthekitchen.com/g/${opts.code}`,
    logo: { url: GIFT_LOGO_URL, width: 200, height: 192, round: false },
  });
  return { subject: to ? `${to}, your gift is still waiting` : "Your gift is still waiting", html, text };
}

/** Tell the buyer their gift is still sitting unclaimed, so they can chase it. */
export function buildGiftUnclaimedEmail(opts: {
  recipientName: string;
  recipientEmail: string;
  code: string;
  days: number;
}): BuiltEmail {
  const to = esc(opts.recipientName.trim()) || "your recipient";
  const { html, text } = shell({
    heading: "Your gift hasn't been claimed yet",
    bodyLines: [
      `The gift you sent ${to} is still unclaimed after ${opts.days} days. We have reminded them, but a nudge from you tends to work better.`,
      `It went to <strong>${esc(opts.recipientEmail)}</strong> — worth checking that address is right, and their spam folder.`,
      `The code is <strong style="font-family:monospace;letter-spacing:2px;">${esc(opts.code)}</strong>. It does not expire, and you can send it on yourself.`,
    ],
    ctaLabel: "See the gift",
    actionUrl: `https://www.afishinthekitchen.com/g/${opts.code}`,
    logo: { url: GIFT_LOGO_URL, width: 200, height: 192, round: false },
  });
  return { subject: `Your gift for ${to} is still unclaimed`, html, text };
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
