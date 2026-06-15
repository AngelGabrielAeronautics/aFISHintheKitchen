"use client";

import { useEffect, useState } from "react";
import { getSubscription } from "@/lib/firebase-recipes";
import { startCheckout, openBillingPortal } from "@/lib/billing-client";
import type { Subscription } from "@/lib/types";

// Owner-only billing panel for /settings: shows subscription status and the
// right action — Subscribe (start the 14-day trial) for new owners, or Manage
// billing (Stripe portal) for existing ones. Reactivation after a lapse routes
// through the portal when a Stripe customer exists, else a fresh checkout.
export default function BillingSection({
  userId,
  householdId,
}: {
  userId: string;
  householdId: string;
}) {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getSubscription(userId)
      .then(setSub)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  async function subscribe(plan: "monthly" | "annual") {
    setBusy(true);
    setError("");
    try {
      await startCheckout(plan, householdId);
    } catch {
      setError("Couldn't start checkout. Please try again.");
      setBusy(false);
    }
  }

  async function manage() {
    setBusy(true);
    setError("");
    try {
      await openBillingPortal();
    } catch {
      setError("Couldn't open the billing portal. Please try again.");
      setBusy(false);
    }
  }

  const status = sub?.status ?? "none";
  const hasCustomer = Boolean(sub?.providerCustomerId);
  // "In good standing" → show the manage button; otherwise prompt to (re)subscribe.
  const active = status === "active" || status === "trialing";

  return (
    <section className="rounded-2xl bg-white p-6 sm:p-8 shadow-lg">
      <h2 className="mb-5 font-serif text-xl font-semibold text-charcoal">Subscription</h2>

      {error && (
        <div className="mb-4 rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 font-sans text-sm text-amber-900">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-cream-dark border-t-terracotta" />
        </div>
      ) : active ? (
        <>
          <StatusLine sub={sub!} />
          <button
            type="button"
            onClick={manage}
            disabled={busy}
            className="mt-5 rounded-lg bg-terracotta px-5 py-2.5 font-sans text-sm font-medium text-white transition-colors hover:bg-terracotta-dark disabled:opacity-40 cursor-pointer"
          >
            {busy ? "Opening…" : "Manage billing"}
          </button>
        </>
      ) : (
        <>
          <p className="mb-1 font-sans text-sm text-slate">
            {status === "past_due"
              ? "Your last payment didn't go through. Update your billing to keep your cookbook active."
              : status === "canceled"
                ? "Your subscription has ended. Reactivate to restore full access for you and your members."
                : "Start your 14-day free trial to add recipes, invite family, and keep your cookbook active. You won't be charged until the trial ends."}
          </p>

          {hasCustomer ? (
            <button
              type="button"
              onClick={manage}
              disabled={busy}
              className="mt-4 rounded-lg bg-terracotta px-5 py-2.5 font-sans text-sm font-medium text-white transition-colors hover:bg-terracotta-dark disabled:opacity-40 cursor-pointer"
            >
              {busy ? "Opening…" : "Reactivate subscription"}
            </button>
          ) : (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => subscribe("monthly")}
                disabled={busy}
                className="flex-1 rounded-lg bg-terracotta px-5 py-3 font-sans text-sm font-medium text-white transition-colors hover:bg-terracotta-dark disabled:opacity-40 cursor-pointer"
              >
                <span className="block font-semibold">Monthly</span>
                <span className="block text-xs text-white/80">$4.99 / month</span>
              </button>
              <button
                type="button"
                onClick={() => subscribe("annual")}
                disabled={busy}
                className="flex-1 rounded-lg bg-sage px-5 py-3 font-sans text-sm font-medium text-white transition-colors hover:bg-sage-dark disabled:opacity-40 cursor-pointer"
              >
                <span className="block font-semibold">Annual · 2 months free</span>
                <span className="block text-xs text-white/80">$49.90 / year</span>
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function StatusLine({ sub }: { sub: Subscription }) {
  const planLabel = sub.plan === "annual" ? "Annual" : sub.plan === "monthly" ? "Monthly" : "—";
  if (sub.status === "trialing") {
    return (
      <p className="font-sans text-sm text-slate">
        <span className="font-medium text-sage-dark">Free trial</span>
        {sub.trialEndsAt ? ` — ends ${formatDate(sub.trialEndsAt)}` : ""}. {planLabel} plan begins after.
      </p>
    );
  }
  return (
    <p className="font-sans text-sm text-slate">
      <span className="font-medium text-sage-dark">Active</span> · {planLabel}
      {sub.currentPeriodEnd ? ` — renews ${formatDate(sub.currentPeriodEnd)}` : ""}
    </p>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
