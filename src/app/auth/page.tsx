"use client";

import { useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { isEmailAllowed } from "@/lib/firebase-recipes";

type AuthMode = "signin" | "signup" | "reset";

function getErrorMessage(code: string): string {
  switch (code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/user-not-found":
      return "No account found with this email.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

// Joins the signed-in user to the household they were invited to, server-side
// (the Admin SDK route enforces seat/book caps and bypasses the locked rules).
async function joinHouseholdFromInvite(): Promise<{ ok: boolean; error?: string }> {
  try {
    const current = getFirebaseAuth().currentUser;
    if (!current) return { ok: false, error: "no_user" };
    const token = await current.getIdToken();
    const res = await fetch("/api/join", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error ?? "join_failed" };
  } catch {
    return { ok: false, error: "join_failed" };
  }
}

// Maps a join error to a user-facing message. Returns null for non-errors
// (e.g. no_invite — expected for owners/self-serve signups).
function joinErrorMessage(error?: string): string | null {
  switch (error) {
    case "guest_book_limit":
      return "You're already in the maximum of 3 cookbooks. Leave one before joining another.";
    case "seat_limit":
      return "That cookbook is full. Ask the owner to free up a spot, then try again.";
    case "household_inactive":
      return "That cookbook is currently inactive. Ask the owner to reactivate it.";
    default:
      return null;
  }
}

export default function AuthPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push("/");
    }
  }, [user, loading, router]);

  function switchMode(newMode: AuthMode) {
    setMode(newMode);
    setError("");
    setSuccessMessage("");
    if (newMode !== "reset") {
      setEmail("");
    }
    setPassword("");
    setConfirmPassword("");
    setDisplayName("");
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      router.push("/");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(getErrorMessage(code));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!displayName.trim()) {
      setError("Please enter your name.");
      return;
    }

    setSubmitting(true);

    try {
      const allowed = await isEmailAllowed(email);
      if (!allowed) {
        setError(
          "This email hasn't been invited yet. Ask a family member to send you an invite."
        );
        setSubmitting(false);
        return;
      }

      const credential = await createUserWithEmailAndPassword(
        getFirebaseAuth(),
        email,
        password
      );
      await updateProfile(credential.user, {
        displayName: displayName.trim(),
      });
      await sendEmailVerification(credential.user);
      const join = await joinHouseholdFromInvite();
      const joinMsg = joinErrorMessage(join.error);
      if (!join.ok && joinMsg) {
        setError(joinMsg);
        setSubmitting(false);
        return;
      }
      setSuccessMessage(
        `We've sent a verification email to ${email}. Please check your inbox.`
      );
      // Short delay so the user sees the message before redirect
      setTimeout(() => router.push("/"), 3000);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(getErrorMessage(code));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setSubmitting(true);

    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email);
      setSuccessMessage("Check your email for a password reset link.");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(getErrorMessage(code));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError("");
    setSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(getFirebaseAuth(), provider);
      const join = await joinHouseholdFromInvite();
      const joinMsg = joinErrorMessage(join.error);
      if (!join.ok && joinMsg) {
        setError(joinMsg);
        setSubmitting(false);
        return;
      }
      router.push("/");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code !== "auth/popup-closed-by-user") {
        setError(getErrorMessage(code));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAppleSignIn() {
    setError("");
    setSubmitting(true);
    try {
      const provider = new OAuthProvider("apple.com");
      provider.addScope("email");
      provider.addScope("name");
      await signInWithPopup(getFirebaseAuth(), provider);
      const join = await joinHouseholdFromInvite();
      const joinMsg = joinErrorMessage(join.error);
      if (!join.ok && joinMsg) {
        setError(joinMsg);
        setSubmitting(false);
        return;
      }
      router.push("/");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code !== "auth/popup-closed-by-user") {
        setError(getErrorMessage(code));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || user) {
    return null;
  }

  const inputClasses =
    "w-full rounded-lg border border-gold-light bg-warm-white px-4 py-3 font-sans text-charcoal placeholder:text-slate/50 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30 transition-colors";

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-12">
      <div className="w-full max-w-md">
        <h1 className="mb-8 text-center font-serif text-3xl font-bold text-charcoal">
          Welcome to A Fish in the Kitchen
        </h1>

        <div className="rounded-2xl bg-white p-8 shadow-lg">
          {/* Social sign-in */}
          {mode !== "reset" && (
            <div className="mb-6 space-y-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={submitting}
                className="flex w-full items-center justify-center gap-3 rounded-lg border border-cream-dark/40 bg-white px-4 py-3 font-sans text-sm font-medium text-charcoal transition-colors hover:bg-cream-dark/10 disabled:opacity-40 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>
              <button
                type="button"
                onClick={handleAppleSignIn}
                disabled={submitting}
                className="flex w-full items-center justify-center gap-3 rounded-lg bg-charcoal px-4 py-3 font-sans text-sm font-medium text-white transition-colors hover:bg-charcoal/90 disabled:opacity-40 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                Continue with Apple
              </button>

              {/* Divider */}
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-cream-dark/30" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-4 font-sans text-xs text-slate/50">or</span>
                </div>
              </div>
            </div>
          )}

          {/* Tabs — hidden during password reset */}
          {mode !== "reset" && (
            <div className="mb-6 flex border-b border-gold-light">
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className={`flex-1 pb-3 font-sans text-sm font-medium transition-colors ${
                  mode === "signin"
                    ? "border-b-2 border-terracotta text-terracotta"
                    : "text-slate hover:text-charcoal"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className={`flex-1 pb-3 font-sans text-sm font-medium transition-colors ${
                  mode === "signup"
                    ? "border-b-2 border-terracotta text-terracotta"
                    : "text-slate hover:text-charcoal"
                }`}
              >
                Claim Account
              </button>
            </div>
          )}

          {/* Reset heading */}
          {mode === "reset" && (
            <h2 className="mb-6 font-serif text-xl font-semibold text-charcoal">
              Reset your password
            </h2>
          )}

          {/* Claim account note */}
          {mode === "signup" && (
            <div className="mb-4 rounded-lg border border-gold-light bg-gold-light/10 px-4 py-3 font-sans text-sm text-charcoal">
              This cookbook is invite-only. You&rsquo;ll need an invitation from a family member to create an account. If you haven&rsquo;t been invited yet, ask the family admin.
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg border border-terracotta-light/30 bg-terracotta-light/10 px-4 py-3 font-sans text-sm text-terracotta-dark">
              {error}
            </div>
          )}

          {/* Success */}
          {successMessage && (
            <div className="mb-4 rounded-lg border border-green-300 bg-green-50 px-4 py-3 font-sans text-sm text-green-800">
              {successMessage}
            </div>
          )}

          {/* Sign In Form */}
          {mode === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label
                  htmlFor="signin-email"
                  className="mb-1 block font-sans text-sm font-medium text-charcoal"
                >
                  Email
                </label>
                <input
                  id="signin-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClasses}
                />
              </div>

              <div>
                <label
                  htmlFor="signin-password"
                  className="mb-1 block font-sans text-sm font-medium text-charcoal"
                >
                  Password
                </label>
                <input
                  id="signin-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className={inputClasses}
                />
                <button
                  type="button"
                  onClick={() => switchMode("reset")}
                  className="mt-1 font-sans text-xs font-medium text-terracotta hover:text-terracotta-dark transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-terracotta px-4 py-3 font-sans text-sm font-semibold text-white transition-colors hover:bg-terracotta-dark focus:outline-none focus:ring-2 focus:ring-terracotta/50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "Signing in..." : "Sign In"}
              </button>
            </form>
          )}

          {/* Sign Up Form */}
          {mode === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label
                  htmlFor="signup-name"
                  className="mb-1 block font-sans text-sm font-medium text-charcoal"
                >
                  Display Name
                </label>
                <input
                  id="signup-name"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className={inputClasses}
                />
              </div>

              <div>
                <label
                  htmlFor="signup-email"
                  className="mb-1 block font-sans text-sm font-medium text-charcoal"
                >
                  Email
                </label>
                <input
                  id="signup-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClasses}
                />
              </div>

              <div>
                <label
                  htmlFor="signup-password"
                  className="mb-1 block font-sans text-sm font-medium text-charcoal"
                >
                  Password
                </label>
                <input
                  id="signup-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className={inputClasses}
                />
              </div>

              <div>
                <label
                  htmlFor="signup-confirm"
                  className="mb-1 block font-sans text-sm font-medium text-charcoal"
                >
                  Confirm Password
                </label>
                <input
                  id="signup-confirm"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className={inputClasses}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-terracotta px-4 py-3 font-sans text-sm font-semibold text-white transition-colors hover:bg-terracotta-dark focus:outline-none focus:ring-2 focus:ring-terracotta/50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "Creating account..." : "Claim Account"}
              </button>
            </form>
          )}

          {/* Password Reset Form */}
          {mode === "reset" && (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <label
                  htmlFor="reset-email"
                  className="mb-1 block font-sans text-sm font-medium text-charcoal"
                >
                  Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClasses}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-terracotta px-4 py-3 font-sans text-sm font-semibold text-white transition-colors hover:bg-terracotta-dark focus:outline-none focus:ring-2 focus:ring-terracotta/50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "Sending..." : "Send Reset Email"}
              </button>
            </form>
          )}

          {/* Toggle link */}
          <p className="mt-6 text-center font-sans text-sm text-slate">
            {mode === "signin" && (
              <>
                Been invited?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="font-medium text-terracotta hover:text-terracotta-dark transition-colors"
                >
                  Claim your account
                </button>
              </>
            )}
            {mode === "signup" && (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="font-medium text-terracotta hover:text-terracotta-dark transition-colors"
                >
                  Sign in
                </button>
              </>
            )}
            {mode === "reset" && (
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="font-medium text-terracotta hover:text-terracotta-dark transition-colors"
              >
                Back to sign in
              </button>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
