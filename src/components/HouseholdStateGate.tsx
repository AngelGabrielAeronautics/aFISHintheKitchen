"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useHousehold } from "@/context/HouseholdContext";

// Surfaces the household's lapse state to members: a read-only banner, or a
// blocking screen when suspended. The Firestore rules are the real write
// enforcement; this is the UX layer so people understand what's happening.
export default function HouseholdStateGate() {
  const { user } = useAuth();
  const { household, accessState, membership, loading } = useHousehold();
  const pathname = usePathname();

  if (loading || !user || !household) return null;

  const isOwner = membership?.role === "owner";
  // Don't block the settings page — the owner needs it to reactivate billing.
  const onBillingPage = pathname?.startsWith("/settings") ?? false;

  if (accessState === "suspended" && !onBillingPage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/70 p-4 backdrop-blur-sm">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
          <h2 className="mb-2 font-serif text-2xl text-charcoal">Cookbook suspended</h2>
          <p className="mb-6 font-sans text-sm text-slate">
            {isOwner
              ? "Your subscription has lapsed and this cookbook is suspended. Reactivate it to restore access for you and your members."
              : "This cookbook is suspended because the owner's subscription lapsed. Please ask them to reactivate it."}
          </p>
          {isOwner && (
            <Link
              href="/settings"
              className="inline-block rounded-lg bg-terracotta px-5 py-2.5 font-sans text-sm font-semibold text-white transition-colors hover:bg-terracotta-dark"
            >
              Reactivate subscription
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (accessState === "read_only") {
    return (
      <div className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-gold-light/90 px-4 py-2 text-center font-sans text-sm text-charcoal">
        <span>
          {isOwner
            ? "Your subscription has lapsed — this cookbook is read-only."
            : "This cookbook is read-only because the owner's subscription lapsed."}
        </span>
        {isOwner && (
          <Link href="/settings" className="font-semibold text-terracotta-dark underline">
            Update billing to restore editing
          </Link>
        )}
      </div>
    );
  }

  return null;
}
