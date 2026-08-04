import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { isShareToken } from "@/lib/share-snapshot";

// Public: fetch a shared-recipe snapshot by token. Used by the iOS app when a
// share link opens in-app (the web page reads via Admin SDK directly).
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  if (!isShareToken(token)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const snap = await getAdminDb().collection("sharedRecipes").doc(token).get();
  if (!snap.exists) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const d = snap.data()!;
  return NextResponse.json({
    ok: true,
    sharedByName: d.sharedByName,
    bookName: d.bookName,
    createdAt: d.createdAt,
    recipe: d.snapshot,
  });
}
