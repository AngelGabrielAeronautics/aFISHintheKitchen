import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { sendTransactionalEmail } from "@/lib/email";
import { buildVerifyEmail, buildResetEmail } from "@/lib/auth-email";

export const runtime = "nodejs";

// Self-serve auth emails (verification + password reset) sent through OUR
// SendGrid sender instead of Firebase's default senders, which land in spam.
// We generate the real Firebase action link via the Admin SDK and email it
// ourselves. Invited members skip verification entirely (see /api/join), so
// this only serves self-serve owners.
//
//   kind: "verify" → requires a signed-in caller; sends to their own address.
//   kind: "reset"  → unauthenticated; enumeration-safe (always reports success)
//                    and throttled BOTH per-email and per-caller. It cannot
//                    require auth — the whole point is that the user is locked
//                    out — so it is the one endpoint here a bot can reach, and
//                    it is treated accordingly.

const RESET_THROTTLE_MS = 60_000; // at most one reset email per address per minute

/**
 * Per-CALLER cap, on top of the per-address one.
 *
 * ⚠ WHY BOTH. The per-address throttle stops one inbox being flooded; it does
 * nothing to stop one caller walking a list of addresses. On 2026-08-14 an
 * automated probe swept every endpoint in this API — everything else answered
 * 401 because it requires auth, and this route, which cannot require auth, was
 * the only door that opened. It sent two real password-reset emails.
 *
 * Nobody's account was ever at risk: the link only works for whoever controls
 * the inbox. What is at risk is a real person being pestered, our sending
 * reputation, and the SendGrid quota.
 */
const RESET_IP_LIMIT = 5;
const RESET_IP_WINDOW_MS = 60 * 60_000; // 5 reset requests per caller per hour

function throttleKey(email: string): string {
  // Firestore doc ids can't contain "/"; emails don't, but encode defensively.
  return encodeURIComponent(email);
}

/**
 * Best-effort caller identity. Vercel sets x-forwarded-for; the left-most entry
 * is the client. Unknown callers all share one bucket, which is deliberately
 * strict rather than permissive.
 */
function callerIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return (fwd.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim();
}

/**
 * ⚠ HASHED, never stored raw. An IP is personal data and this collection is
 * long-lived; the hash is enough to count against and useless afterwards. The
 * RAW address goes to the server log instead, where it ages out — that is what
 * lets us answer "who did this?" without keeping a list of people's IPs.
 */
