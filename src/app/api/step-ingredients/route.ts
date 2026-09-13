import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { checkThrottle } from "@/lib/recipe-ai";
import { refreshStepIngredients, sweepStepIngredients } from "@/lib/step-ingredients";
import { verifySuperAdmin } from "@/lib/admin-auth";
import { reportError } from "@/lib/error-reporting";

export const runtime = "nodejs";
// A batch of 20 at ~5s each; a single recipe is one call.
export const maxDuration = 120;

// POST /api/step-ingredients
//   { recipeId }            — a member refreshes one recipe's Cook Mode map.
//                             The apps call this fire-and-forget after a save;
//                             a stale hash just means text-matching until then.
//   { all: true, limit? }   — superadmin: sweep up to `limit` stale recipes now
//                             (the nightly cron does the same unattended).
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
    const body = (await req.json().catch(() => ({}))) as { recipeId?: string; all?: boolean; limit?: number };
    const db = getAdminDb();

    if (body.all === true) {
      const admin = await verifySuperAdmin(req.headers.get("authorization"));
      if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
      const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 40);
      const result = await sweepStepIngredients(db, limit);
      return NextResponse.json({ ok: true, ...result });
    }

    const recipeId = body.recipeId?.trim();
    if (!recipeId) return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    const recipe = await db.collection("recipes").doc(recipeId).get();
    if (!recipe.exists) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const membership = await db.collection("householdMembers")
      .where("userId", "==", uid).where("householdId", "==", recipe.data()!.householdId).limit(1).get();
    if (membership.empty) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    // Saves are the only caller; 60/hour is a family editing furiously.
    const throttle = await checkThrottle("stepIngredientsThrottle", uid, 60, 600);
    if (throttle !== "ok") return NextResponse.json({ error: "rate_limited" }, { status: 429 });

    const status = await refreshStepIngredients(db, recipeId, { uid, route: "step-ingredients" });
    return NextResponse.json({ ok: true, status });
  } catch (err) {
    console.error("step-ingredients error:", err);
    reportError(err, { route: "step-ingredients" });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
