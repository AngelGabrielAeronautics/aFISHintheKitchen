"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  applyActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";

// Branded handler for Firebase auth-email links (verify email / password reset),
// replacing the default firebaseapp.com/__/auth/action page. Point the Firebase
// Console action URL here: Authentication → Templates → (edit) → customise
// action URL → https://www.afishinthekitchen.com/auth/action

type Status = "working" | "ok" | "error" | "reset-form";

function ActionInner() {
  const params = useSearchParams();
  const mode = params.get("mode") ?? "";
  const oobCode = params.get("oobCode") ?? "";
  const continueUrl = params.get("continueUrl") ?? "/";

  const [status, setStatus] = useState<Status>("working");
  const [heading, setHeading] = useState("One moment…");
  const [message, setMessage] = useState("");

  // Password-reset form state
  const [resetEmail, setResetEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!oobCode) {
      setStatus("error");
      setHeading("Link expired or invalid");
      setMessage("This link is missing its code. Request a new email and try again.");
      return;
    }

    (async () => {
      try {
        if (mode === "verifyEmail" || mode === "verifyAndChangeEmail") {
          await applyActionCode(auth, oobCode);
          setStatus("ok");
          setHeading("Your email is verified");
          setMessage(
            "You're all set. Head back to the A Fish in the Kitchen app — it updates automatically — or continue on the web."
          );
        } else if (mode === "resetPassword") {
          const email = await verifyPasswordResetCode(auth, oobCode);
          setResetEmail(email);
          setStatus("reset-form");
          setHeading("Choose a new password");
          setMessage(`For ${email}`);
        } else if (mode === "recoverEmail") {
          await applyActionCode(auth, oobCode);
          setStatus("ok");
          setHeading("Email change reverted");
          setMessage("Your account email has been restored.");
        } else {
          setStatus("error");
          setHeading("Unsupported link");
          setMessage("We couldn't recognise this request.");
        }
      } catch {
        setStatus("error");
        setHeading("Link expired or already used");
        setMessage("This link is no longer valid. Request a fresh email and try again.");
      }
    })();
  }, [mode, oobCode]);

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await confirmPasswordReset(getFirebaseAuth(), oobCode, password);
      setStatus("ok");
      setHeading("Password updated");
      setMessage("You can now sign in with your new password.");
    } catch {
      setMessage("Couldn't update the password — the link may have expired. Request a new one.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl bg-warm-white p-8 shadow-sm ring-1 ring-charcoal/5 text-center">
        <Image
          src="/logo.png"
          alt="A Fish in the Kitchen"
          width={72}
          height={72}
          className="mx-auto mb-4 rounded-full object-contain"
        />
        <h1 className="font-serif text-2xl font-bold text-charcoal">{heading}</h1>
        {message && <p className="mt-3 font-sans text-sm text-slate leading-relaxed">{message}</p>}

        {status === "working" && (
          <div className="mt-6 mx-auto h-7 w-7 animate-spin rounded-full border-2 border-cream-dark border-t-terracotta" />
        )}

        {status === "reset-form" && (
          <form onSubmit={submitReset} className="mt-6 space-y-3 text-left">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              autoComplete="new-password"
              required
              className="w-full rounded-lg border border-gold-light bg-cream px-4 py-3 font-sans text-sm text-charcoal outline-none focus:border-terracotta/50 focus:ring-2 focus:ring-terracotta/20"
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
              required
              className="w-full rounded-lg border border-gold-light bg-cream px-4 py-3 font-sans text-sm text-charcoal outline-none focus:border-terracotta/50 focus:ring-2 focus:ring-terracotta/20"
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-terracotta px-6 py-3 font-sans text-sm font-semibold text-white hover:bg-terracotta-dark transition-colors disabled:opacity-60"
            >
              {submitting ? "Updating…" : "Update password"}
            </button>
          </form>
        )}

        {status === "ok" && (
          <Link
            href={continueUrl}
            className="mt-6 inline-block rounded-lg bg-terracotta px-8 py-3 font-sans text-sm font-semibold text-white hover:bg-terracotta-dark transition-colors"
          >
            Continue
          </Link>
        )}

        {status === "error" && (
          <Link
            href="/auth"
            className="mt-6 inline-block rounded-lg bg-terracotta px-8 py-3 font-sans text-sm font-semibold text-white hover:bg-terracotta-dark transition-colors"
          >
            Back to sign in
          </Link>
        )}
      </div>
    </main>
  );
}

export default function AuthActionPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-cream" />}>
      <ActionInner />
    </Suspense>
  );
}
