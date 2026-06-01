"use client";

import { useState } from "react";
import { sendEmailVerification } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

// Non-blocking reminder for unverified email/password users. They can browse
// and set up, but writing content / inviting is blocked (Firestore rules +
// per-surface prompts) until verified. Google/Apple sign-ins arrive verified.
export default function EmailVerificationGate() {
  const { user, loading } = useAuth();
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  if (loading || !user || user.emailVerified) return null;

  async function resend() {
    const current = getFirebaseAuth().currentUser;
    if (!current) return;
    setSending(true);
    try {
      await sendEmailVerification(current);
      setSent(true);
    } catch {
      /* ignore — likely rate-limited */
    } finally {
      setSending(false);
    }
  }

  async function refresh() {
    const current = getFirebaseAuth().currentUser;
    if (current) {
      await current.reload();
      window.location.reload();
    }
  }

  return (
    <div className="w-full bg-gold-light/90 px-4 py-2.5 text-center font-sans text-sm text-charcoal">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span>
          {sent ? (
            <>Verification email re-sent to <strong>{user.email}</strong>. Click the link, then refresh.</>
          ) : (
            <>Verify your email to add recipes and invite family. We sent a link to <strong>{user.email}</strong>.</>
          )}
        </span>
        <span className="flex items-center gap-3">
          <button
            type="button"
            onClick={refresh}
            className="font-semibold text-terracotta-dark underline underline-offset-2 hover:text-terracotta cursor-pointer"
          >
            I&rsquo;ve verified
          </button>
          <button
            type="button"
            onClick={resend}
            disabled={sending}
            className="font-medium text-charcoal/70 underline underline-offset-2 hover:text-charcoal disabled:opacity-50 cursor-pointer"
          >
            {sending ? "Sending…" : "Resend"}
          </button>
        </span>
      </div>
    </div>
  );
}