function ipKey(ip: string): string {
  return "ip:" + createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

// Repoint a Firebase-generated action link at our branded /auth/action handler.
// The oobCode is project-scoped, so applyActionCode works no matter which host
// serves the page — we keep the query (mode, oobCode, apiKey, continueUrl, lang)
// and just swap the host. Lets us brand the verify/reset pages without relying
// on the Firebase Console's (flaky) custom action URL setting.
function brandActionLink(link: string): string {
  try {
    const out = new URL("https://www.afishinthekitchen.com/auth/action");
    out.search = new URL(link).search;
    return out.toString();
  } catch {
    return link; // fall back to the Firebase default if parsing ever fails
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      return NextResponse.json({ error: "email_not_configured" }, { status: 500 });
    }

    const body = (await req.json()) as {
      kind?: "verify" | "reset";
      email?: string;
      continueUrl?: string;
    };
    const kind = body.kind;
    const continueUrl = body.continueUrl?.trim();
    if (kind !== "verify" && kind !== "reset") {
      return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
    }
    const actionCodeSettings = continueUrl ? { url: continueUrl } : undefined;
    const adminAuth = getAdminAuth();

    if (kind === "verify") {
      // Authenticated: only let a signed-in user (re)send verification to their
      // own address — never an arbitrary email.
      const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
      if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      let email: string;
      let alreadyVerified: boolean;
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        email = (decoded.email ?? "").toLowerCase().trim();
        alreadyVerified = decoded.email_verified === true;
      } catch {
        return NextResponse.json({ error: "invalid_token" }, { status: 401 });
      }
      if (!email) return NextResponse.json({ error: "no_email" }, { status: 400 });
      // Nothing to do — avoids a pointless email if their token is just stale.
      if (alreadyVerified) return NextResponse.json({ ok: true, alreadyVerified: true });

      // Same per-address throttle as reset — a signed-in user hammering
      // "Resend" shouldn't burn SendGrid quota or mail-bomb themselves.
      const verifyThrottleRef = getAdminDb().collection("authEmailThrottle").doc(throttleKey(`verify:${email}`));
      try {
        const snap = await verifyThrottleRef.get();
        const lastSent = snap.exists ? (snap.data()?.lastSentAt as number | undefined) : undefined;
        if (lastSent && Date.now() - lastSent < RESET_THROTTLE_MS) {
          return NextResponse.json({ ok: true });
        }
        await verifyThrottleRef.set({ lastSentAt: Date.now() });
      } catch (err) {
        console.error("auth-email verify throttle check failed (continuing):", err);
      }

      const link = brandActionLink(await adminAuth.generateEmailVerificationLink(email, actionCodeSettings));
      const { subject, html, text } = buildVerifyEmail(link);
      await sendTransactionalEmail({ to: email, subject, html, text });
      return NextResponse.json({ ok: true });
    }

    // kind === "reset" — unauthenticated.
    const email = body.email?.toLowerCase().trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    }

    const db = getAdminDb();
    const ip = callerIp(req);
    const ua = (req.headers.get("user-agent") ?? "").slice(0, 120);

    // ⚠ LOGGED ON EVERY RESET REQUEST, before any throttle can swallow it.
    // When two of these arrived unexplained, the route recorded nothing about
    // the caller and the only honest answer was "I don't know". Now there is
    // always a line to look at.
    console.warn(`auth-email reset requested ip=${ip} ua=${JSON.stringify(ua)}`);

    // Per-CALLER cap first — it is the one that stops a sweep across addresses.
    // Fails OPEN on error: a locked-out user must still be able to get in.
    try {
      const ipRef = db.collection("authEmailThrottle").doc(ipKey(ip));
      const snap = await ipRef.get();
      const d = snap.data() as { count?: number; windowStart?: number } | undefined;
      const now = Date.now();
      const fresh = !d?.windowStart || now - d.windowStart > RESET_IP_WINDOW_MS;
      const count = fresh ? 0 : (d?.count ?? 0);
      if (count >= RESET_IP_LIMIT) {
        console.warn(`auth-email reset RATE-LIMITED ip=${ip} (${count} in the last hour)`);
        // Same shape as success — never reveal the limit or whether the
        // address exists.
        return NextResponse.json({ ok: true });
      }
      await ipRef.set({ count: count + 1, windowStart: fresh ? now : d!.windowStart });
    } catch (err) {
      console.error("auth-email ip throttle failed (continuing):", err);
    }

    // Per-email throttle (Admin SDK write bypasses rules; clients never touch
    // this collection). Best-effort: a failure here must not block the email.
    const throttleRef = db.collection("authEmailThrottle").doc(throttleKey(email));
    try {
      const snap = await throttleRef.get();
      const lastSent = snap.exists ? (snap.data()?.lastSentAt as number | undefined) : undefined;
      if (lastSent && Date.now() - lastSent < RESET_THROTTLE_MS) {
        // Silently succeed — don't reveal the throttle or whether the account exists.
        return NextResponse.json({ ok: true });
      }
      await throttleRef.set({ lastSentAt: Date.now() });
    } catch (err) {
      console.error("auth-email throttle check failed (continuing):", err);
    }

    try {
      const link = brandActionLink(await adminAuth.generatePasswordResetLink(email, actionCodeSettings));
      const { subject, html, text } = buildResetEmail(link);
      await sendTransactionalEmail({ to: email, subject, html, text });
    } catch (err) {
      // user-not-found is expected for unknown addresses — swallow it so we
      // never leak which emails have accounts. Log other failures.
      const code = (err as { code?: string }).code ?? "";
      if (code !== "auth/user-not-found" && code !== "auth/email-not-found") {
        console.error("auth-email reset send failed:", err);
      }
    }
    // Always report success (enumeration protection).
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("auth-email error:", err);
    return NextResponse.json({ error: "auth_email_failed" }, { status: 500 });
  }
}
