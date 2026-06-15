// Client helpers for the self-serve auth emails. These call /api/auth-email,
// which sends through our SendGrid sender (Firebase's default senders land in
// spam). Verification requires the caller's ID token; reset does not.
import type { User } from "firebase/auth";

const APP_ORIGIN = typeof window !== "undefined" ? window.location.origin : "";

// Resend/send the email-verification link to the signed-in user's own address.
export async function sendVerificationEmail(user: User): Promise<void> {
  const token = await user.getIdToken();
  const res = await fetch("/api/auth-email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ kind: "verify", continueUrl: `${APP_ORIGIN}/` }),
  });
  if (!res.ok) throw new Error("verify_email_failed");
}

// Request a password-reset email. Always resolves (the server is
// enumeration-safe and never reveals whether the account exists).
export async function sendResetEmail(email: string): Promise<void> {
  const res = await fetch("/api/auth-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "reset", email, continueUrl: `${APP_ORIGIN}/auth` }),
  });
  if (!res.ok) throw new Error("reset_email_failed");
}
