import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { JOIN_CODES, normaliseJoinCode } from "@/lib/join-codes";

export const runtime = "nodejs";

// POST /api/invite/code/revoke — the owner cancels an open join code.
// Body: { code }. A revoked code can never be redeemed; the doc stays as a record.
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
    const body = (await req.json().catch(() => ({}))) as { code?: string };
    const code = normaliseJoinCode(body.code ?? "");
    if (!code) return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    const db = getAdminDb();
    const ref = db.collection(JOIN_CODES).doc(code);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const hh = (await db.collection("households").doc(snap.data()!.householdId).get()).data();
    if (!hh || hh.ownerId !== uid) return NextResponse.json({ error: "not_owner" }, { status: 403 });
    if (snap.data()!.status === "open") {
      await ref.update({ status: "revoked", revokedAt: new Date().toISOString() });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("invite/code/revoke error:", err);
    return NextResponse.json({ error: "revoke_failed" }, { status: 500 });
  }
}
