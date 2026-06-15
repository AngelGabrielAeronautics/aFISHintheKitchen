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
//                    and throttled per-email to blunt abuse / mail-bombing.

const RESET_THROTTLE_MS = 60_000; // at most one reset email per address per minute

function throttleKey(email: string): string {
  // Firestore doc ids can't contain "/"; emails don't, but encode defensively.
  return encodeURIComponent(email);
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

      const link = await adminAuth.generateEmailVerificationLink(email, actionCodeSettings);
      const { subject, html, text } = buildVerifyEmail(link);
      await sendTransactionalEmail({ to: email, subject, html, text });
      return NextResponse.json({ ok: true });
    }

    // kind === "reset" — unauthenticated.
    const email = body.email?.toLowerCase().trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    }

    // Per-email throttle (Admin SDK write bypasses rules; clients never touch
    // this collection). Best-effort: a failure here must not block the email.
    const db = getAdminDb();
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
      const link = await adminAuth.generatePasswordResetLink(email, actionCodeSettings);
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
