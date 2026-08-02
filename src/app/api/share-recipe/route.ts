import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { randomBytes } from "crypto";
import { buildShareSnapshot } from "@/lib/share-snapshot";

// Create a share link for a recipe: a frozen SNAPSHOT in sharedRecipes/{token}.
// A snapshot (a) never opens cross-household read access and (b) freezes what
// was shared — later edits and family-private content (verdicts, notes, edit
// history) are never exposed.
export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    let uid: string;
    let sharerName: string;
    try {
      const decoded = await getAdminAuth().verifyIdToken(token);
      uid = decoded.uid;
      sharerName = (decoded.name as string | undefined) ?? decoded.email ?? "A family member";
    } catch {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }

    const { recipeId } = (await req.json()) as { recipeId?: string };
    if (!recipeId) return NextResponse.json({ error: "missing_recipe" }, { status: 400 });

    const db = getAdminDb();
    const recipeSnap = await db.collection("recipes").doc(recipeId).get();
    if (!recipeSnap.exists) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const recipe = recipeSnap.data()!;
    if (recipe.draft === true) return NextResponse.json({ error: "draft" }, { status: 400 });

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

    const household = await db.collection("households").doc(householdId).get();
    const bookName =
      (household.data()?.customisation?.brandName as string | undefined) ??
      (household.data()?.name as string | undefined) ??
      "a family cookbook";

    const snapshot = buildShareSnapshot(recipe);

    // Reuse an existing live share of the same recipe by the same user, so
    // repeated shares don't mint endless tokens — but RE-FREEZE the snapshot
    // first. Each share should send the recipe as it is NOW; the frozen copy
    // exists so later edits don't leak, not to trap old recipients on the
    // version from the first-ever share. (Already-sent links update too —
    // acceptable: the sharer just re-shared this recipe, so "current as of the
    // latest share" is what they mean.)
    const existing = await db
      .collection("sharedRecipes")
      .where("recipeId", "==", recipeId)
      .where("sharedByUid", "==", uid)
      .limit(1)
      .get();
    if (!existing.empty) {
      await existing.docs[0].ref.update({
        snapshot,
        bookName,
        sharedByName: sharerName,
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true, token: existing.docs[0].id });
    }

    const shareToken = randomBytes(12).toString("base64url"); // 16 url-safe chars
    await db.collection("sharedRecipes").doc(shareToken).set({
      recipeId,
      householdId,
      sharedByUid: uid,
      sharedByName: sharerName,
      bookName,
      createdAt: new Date().toISOString(),
      snapshot,
    });
    return NextResponse.json({ ok: true, token: shareToken });
  } catch (e) {
    console.error("share-recipe", e);
    return NextResponse.json({ error: "share_failed" }, { status: 500 });
  }
}
