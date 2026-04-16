"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useHousehold } from "@/context/HouseholdContext";
import { createHousehold, isSlugAvailable } from "@/lib/firebase-recipes";

const inputClasses =
  "w-full rounded-lg border border-gold-light bg-warm-white px-4 py-3 font-sans text-sm text-charcoal outline-none focus:border-terracotta/50 focus:ring-2 focus:ring-terracotta/20";

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export default function SetupPage() {
  const { user, loading: authLoading } = useAuth();
  const { household, loading: householdLoading } = useHousehold();
  const router = useRouter();

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const slug = nameToSlug(name);

  if (authLoading || householdLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cream-dark border-t-terracotta" />
      </main>
    );
  }

  if (!user) {
    router.push("/auth");
    return null;
  }

  if (household) {
    router.push("/");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !user) return;

    setSubmitting(true);
    setError("");

    try {
      const finalSlug = nameToSlug(name);
      const available = await isSlugAvailable(finalSlug);
      if (!available) {
        setError("This name is already taken. Try a different one.");
        setSubmitting(false);
        return;
      }

      await createHousehold({
        name: name.trim(),
        slug: finalSlug,
        ownerId: user.uid,
        ownerName: user.displayName || user.email || "Owner",
        customisation: {
          brandName: name.trim(),
          tagline: tagline.trim() || "Family Recipes Worth Catching",
        },
      });

      // Force reload to pick up the new household in context
      window.location.href = "/";
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-terracotta/10">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-terracotta">
              <path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <h1 className="mt-4 font-serif text-2xl font-bold text-charcoal">
            Create your family cookbook
          </h1>
          <p className="mt-2 font-sans text-sm text-slate">
            Give your cookbook a name and start adding recipes.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 sm:p-8 shadow-lg ring-1 ring-charcoal/5 space-y-5">
          <div>
            <label htmlFor="name" className="block font-sans text-sm font-medium text-charcoal mb-1.5">
              Cookbook Name <span className="text-terracotta">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. The Smith Family Kitchen"
              className={inputClasses}
              required
            />
            {slug && (
              <p className="mt-1.5 font-sans text-[11px] text-slate/60">
                Your URL: cookapp.com/<span className="font-medium text-charcoal">{slug}</span>
              </p>
            )}
          </div>

          <div>
            <label htmlFor="tagline" className="block font-sans text-sm font-medium text-charcoal mb-1.5">
              Tagline <span className="text-slate/50 font-normal">(optional)</span>
            </label>
            <input
              id="tagline"
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="e.g. Recipes worth sharing"
              className={inputClasses}
            />
          </div>

          {error && (
            <p className="font-sans text-sm text-red-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="w-full rounded-lg bg-terracotta py-3 font-sans text-sm font-semibold text-white transition-colors hover:bg-terracotta-dark disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? "Creating..." : "Create Cookbook"}
          </button>
        </form>
      </div>
    </main>
  );
}
