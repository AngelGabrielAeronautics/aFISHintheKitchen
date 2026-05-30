"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  getInvitedUsers,
  addInvitedUser,
  removeInvitedUser,
  getAdminEmails,
  countHouseholdSeats,
  getSubscription,
  type InvitedUser,
} from "@/lib/firebase-recipes";
import { useHousehold } from "@/context/HouseholdContext";
import { MAX_SEATS } from "@/lib/access";

/*
  Firestore rules needed (deploy manually):

  match /invitedUsers/{email} {
    allow read: if true;
    allow write: if request.auth != null;
  }
  match /config/{docId} {
    allow read: if true;
    allow write: if false; // admin-only via console
  }

  The config/settings doc must be created manually in Firebase Console with:
  { adminEmails: ["dylan@angelgabriel.co.za"] }
*/

export default function AdminUsersPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const { household, householdId } = useHousehold();

  const [users, setUsers] = useState<InvitedUser[]>([]);
  const [adminEmails, setAdminEmails] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Invite form state
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [usersData, adminsData] = await Promise.all([
        getInvitedUsers(householdId),
        getAdminEmails(),
      ]);
      setUsers(usersData);
      setAdminEmails(adminsData);
    } catch {
      setError("Failed to load data.");
    } finally {
      setLoadingData(false);
    }
  }, [householdId]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth");
      return;
    }
    if (!loading && user && !isAdmin) {
      // Not admin — we still render the denied message
      setLoadingData(false);
      return;
    }
    if (!loading && user && isAdmin) {
      fetchData();
    }
  }, [loading, user, isAdmin, router, fetchData]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    const trimmedName = inviteName.trim();
    const trimmedEmail = inviteEmail.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail) {
      setError("Please fill in both name and email.");
      return;
    }

    setSubmitting(true);

    try {
      // Seat soft-block (UX). The hard cap is enforced server-side at join, but
      // catch it here so owners aren't surprised after an invitee tries to accept.
      if (householdId) {
        const [used, sub] = await Promise.all([
          countHouseholdSeats(householdId),
          user ? getSubscription(user.uid) : Promise.resolve(null),
        ]);
        const limit = MAX_SEATS + (sub?.extraSeats ?? 0);
        if (used >= limit) {
          // TODO(billing): offer an "add extra seats" upgrade once that add-on exists.
          setError(
            `You've used all ${limit} member seats. Remove a member (or a pending invite) to free one up.`
          );
          setSubmitting(false);
          return;
        }
      }

      await addInvitedUser({
        email: trimmedEmail,
        name: trimmedName,
        invitedBy: user?.displayName ?? "Unknown",
        ...(householdId ? { householdId } : {}),
      });

      let emailSent = false;
      try {
        const token = await user?.getIdToken();
        if (token) {
          const res = await fetch("/api/send-invite", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              email: trimmedEmail,
              name: trimmedName,
              inviterName: user?.displayName || user?.email || "A family member",
              householdName: household?.customisation?.brandName,
              signupUrl: `${window.location.origin}/auth`,
            }),
          });
          emailSent = res.ok;
        }
      } catch {
        // Fall through — allow-list entry still succeeded
      }

      setSuccessMessage(
        emailSent
          ? `Invitation sent to ${trimmedName} (${trimmedEmail})`
          : `${trimmedName} (${trimmedEmail}) is allow-listed, but the email failed to send. Share the signup link with them directly.`
      );
      setInviteName("");
      setInviteEmail("");
      await fetchData();
    } catch {
      setError("Failed to add invitation. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(email: string) {
    try {
      await removeInvitedUser(email);
      setConfirmDelete(null);
      await fetchData();
    } catch {
      setError("Failed to remove user.");
    }
  }

  if (loading || (!user && !loading)) {
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <h1 className="mb-4 font-serif text-2xl font-bold text-charcoal">
            Access Denied
          </h1>
          <p className="font-sans text-sm text-slate">
            You don&apos;t have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  const inputClasses =
    "w-full rounded-lg border border-gold-light bg-warm-white px-4 py-3 font-sans text-charcoal placeholder:text-slate/50 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30 transition-colors";

  return (
    <div className="min-h-screen bg-cream px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-8 font-serif text-3xl font-bold text-charcoal">
          Manage Users
        </h1>

        {/* Invite Form */}
        <div className="mb-8 rounded-2xl bg-white p-6 shadow-lg">
          <h2 className="mb-4 font-serif text-xl font-semibold text-charcoal">
            Invite a New User
          </h2>

          {error && (
            <div className="mb-4 rounded-lg border border-terracotta-light/30 bg-terracotta-light/10 px-4 py-3 font-sans text-sm text-terracotta-dark">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 rounded-lg border border-green-300 bg-green-50 px-4 py-3 font-sans text-sm text-green-800">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleInvite} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="invite-name"
                  className="mb-1 block font-sans text-sm font-medium text-charcoal"
                >
                  Name
                </label>
                <input
                  id="invite-name"
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Their name"
                  className={inputClasses}
                />
              </div>
              <div>
                <label
                  htmlFor="invite-email"
                  className="mb-1 block font-sans text-sm font-medium text-charcoal"
                >
                  Email
                </label>
                <input
                  id="invite-email"
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="their@email.com"
                  className={inputClasses}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-terracotta px-6 py-3 font-sans text-sm font-semibold text-white transition-colors hover:bg-terracotta-dark focus:outline-none focus:ring-2 focus:ring-terracotta/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Adding..." : "Send Invite"}
            </button>
          </form>
        </div>

        {/* Users List */}
        <div className="mb-8 rounded-2xl bg-white p-6 shadow-lg">
          <h2 className="mb-4 font-serif text-xl font-semibold text-charcoal">
            Invited Users
          </h2>

          {loadingData ? (
            <p className="font-sans text-sm text-slate">Loading...</p>
          ) : users.length === 0 ? (
            <p className="font-sans text-sm text-slate">
              No users invited yet.
            </p>
          ) : (
            <div className="divide-y divide-gold-light/50">
              {users.map((invitedUser) => (
                <div
                  key={invitedUser.email}
                  className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-sans text-sm font-semibold text-charcoal">
                        {invitedUser.name}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 font-sans text-xs font-medium ${
                          invitedUser.status === "registered"
                            ? "bg-green-100 text-green-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {invitedUser.status === "registered"
                          ? "Registered"
                          : "Pending"}
                      </span>
                    </div>
                    <p className="font-sans text-sm text-slate">
                      {invitedUser.email}
                    </p>
                    <p className="font-sans text-xs text-slate/70">
                      Invited by {invitedUser.invitedBy} on{" "}
                      {new Date(invitedUser.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {confirmDelete === invitedUser.email ? (
                      <div className="flex items-center gap-2">
                        <span className="font-sans text-xs text-slate">
                          Remove?
                        </span>
                        <button
                          onClick={() => handleRemove(invitedUser.email)}
                          className="rounded-lg bg-red-600 px-3 py-1.5 font-sans text-xs font-medium text-white transition-colors hover:bg-red-700"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="rounded-lg border border-gold-light px-3 py-1.5 font-sans text-xs font-medium text-slate transition-colors hover:bg-cream"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(invitedUser.email)}
                        className="rounded-lg border border-gold-light px-3 py-1.5 font-sans text-xs font-medium text-slate transition-colors hover:border-red-300 hover:text-red-600"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Admin Section */}
        <div className="rounded-2xl bg-white p-6 shadow-lg">
          <h2 className="mb-4 font-serif text-xl font-semibold text-charcoal">
            Admins
          </h2>
          {adminEmails.length === 0 ? (
            <p className="font-sans text-sm text-slate">
              No admin config found. Create the{" "}
              <code className="rounded bg-cream px-1 py-0.5 text-xs">
                config/settings
              </code>{" "}
              document in Firebase Console.
            </p>
          ) : (
            <ul className="mb-4 space-y-2">
              {adminEmails.map((adminEmail) => (
                <li
                  key={adminEmail}
                  className="flex items-center gap-2 font-sans text-sm text-charcoal"
                >
                  <span className="inline-block h-2 w-2 rounded-full bg-terracotta" />
                  {adminEmail}
                </li>
              ))}
            </ul>
          )}
          <p className="font-sans text-xs text-slate/70">
            To add or remove admins, contact the developer.
          </p>
        </div>
      </div>
    </div>
  );
}
