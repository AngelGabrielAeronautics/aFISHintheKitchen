import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { buildShareSnapshot } from "@/lib/share-snapshot";
import { reportError } from "@/lib/error-reporting";

// After editing a recipe, the apps ask whether it has live share links and —
// with the editor's say-so — push the latest version to all of them (every
// family member's link, not just the caller's: the household's content is
// collective, and a stale link is stale no matter who minted it).
//
// Two-step by design: `apply: false` (or absent) only COUNTS, so the app can
// decide whether to prompt; `apply: true` re-freezes. Edits must never reach
// public links without someone choosing it — that's the whole point of
// snapshots.
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

    const { recipeId, apply } = (await req.json()) as { recipeId?: string; apply?: boolean };
    if (!recipeId) return NextResponse.json({ error: "missing_recipe" }, { status: 400 });

    const db = getAdminDb();
    const recipeSnap = await db.collection("recipes").doc(recipeId).get();
    if (!recipeSnap.exists) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const recipe = recipeSnap.data()!;

    // Caller must be a member of the recipe's household.
    const householdId = recipe.householdId as string | undefined;
    if (!householdId) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const membership = await db
      .collection("householdMembers")
      .where("userId", "==", uid)
      .where("householdId", "==", householdId)
      .limit(1)
      .get();
    if (membership.empty) return NextResponse.json({ error: "not_member" }, { status: 403 });

    const shares = await db.collection("sharedRecipes").where("recipeId", "==", recipeId).get();
    if (!apply) return NextResponse.json({ ok: true, shares: shares.size });

    // A recipe edited into draft state can't be public any more — but rather
    // than silently deleting the family's links, just refuse; the editor was
    // only offered this because links exist.
    if (recipe.draft === true) return NextResponse.json({ error: "draft" }, { status: 400 });

    const snapshot = buildShareSnapshot(recipe);
    const now = new Date().toISOString();
    await Promise.all(
      shares.docs.map((d) => d.ref.update({ snapshot, updatedAt: now })),
    );
    return NextResponse.json({ ok: true, updated: shares.size });
  } catch (e) {
    console.error("refresh-shares", e);
    reportError(e, { route: "refresh-shares" });
    return NextResponse.json({ error: "refresh_failed" }, { status: 500 });
  }
}
