import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { MAX_SEATS } from "@/lib/access";
import { INVITES } from "@/lib/invites";
import { JOIN_CODES, JOIN_CODE_TTL_MS, joinLink, newJoinCode, isOpen, type JoinCode } from "@/lib/join-codes";

export const runtime = "nodejs";

// POST /api/invite/code — the owner mints a join code for their cookbook.
// Body: { householdId, forName? }. Returns { code, link, expiresAt }.
//
// The code is the invitation itself (see lib/join-codes.ts): the invitee
// redeems it in the app as whichever account they already have, so it never
// matters which of their emails the owner knew about. Seats are checked at
// redemption, but an owner cannot mint past the cap either: open codes count
// as pending seats here, exactly as pending email invites do.
export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    let uid: string;
    let callerName: string;
    let callerVerified: boolean;
    try {
      const decoded = await getAdminAuth().verifyIdToken(token);
      uid = decoded.uid;
      callerName = (decoded.name as string | undefined) || decoded.email || "The owner";
      callerVerified = decoded.email_verified === true;
    } catch {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { householdId?: string; forName?: string };
    const householdId = body.householdId?.trim();
    if (!householdId) return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    const forName = body.forName?.trim().slice(0, 60) || undefined;

    const db = getAdminDb();
    const hhSnap = await db.collection("households").doc(householdId).get();
    if (!hhSnap.exists) return NextResponse.json({ error: "household_not_found" }, { status: 404 });
    const hh = hhSnap.data()!;
    if (hh.ownerId !== uid) return NextResponse.json({ error: "not_owner" }, { status: 403 });
    if (!callerVerified) return NextResponse.json({ error: "email_unverified" }, { status: 403 });
    if ((hh.accessState ?? "active") !== "active") {
      return NextResponse.json({ error: "household_inactive" }, { status: 403 });
    }

    // Seat cap: members + pending email invites + open codes.
    const [membersSnap, pendingSnap, codesSnap, subSnap] = await Promise.all([
      db.collection("householdMembers").where("householdId", "==", householdId).where("role", "==", "member").get(),
      db.collection(INVITES).where("householdId", "==", householdId).where("status", "==", "pending").get(),
      db.collection(JOIN_CODES).where("householdId", "==", householdId).where("status", "==", "open").get(),
      db.collection("subscriptions").doc(hh.ownerId).get(),
    ]);
    const openCodes = codesSnap.docs.filter((d) => isOpen({ ...(d.data() as JoinCode), code: d.id }));
    const extraSeats: number = subSnap.exists ? (subSnap.data()?.extraSeats ?? 0) : 0;
    const limit = MAX_SEATS + extraSeats;
    const used = membersSnap.size + pendingSnap.size + openCodes.length;
    if (used >= limit) {
      return NextResponse.json({ error: "seat_limit", limit }, { status: 409 });
    }

    // Mint. Collisions are astronomically unlikely at 26^8, but a bearer token
    // must never silently overwrite another, so create() rather than set().
    const now = Date.now();
    let code = newJoinCode();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await db.collection(JOIN_CODES).doc(code).create({
          householdId,
          createdBy: uid,
          createdByName: callerName,
          ...(forName ? { forName } : {}),
          createdAt: new Date(now).toISOString(),
          expiresAt: new Date(now + JOIN_CODE_TTL_MS).toISOString(),
          status: "open",
        } satisfies Omit<JoinCode, "code">);
        break;
      } catch (err) {
        if (attempt === 2) throw err;
        code = newJoinCode();
      }
    }

    return NextResponse.json({
      ok: true,
      code,
      link: joinLink(code),
      // Echoed so the apps can list "Mum · 86AQ-X9YQ" without a refetch — the
      // first-invite step showed every code as "Invite" while this was missing.
      ...(forName ? { forName } : {}),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + JOIN_CODE_TTL_MS).toISOString(),
      householdName: hh.customisation?.brandName ?? hh.name ?? "",
    });
  } catch (err) {
    console.error("invite/code error:", err);
    return NextResponse.json({ error: "code_failed" }, { status: 500 });
  }
}

// GET /api/invite/code?householdId= — the owner's open codes, for the invite
// list (codes are server-only data; the client cannot query them).
export async function GET(req: NextRequest) {
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    let uid: string;
    try {
      uid = (await getAdminAuth().verifyIdToken(token)).uid;
    } catch {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }
    const householdId = req.nextUrl.searchParams.get("householdId")?.trim();
    if (!householdId) return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    const db = getAdminDb();
    const hh = (await db.collection("households").doc(householdId).get()).data();
    if (!hh) return NextResponse.json({ error: "household_not_found" }, { status: 404 });
    if (hh.ownerId !== uid) return NextResponse.json({ error: "not_owner" }, { status: 403 });
    const snap = await db.collection(JOIN_CODES).where("householdId", "==", householdId).where("status", "==", "open").get();
    const codes = snap.docs
      .map((d) => ({ ...(d.data() as Omit<JoinCode, "code">), code: d.id }))
      .filter((c) => isOpen(c))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map((c) => ({ code: c.code, link: joinLink(c.code), forName: c.forName ?? null, createdAt: c.createdAt, expiresAt: c.expiresAt }));
    return NextResponse.json({ ok: true, codes });
  } catch (err) {
    console.error("invite/code list error:", err);
    return NextResponse.json({ error: "code_failed" }, { status: 500 });
  }
}
