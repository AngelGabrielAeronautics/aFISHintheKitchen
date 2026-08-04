import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { isShareToken } from "@/lib/share-snapshot";

// Public: the LIVE state of a shared event menu — dishes with claim state and
// comments. Used by the iOS guest view and the /m/{token} web page.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  if (!isShareToken(token)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const db = getAdminDb();
  const shareSnap = await db.collection("sharedMenus").doc(token).get();
  if (!shareSnap.exists) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const share = shareSnap.data()!;
  const menuSnap = await db.collection("collections").doc(share.collectionId).get();
  if (!menuSnap.exists) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const menu = menuSnap.data()!;

  const ids: string[] = menu.recipeIds ?? [];
  const recipeSnaps = await Promise.all(ids.map((id) => db.collection("recipes").doc(id).get()));
  const assignments = (menu.assignments ?? {}) as Record<string, string[]>;
  const status = (menu.assignmentStatus ?? {}) as Record<string, Record<string, string>>;

  const recipes = recipeSnaps
    .filter((s) => s.exists)
    .map((s) => {
      const r = s.data()!;
      return {
        id: s.id,
        title: r.title ?? "",
        image: r.thumbUrl || r.image || "",
        assignees: (assignments[s.id] ?? []).map((name) => ({
          name,
          status: status[s.id]?.[name] ?? "pending",
        })),
      };
    });

  return NextResponse.json({
    ok: true,
    sharedByName: share.sharedByName,
    bookName: share.bookName,
    menu: {
      name: menu.name ?? "",
      description: menu.description ?? "",
      eventDate: menu.eventDate ?? null,
      recipes,
      comments: (menu.comments ?? []).map((c: { id: string; author: string; text: string; createdAt: string }) => c),
    },
  });
}
