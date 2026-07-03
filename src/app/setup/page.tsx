"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useHousehold } from "@/context/HouseholdContext";

// New cookbooks are created in the iOS app (decided 2026-07-03): StoreKit owns
// the 14-day trial + billing, so web self-serve creation is closed. Invited
// members never land here — they join via their invite link. Set the App Store
// URL at launch; until then the page shows "coming soon".
const APP_STORE_URL: string | null = null;

export default function SetupPage() {
  const { user, loading: authLoading } = useAuth();
  const { household, loading: householdLoading } = useHousehold();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !householdLoading) {
      if (!user) router.push("/auth");
      else if (household) router.push("/");
    }
  }, [authLoading, householdLoading, user, household, router]);

  if (authLoading || householdLoading || !user || household) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cream-dark border-t-terracotta" />
      </main>
    );
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
            Start your cookbook in the app
          </h1>
          <p className="mt-2 font-sans text-sm text-slate">
            Family cookbooks are created in A Fish in the Kitchen for iPhone —
            with a free 14-day trial, recipe photo scanning, and cook mode at
            the stove.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 sm:p-8 shadow-lg ring-1 ring-charcoal/5 space-y-4 text-center">
          {APP_STORE_URL ? (
            <a
              href={APP_STORE_URL}
              className="block w-full rounded-lg bg-terracotta py-3 font-sans text-sm font-semibold text-white transition-colors hover:bg-terracotta-dark"
            >
              Download on the App Store
            </a>
          ) : (
            <p className="font-sans text-sm font-medium text-charcoal">
              Coming to the App Store very soon.
            </p>
          )}
          <p className="font-sans text-xs text-slate/70">
            Been invited to a family cookbook? Open the link in your invite
            email — joining is free and doesn&apos;t need a subscription.
          </p>
        </div>
      </div>
    </main>
  );
}
