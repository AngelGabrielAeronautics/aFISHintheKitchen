import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { DEVICE_TOKENS, deviceTokenId, registrationsFor } from "@/lib/device-tokens";

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

    // One registration per (device, book): the same token is filed under every
    // cookbook this user opens, so none of their books loses the device when
    // they switch to another. See lib/device-tokens.ts.
    await db.collection(DEVICE_TOKENS).doc(deviceTokenId(fcmToken, householdId)).set({
      token: fcmToken,
      uid,
      householdId,
      displayName: body.displayName?.trim() ?? "",
      updatedAt: new Date().toISOString(),
    });

    // Housekeeping on the device's OTHER registrations: retire the legacy
    // token-keyed doc (a 1.10 registration this one supersedes) and any
    // registration for a book this user has since left — otherwise a leaver
    // keeps receiving that cookbook's pushes.
    const mine = await db.collection("householdMembers").where("userId", "==", uid).get();
    const myBooks = new Set(mine.docs.map((d) => d.data().householdId as string));
    const others = await registrationsFor(db, fcmToken);
    await Promise.all(
      others
        .filter((d) => d.data().uid === uid)
        .filter((d) => d.id === fcmToken || !myBooks.has(d.data().householdId))
        .map((d) => d.ref.delete().catch(() => {}))
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("register-device error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// De-register on sign-out: without this a signed-out (or handed-over) device
// keeps receiving the household's push content.
export async function DELETE(req: NextRequest) {
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    let uid: string;
    try {
      uid = (await getAdminAuth().verifyIdToken(token)).uid;
    } catch {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }

    const body = (await req.json()) as { token?: string; householdId?: string };
    const fcmToken = body.token?.trim();
    if (!fcmToken) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

    // With a householdId: forget this device for that one book (leaving it).
    // Without: sign-out — forget it everywhere. Only the device's own
    // registrations can be removed.
    const db = getAdminDb();
    const only = body.householdId?.trim();
    const docs = await registrationsFor(db, fcmToken);
    await Promise.all(
      docs
        .filter((d) => d.data().uid === uid)
        .filter((d) => !only || d.data().householdId === only)
        .map((d) => d.ref.delete().catch(() => {}))
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("register-device delete error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
