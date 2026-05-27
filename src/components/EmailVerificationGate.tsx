"use client";

import { useState } from "react";
import { sendEmailVerification, signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

// Blocks the app until the email is verified. Only bites email/password users —
// Google/Apple sign-ins arrive with emailVerified already true.
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/70 p-4 backdrop-blur-sm">
      <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        <h2 className="mb-2 font-serif text-2xl text-charcoal">Verify your email</h2>
        <p className="mb-6 font-sans text-sm text-slate">
          We sent a verification link to <strong>{user.email}</strong>. Click it, then refresh this
          page.
          {sent && (
            <span className="mt-2 block text-terracotta-dark">Verification email resent.</span>
          )}
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={refresh}
            className="rounded-lg bg-terracotta px-5 py-2.5 font-sans text-sm font-semibold text-white transition-colors hover:bg-terracotta-dark"
          >
            I&rsquo;ve verified — refresh
          </button>
          <button
            type="button"
            onClick={resend}
            disabled={sending}
            className="rounded-lg px-5 py-2.5 font-sans text-sm font-medium text-terracotta transition-colors hover:bg-cream-dark/20 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Resend email"}
          </button>
          <button
            type="button"
            onClick={() => signOut(getFirebaseAuth())}
            className="mt-1 font-sans text-xs text-slate/60 underline"
          >
            Use a different account
          </button>
        </div>
      </div>
    </div>
  );
}
