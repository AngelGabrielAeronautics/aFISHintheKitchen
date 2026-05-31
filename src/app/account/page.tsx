"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  updateProfile,
  updatePassword,
  signOut,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendEmailVerification,
  verifyBeforeUpdateEmail,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import DeleteModal from "@/components/DeleteModal";
import { getUserPreferences, updateUserPreferences } from "@/lib/firebase-recipes";

function getErrorMessage(code: string): string {
  switch (code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect password. Please try again.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    case "auth/requires-recent-login":
      return "This action requires a recent sign-in. Please re-enter your password.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function AccountPage() {
  const { user, loading, isAdmin: userIsAdmin } = useAuth();
  const router = useRouter();

  // Profile
  const [displayName, setDisplayName] = useState("");
  const [profileStatus, setProfileStatus] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Verification
  const [verificationStatus, setVerificationStatus] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [sendingVerification, setSendingVerification] = useState(false);

  // Change email
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailStatus, setEmailStatus] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [savingEmail, setSavingEmail] = useState(false);

  // Change password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  // Delete account
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Notification preferences
  const [notifyNewRecipes, setNotifyNewRecipes] = useState(true);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.displayName) {
      setDisplayName(user.displayName);
    }
  }, [user?.displayName]);

  useEffect(() => {
    if (user?.uid && !prefsLoaded) {
      getUserPreferences(user.uid)
        .then((prefs) => { setNotifyNewRecipes(prefs.notifyNewRecipes); setPrefsLoaded(true); })
        .catch(() => setPrefsLoaded(true));
    }
  }, [user?.uid, prefsLoaded]);

  if (loading || !user) {
    return null;
  }

  // Non-null reference for use inside closures (TypeScript can't narrow
  // the outer `user` across async callbacks)
  const currentUser = user;

  const inputClasses =
    "w-full rounded-lg border border-gold-light bg-warm-white px-4 py-3 font-sans text-charcoal placeholder:text-slate/50 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30 transition-colors";

  const buttonClasses =
    "rounded-lg bg-terracotta px-5 py-2.5 font-sans text-sm font-semibold text-white transition-colors hover:bg-terracotta-dark focus:outline-none focus:ring-2 focus:ring-terracotta/50 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer";

  const secondaryButtonClasses =
    "rounded-lg border border-cream-dark px-5 py-2.5 font-sans text-sm font-medium text-slate transition-colors hover:bg-cream-dark/20 cursor-pointer";

  // ---- Handlers ----

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileStatus(null);

    if (!displayName.trim()) {
      setProfileStatus({ type: "error", message: "Display name cannot be empty." });
      return;
    }

    setSavingProfile(true);
    try {
      await updateProfile(currentUser, { displayName: displayName.trim() });
      setProfileStatus({ type: "success", message: "Display name updated." });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setProfileStatus({ type: "error", message: getErrorMessage(code) });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSendVerification() {
    setVerificationStatus(null);
    setSendingVerification(true);
    try {
      await sendEmailVerification(currentUser);
      setVerificationStatus({ type: "success", message: "Verification email sent. Check your inbox." });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setVerificationStatus({ type: "error", message: getErrorMessage(code) });
    } finally {
      setSendingVerification(false);
    }
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailStatus(null);

    if (!newEmail.trim()) {
      setEmailStatus({ type: "error", message: "Please enter a new email address." });
      return;
    }
    if (!emailPassword) {
      setEmailStatus({ type: "error", message: "Please enter your current password." });
      return;
    }

    setSavingEmail(true);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email!, emailPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await verifyBeforeUpdateEmail(currentUser, newEmail.trim());
      setEmailStatus({
        type: "success",
        message: `A verification email has been sent to ${newEmail.trim()}. Your email will update once you verify the new address.`,
      });
      setNewEmail("");
      setEmailPassword("");
      setShowChangeEmail(false);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setEmailStatus({ type: "error", message: getErrorMessage(code) });
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordStatus(null);

    if (!currentPassword) {
      setPasswordStatus({ type: "error", message: "Please enter your current password." });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordStatus({ type: "error", message: "New passwords do not match." });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordStatus({ type: "error", message: "New password must be at least 6 characters." });
      return;
    }

    setSavingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email!, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      setPasswordStatus({ type: "success", message: "Password updated successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setPasswordStatus({ type: "error", message: getErrorMessage(code) });
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleSignOut() {
    await signOut(getFirebaseAuth());
    router.push("/");
  }

  async function handleDeleteAccount() {
    try {
      await deleteUser(currentUser);
      router.push("/");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/requires-recent-login") {
        setShowDeleteModal(false);
        setPasswordStatus({
          type: "error",
          message: "Deleting your account requires a recent sign-in. Please change your password (which re-authenticates you) or sign out and back in, then try again.",
        });
      }
    }
  }

  return (
    <div className="min-h-screen bg-cream px-4 py-12">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <h1 className="font-serif text-3xl font-bold text-charcoal">
          Account Settings
        </h1>

        {/* ---- Profile Section ---- */}
        <section className="rounded-2xl bg-white p-6 sm:p-8 shadow-lg mb-6">
          <h2 className="font-serif text-xl font-semibold text-charcoal mb-5">
            Profile
          </h2>

          <StatusBanner status={profileStatus} />

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label htmlFor="display-name" className="mb-1 block font-sans text-sm font-medium text-charcoal">
                Display Name
              </label>
              <input
                id="display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className={inputClasses}
              />
            </div>

            <div>
              <label className="mb-1 block font-sans text-sm font-medium text-charcoal">
                Email
              </label>
              <div className="flex items-center gap-3">
                <p className="font-sans text-sm text-slate">{user.email}</p>
                <button
                  type="button"
                  onClick={() => {
                    setShowChangeEmail(!showChangeEmail);
                    setEmailStatus(null);
                  }}
                  className="font-sans text-xs font-medium text-terracotta hover:text-terracotta-dark transition-colors cursor-pointer"
                >
                  {showChangeEmail ? "Cancel" : "Change Email"}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block font-sans text-sm font-medium text-charcoal">
                Email Verification
              </label>
              <StatusBanner status={verificationStatus} />
              {user.emailVerified ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1 font-sans text-xs font-medium text-green-700">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                  Verified
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendVerification}
                  disabled={sendingVerification}
                  className="font-sans text-xs font-medium text-terracotta hover:text-terracotta-dark transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {sendingVerification ? "Sending..." : "Send Verification Email"}
                </button>
              )}
            </div>

            <div>
              <label className="mb-1 block font-sans text-sm font-medium text-charcoal">
                Account Created
              </label>
              <p className="font-sans text-sm text-slate">
                {user.metadata.creationTime ? formatDate(user.metadata.creationTime) : "Unknown"}
              </p>
            </div>

            <div className="pt-2">
              <button type="submit" disabled={savingProfile} className={buttonClasses}>
                {savingProfile ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </section>

        {/* ---- Change Email Section ---- */}
        {showChangeEmail && (
          <section className="rounded-2xl bg-white p-6 sm:p-8 shadow-lg mb-6">
            <h2 className="font-serif text-xl font-semibold text-charcoal mb-5">
              Change Email
            </h2>

            <StatusBanner status={emailStatus} />

            <form onSubmit={handleChangeEmail} className="space-y-4">
              <div>
                <label htmlFor="new-email" className="mb-1 block font-sans text-sm font-medium text-charcoal">
                  New Email
                </label>
                <input
                  id="new-email"
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="newemail@example.com"
                  className={inputClasses}
                />
              </div>

              <div>
                <label htmlFor="email-password" className="mb-1 block font-sans text-sm font-medium text-charcoal">
                  Current Password
                </label>
                <input
                  id="email-password"
                  type="password"
                  required
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  placeholder="Your current password"
                  className={inputClasses}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={savingEmail} className={buttonClasses}>
                  {savingEmail ? "Saving..." : "Update Email"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowChangeEmail(false);
                    setEmailStatus(null);
                    setNewEmail("");
                    setEmailPassword("");
                  }}
                  className={secondaryButtonClasses}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        {/* ---- Email status shown even if section is collapsed ---- */}
        {!showChangeEmail && emailStatus && (
          <div className="mb-6">
            <StatusBanner status={emailStatus} />
          </div>
        )}

        {/* ---- Change Password Section ---- */}
        <section className="rounded-2xl bg-white p-6 sm:p-8 shadow-lg mb-6">
          <h2 className="font-serif text-xl font-semibold text-charcoal mb-5">
            Change Password
          </h2>

          <StatusBanner status={passwordStatus} />

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label htmlFor="current-password" className="mb-1 block font-sans text-sm font-medium text-charcoal">
                Current Password
              </label>
              <input
                id="current-password"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Your current password"
                className={inputClasses}
              />
            </div>

            <div>
              <label htmlFor="new-password" className="mb-1 block font-sans text-sm font-medium text-charcoal">
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className={inputClasses}
              />
            </div>

            <div>
              <label htmlFor="confirm-new-password" className="mb-1 block font-sans text-sm font-medium text-charcoal">
                Confirm New Password
              </label>
              <input
                id="confirm-new-password"
                type="password"
                required
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Re-enter new password"
                className={inputClasses}
              />
            </div>

            <div className="pt-2">
              <button type="submit" disabled={savingPassword} className={buttonClasses}>
                {savingPassword ? "Saving..." : "Update Password"}
              </button>
            </div>
          </form>
        </section>

        {/* ---- Admin Section ---- */}
        {/* Cookbook Settings */}
        <section className="rounded-2xl bg-white p-6 sm:p-8 shadow-lg">
          <h2 className="font-serif text-xl font-semibold text-charcoal mb-5">
            Cookbook
          </h2>
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 rounded-lg bg-terracotta/10 px-5 py-2.5 font-sans text-sm font-medium text-terracotta transition-colors hover:bg-terracotta/20"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.993 6.993 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
            </svg>
            Cookbook Settings
          </Link>
        </section>

        {userIsAdmin && (
          <section className="rounded-2xl bg-white p-6 sm:p-8 shadow-lg">
            <h2 className="font-serif text-xl font-semibold text-charcoal mb-5">
              Admin
            </h2>
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-2 rounded-lg bg-terracotta/10 px-5 py-2.5 font-sans text-sm font-medium text-terracotta transition-colors hover:bg-terracotta/20"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 18a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.636.818.818 0 0 1-.36.98A7.465 7.465 0 0 1 14.5 16Z" />
              </svg>
              Manage Users &amp; Invites
            </Link>
          </section>
        )}

        {/* ---- Notifications ---- */}
        <section className="rounded-2xl bg-white p-6 sm:p-8 shadow-lg">
          <h2 className="font-serif text-xl font-semibold text-charcoal mb-5">
            Notifications
          </h2>
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <p className="font-sans text-sm font-medium text-charcoal">New recipe alerts</p>
              <p className="font-sans text-xs text-slate">Get notified when a family member adds a new recipe</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notifyNewRecipes}
              onClick={() => {
                const next = !notifyNewRecipes;
                setNotifyNewRecipes(next);
                updateUserPreferences(user.uid, { notifyNewRecipes: next }).catch(() => {});
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${notifyNewRecipes ? "bg-terracotta" : "bg-cream-dark"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${notifyNewRecipes ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </label>
        </section>

        {/* ---- Sign Out & Delete Section ---- */}
        <section className="rounded-2xl bg-white p-6 sm:p-8 shadow-lg">
          <h2 className="font-serif text-xl font-semibold text-charcoal mb-5">
            Account
          </h2>

          <div className="flex flex-wrap gap-3">
            <button onClick={handleSignOut} className={secondaryButtonClasses}>
              Sign Out
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="rounded-lg bg-red-500 px-5 py-2.5 font-sans text-sm font-medium text-white transition-colors hover:bg-red-600 cursor-pointer"
            >
              Delete Account
            </button>
          </div>
          <p className="mt-3 font-sans text-xs text-slate/60">
            Your account will be deleted but your recipes, notes, and contributions will remain in the cookbook.
          </p>
        </section>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <DeleteModal
          title="your account"
          heading="Delete Account"
          message="Your account will be permanently deleted. Your recipes, notes, and contributions will remain in the cookbook for the family."
          onConfirm={handleDeleteAccount}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}

// ---- Status Banner Component ----

function StatusBanner({ status }: { status: { type: "error" | "success"; message: string } | null }) {
  if (!status) return null;

  if (status.type === "error") {
    return (
      <div className="mb-4 rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 font-sans text-sm text-amber-900">
        {status.message}
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-green-300 bg-green-50 px-4 py-3 font-sans text-sm text-green-800">
      {status.message}
    </div>
  );
}
