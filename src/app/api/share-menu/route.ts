import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { randomBytes } from "crypto";

// Mint a collaboration link for an event menu. Unlike recipe shares (frozen
// snapshots), this token REFERENCES the live menu: guests see current state
// and interact through /api/shared-menu/respond — never through Firestore.
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

    const { collectionId } = (await req.json()) as { collectionId?: string };
    if (!collectionId) return NextResponse.json({ error: "missing_menu" }, { status: 400 });

    const db = getAdminDb();
    const menuSnap = await db.collection("collections").doc(collectionId).get();
    if (!menuSnap.exists) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const householdId = menuSnap.data()!.householdId as string;

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

    const existing = await db
      .collection("sharedMenus")
      .where("collectionId", "==", collectionId)
      .where("sharedByUid", "==", uid)
      .limit(1)
      .get();
    if (!existing.empty) return NextResponse.json({ ok: true, token: existing.docs[0].id });

    const shareToken = randomBytes(12).toString("base64url");
    await db.collection("sharedMenus").doc(shareToken).set({
      collectionId,
      householdId,
      sharedByUid: uid,
      sharedByName: sharerName,
      bookName,
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, token: shareToken });
  } catch (e) {
    console.error("share-menu", e);
    return NextResponse.json({ error: "share_failed" }, { status: 500 });
  }
}
