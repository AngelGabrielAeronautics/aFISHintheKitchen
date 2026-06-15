import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

// Opens the Stripe Billing Portal for the signed-in owner — update card, switch
// plan, cancel, or resume. Reactivation after a lapse happens here too.
export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    let uid: string;
    try {
      uid = (await getAdminAuth().verifyIdToken(token)).uid;
    } catch {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }

    const body = (await req.json()) as { returnUrl?: string };
    const returnUrl = body.returnUrl?.trim();
    if (!returnUrl) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

    const subSnap = await getAdminDb().collection("subscriptions").doc(uid).get();
    const customerId = subSnap.exists ? (subSnap.data()?.providerCustomerId as string | undefined) : undefined;
    if (!customerId) {
      // No Stripe customer yet — they've never started checkout.
      return NextResponse.json({ error: "no_customer" }, { status: 409 });
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (err) {
    console.error("portal error:", err);
    return NextResponse.json({ error: "portal_failed" }, { status: 500 });
  }
}
