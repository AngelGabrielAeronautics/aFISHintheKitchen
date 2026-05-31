"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useHousehold } from "@/context/HouseholdContext";
import { useRouter } from "next/navigation";
import { updateHousehold, getHouseholdMembers, removeHouseholdMember } from "@/lib/firebase-recipes";
import type { HouseholdMember } from "@/lib/types";
import Avatar from "@/components/Avatar";

const inputClasses =
  "w-full rounded-lg border border-gold-light bg-warm-white px-4 py-3 font-sans text-sm text-charcoal outline-none focus:border-terracotta/50 focus:ring-2 focus:ring-terracotta/20";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { household, householdId, membership, loading: householdLoading } = useHousehold();
  const router = useRouter();

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const isOwner = membership?.role === "owner";
  // Only the owner manages a cookbook now (the "admin" role was retired).
  const isAdmin = isOwner;

  useEffect(() => {
    if (household) {
      setName(household.customisation.brandName);
      setTagline(household.customisation.tagline);
    }
  }, [household]);

  useEffect(() => {
    if (!householdId) return;
    getHouseholdMembers(householdId)
      .then(setMembers)
      .catch(() => {})
      .finally(() => setLoadingMembers(false));
  }, [householdId]);

  useEffect(() => {
    if (!authLoading && !householdLoading) {
      if (!user) router.push("/auth");
      else if (!household) router.push("/setup");
      // Cookbook settings are owner-only; send members to their account page.
      else if (membership && membership.role !== "owner") router.push("/account");
    }
  }, [authLoading, householdLoading, user, household, membership, router]);

  if (authLoading || householdLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cream-dark border-t-terracotta" />
      </main>
    );
  }

  if (!user || !household || !householdId) return null;
  // Members get redirected (effect above); render nothing meanwhile.
  if (!isOwner) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!householdId || !name.trim()) return;
    setSaving(true);
    try {
      await updateHousehold(householdId, {
        name: name.trim(),
        customisation: {
          brandName: name.trim(),
          tagline: tagline.trim() || "The food your family is built on",
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* silently fail */ }
    finally { setSaving(false); }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm("Remove this member from the household?")) return;
    setRemovingId(memberId);
    try {
      await removeHouseholdMember(memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch { /* silently fail */ }
    finally { setRemovingId(null); }
  }

  return (
    <main className="min-h-screen bg-cream py-8 sm:py-16 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-charcoal">
            Cookbook Settings
          </h1>
          <p className="mt-2 font-sans text-sm text-slate">
            Manage your family cookbook.
          </p>
        </div>

        {/* Branding */}
        <section className="rounded-2xl bg-white p-6 sm:p-8 shadow-lg">
          <h2 className="font-serif text-xl font-semibold text-charcoal mb-5">
            Branding
          </h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label htmlFor="brand-name" className="block font-sans text-sm font-medium text-charcoal mb-1.5">
                Cookbook Name
              </label>
              <input
                id="brand-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClasses}
                disabled={!isAdmin}
              />
            </div>
            <div>
              <label htmlFor="tagline" className="block font-sans text-sm font-medium text-charcoal mb-1.5">
                Tagline
              </label>
              <input
                id="tagline"
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Recipes worth sharing"
                className={inputClasses}
                disabled={!isAdmin}
              />
            </div>
            {isAdmin && (
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-terracotta px-5 py-2.5 font-sans text-sm font-medium text-white hover:bg-terracotta-dark disabled:opacity-40 cursor-pointer transition-colors"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                {saved && (
                  <span className="font-sans text-sm text-sage-dark">Saved</span>
                )}
              </div>
            )}
          </form>
        </section>

        {/* Members */}
        <section className="rounded-2xl bg-white p-6 sm:p-8 shadow-lg">
          <h2 className="font-serif text-xl font-semibold text-charcoal mb-5">
            Members
          </h2>
          {loadingMembers ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cream-dark border-t-terracotta" />
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg bg-warm-white px-4 py-3 ring-1 ring-cream-dark/30">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.displayName} size="md" ring />
                    <div>
                      <p className="font-sans text-sm font-medium text-charcoal">{m.displayName}</p>
                      <p className="font-sans text-[10px] text-slate/50 capitalize">{m.role}</p>
                    </div>
                  </div>
                  {isOwner && m.role !== "owner" && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(m.id)}
                      disabled={removingId === m.id}
                      className="font-sans text-xs text-slate/40 hover:text-red-500 transition-colors cursor-pointer disabled:opacity-40"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Household info */}
        <section className="rounded-2xl bg-warm-white p-6 ring-1 ring-cream-dark/30">
          <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-slate/50 mb-3">
            Household Info
          </h3>
          <div className="space-y-1 font-sans text-xs text-slate">
            <p>ID: <code className="bg-cream-dark/20 px-1.5 py-0.5 rounded text-[10px]">{householdId}</code></p>
            <p>Slug: <code className="bg-cream-dark/20 px-1.5 py-0.5 rounded text-[10px]">{household.slug}</code></p>
            <p>Plan: <span className="capitalize font-medium text-charcoal">{household.plan}</span></p>
            <p>Created: {new Date(household.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
