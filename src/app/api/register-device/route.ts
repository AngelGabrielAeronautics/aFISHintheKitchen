import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

// Stores a device's FCM token so /api/push can target it. Keyed by token (so a
// re-registered token just updates), tagged with uid + householdId + display
// name. Server-mediated (Admin SDK) so no client write rules are needed.
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

    const body = (await req.json()) as { token?: string; householdId?: string; displayName?: string };
    const fcmToken = body.token?.trim();
    const householdId = body.householdId?.trim();
    if (!fcmToken || !householdId) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    // Confirm the caller really belongs to that household before tagging the token.
    const db = getAdminDb();
    const membership = await db
      .collection("householdMembers")
      .where("userId", "==", uid)
      .where("householdId", "==", householdId)
      .limit(1)
      .get();
    if (membership.empty) {
      return NextResponse.json({ error: "not_a_member" }, { status: 403 });
    }

    await db.collection("deviceTokens").doc(fcmToken).set({
      token: fcmToken,
      uid,
      householdId,
      displayName: body.displayName?.trim() ?? "",
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("register-device error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
