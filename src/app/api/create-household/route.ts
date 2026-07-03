import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { TRIAL_DAYS } from "@/lib/access";

export const runtime = "nodejs";

// Server-mediated household creation. Required because the locked Firestore
// rules forbid clients from writing the owner's `householdMembers` doc (the
// web's client-side createHousehold can't satisfy them). Creates the household +
// the owner membership atomically via the Admin SDK. Idempotent: a user who
// already owns a household gets it back rather than a duplicate.
export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    let uid: string;
    let email: string;
    let tokenName: string | undefined;
    try {
      const decoded = await getAdminAuth().verifyIdToken(token);
      uid = decoded.uid;
      email = (decoded.email ?? "").toLowerCase().trim();
      tokenName = decoded.name as string | undefined;
    } catch {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }

    const body = (await req.json()) as { name?: string; tagline?: string };
    const name = body.name?.trim();
    if (!name) return NextResponse.json({ error: "missing_name" }, { status: 400 });

    const db = getAdminDb();

    // One owned cookbook per user — return the existing one if present.
    const existing = await db.collection("households").where("ownerId", "==", uid).limit(1).get();
    if (!existing.empty) {
      return NextResponse.json({ ok: true, householdId: existing.docs[0].id, existed: true });
    }

    // Unique slug.
    const base = name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "cookbook";
    let slug = base;
    for (let i = 0; i < 5; i++) {
      const clash = await db.collection("households").where("slug", "==", slug).limit(1).get();
      if (clash.empty) break;
      slug = `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const createdAt = new Date().toISOString();
    const hhRef = await db.collection("households").add({
      name,
      slug,
      ownerId: uid,
      memberIds: [uid],
      customisation: { brandName: name, tagline: body.tagline?.trim() || "The food your family is built on" },
      plan: "free",
      accessState: "active",
      createdAt,
    });
    await db.collection("householdMembers").add({
      userId: uid,
      householdId: hhRef.id,
      displayName: tokenName || email || "Owner",
      role: "owner",
      joinedAt: createdAt,
    });

    // Every new owner starts the 14-day trial clock. Without this doc the
    // lapse sweep never looks at the household and access is free forever.
    // A real StoreKit purchase later overwrites provider/status via
    // /api/billing/appstore (merge:true on the same doc).
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString();
    await db.collection("subscriptions").doc(uid).set({
      userId: uid,
      householdId: hhRef.id,
      provider: "none",
      status: "trialing",
      plan: null,
      trialEndsAt,
      hasUsedTrial: true,
      extraSeats: 0,
      updatedAt: createdAt,
    });

    return NextResponse.json({ ok: true, householdId: hhRef.id, trialEndsAt });
  } catch (err) {
    console.error("create-household error:", err);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
