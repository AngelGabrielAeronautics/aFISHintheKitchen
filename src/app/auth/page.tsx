"use client";

import { useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

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
      const credential = await createUserWithEmailAndPassword(
        getFirebaseAuth(),
        email,
        password
      );
      await updateProfile(credential.user, {
        displayName: displayName.trim(),
      });
      await sendEmailVerification(credential.user);
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
                Sign Up
              </button>
            </div>
          )}

          {/* Reset heading */}
          {mode === "reset" && (
            <h2 className="mb-6 font-serif text-xl font-semibold text-charcoal">
              Reset your password
            </h2>
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
                {submitting ? "Creating account..." : "Sign Up"}
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
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="font-medium text-terracotta hover:text-terracotta-dark transition-colors"
                >
                  Sign up
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
