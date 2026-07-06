import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { TRIAL_DAYS } from "@/lib/access";
import { STARTER_RECIPES, SAMPLE_MEMBERS } from "@/lib/starter-content";

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

    const body = (await req.json()) as {
      name?: string;
      tagline?: string;
      groupType?: string;
      starterRecipes?: boolean;
      sampleMembers?: boolean;
    };
    const name = body.name?.trim();
    if (!name) return NextResponse.json({ error: "missing_name" }, { status: 400 });

    // Who the cookbook is for — drives the default tagline and in-app wording.
    const groupType = (["family", "friends", "mixed", "solo"] as const).find((t) => t === body.groupType) ?? "family";
    const defaultTagline = {
      family: "The food your family is built on",
      friends: "The food your friendship is built on",
      mixed: "The food that brings us all together",
      solo: "The food that defines you",
    }[groupType];

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
      customisation: { brandName: name, tagline: body.tagline?.trim() || defaultTagline, groupType },
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
    // The owner is a member of their own cookbook — give them a profile card
    // (invited joiners get theirs from /api/join; owners were ghosts before).
    await db.collection("members").add({
      householdId: hhRef.id,
      userId: uid,                 // immutable link profile → account
      order: 0,
      name: tokenName || email || "Owner",
      title: "",
      bio: "",
      goodAt: [],
      loves: [],
      hates: [],
      favouriteFromBook: "",
      favouriteNotInBook: "",
    });

    // Opt-in starter content, so the new book is never an empty screen: a few
    // recipes from the founder family's Kookbook (deletable, flagged
    // starter:true) and example member profiles that show how profiles work.
    if (body.starterRecipes || body.sampleMembers) {
      const batch = db.batch();
      if (body.starterRecipes) {
        STARTER_RECIPES.forEach((recipe, i) => {
          batch.set(db.collection("recipes").doc(), {
            ...recipe,
            householdId: hhRef.id,
            starter: true,
            featured: false,
            // Staggered so "newest first" keeps the curated order.
            createdAt: new Date(Date.now() - i * 1000).toISOString(),
          });
        });
      }
      if (body.sampleMembers) {
        for (const member of SAMPLE_MEMBERS) {
          batch.set(db.collection("members").doc(), {
            ...member,
            householdId: hhRef.id,
            sample: true,
          });
        }
      }
      await batch.commit();
    }

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
