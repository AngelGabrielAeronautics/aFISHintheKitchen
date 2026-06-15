// Client helpers for billing actions. Both hit auth-required API routes and
// return a Stripe-hosted URL to redirect to.
import { getFirebaseAuth } from "@/lib/firebase";

const APP_ORIGIN = typeof window !== "undefined" ? window.location.origin : "";

async function authedPost(path: string, body: Record<string, unknown>): Promise<Response> {
  const token = await getFirebaseAuth().currentUser?.getIdToken();
  if (!token) throw new Error("not_signed_in");
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

// Start (or resume) a subscription via Stripe Checkout. Redirects on success.
export async function startCheckout(plan: "monthly" | "annual", householdId: string): Promise<void> {
  const res = await authedPost("/api/billing/checkout", {
    plan,
    householdId,
    successUrl: `${APP_ORIGIN}/settings?billing=success`,
    cancelUrl: `${APP_ORIGIN}/settings?billing=cancelled`,
  });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? "checkout_failed");
  window.location.href = data.url;
}

// Open the Stripe Billing Portal (update card, switch plan, cancel, resume).
export async function openBillingPortal(): Promise<void> {
  const res = await authedPost("/api/billing/portal", {
    returnUrl: `${APP_ORIGIN}/settings`,
  });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? "portal_failed");
  window.location.href = data.url;
}
