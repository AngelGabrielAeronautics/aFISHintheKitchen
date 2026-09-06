import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { MAX_SEATS } from "@/lib/access";
import { INVITES } from "@/lib/invites";
import { JOIN_CODES, JOIN_CODE_TTL_MS, newJoinCode, isOpen, type JoinCode } from "@/lib/join-codes";
import { MEMBER_REQUESTS, type MemberRequest } from "@/lib/member-requests";
import { buildMemberRequestDecidedEmail } from "@/lib/auth-email";
import { sendTransactionalEmail } from "@/lib/email";
import { reportError } from "@/lib/error-reporting";

export const runtime = "nodejs";

// POST /api/invite/request/decide — the owner answers a member's request.
// Body: { id, approve }. Approving is what MINTS the join code: the request is
// a decision, not a reservation, so the seat cap is checked here and not when
// the member asked. The code lands on the request doc, which is the one place
// the requester may read it (joinCodes itself is unreadable by clients).
export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    let uid: string;
    let ownerName: string;
    try {
      const d = await getAdminAuth().verifyIdToken(token);
      uid = d.uid;
      ownerName = (d.name as string | undefined) || d.email || "The owner";
    } catch {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { id?: string; approve?: boolean };
    const id = body.id?.trim();
    const approve = body.approve === true;
    if (!id) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

    const db = getAdminDb();
    const ref = db.collection(MEMBER_REQUESTS).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const request = { id, ...(snap.data() as Omit<MemberRequest, "id">) };
    if (request.status !== "pending") {
      // ⚠ `requestStatus`, not `status`: a body field called `status` collides
      // with the HTTP status in any client that merges the two.
      return NextResponse.json({ error: "already_decided", requestStatus: request.status }, { status: 409 });
    }

    const hhSnap = await db.collection("households").doc(request.householdId).get();
    if (!hhSnap.exists) return NextResponse.json({ error: "household_not_found" }, { status: 404 });
    const hh = hhSnap.data()!;
    if (hh.ownerId !== uid) return NextResponse.json({ error: "not_owner" }, { status: 403 });

    const now = new Date().toISOString();
    const bookName: string = hh.customisation?.brandName || hh.name || "the cookbook";
    let code: string | undefined;
    let expiresAt: string | undefined;

    if (approve) {
      if ((hh.accessState ?? "active") !== "active") {
        return NextResponse.json({ error: "household_inactive" }, { status: 403 });
      }
      // Seats, counted the way /api/invite/code counts them: members + pending
      // email invites + open codes. Checked HERE because approving is what
      // takes the seat.
      const [membersSnap, pendingSnap, codesSnap, subSnap] = await Promise.all([
        db.collection("householdMembers").where("householdId", "==", request.householdId).where("role", "==", "member").get(),
        db.collection(INVITES).where("householdId", "==", request.householdId).where("status", "==", "pending").get(),
        db.collection(JOIN_CODES).where("householdId", "==", request.householdId).where("status", "==", "open").get(),
        db.collection("subscriptions").doc(hh.ownerId).get(),
      ]);
      const openCodes = codesSnap.docs.filter((d) => isOpen({ ...(d.data() as JoinCode), code: d.id }));
      const extraSeats: number = subSnap.exists ? (subSnap.data()?.extraSeats ?? 0) : 0;
      const limit = MAX_SEATS + extraSeats;
      if (membersSnap.size + pendingSnap.size + openCodes.length >= limit) {
        return NextResponse.json({ error: "seat_limit", limit }, { status: 409 });
      }

      expiresAt = new Date(Date.now() + JOIN_CODE_TTL_MS).toISOString();
      code = newJoinCode();
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await db.collection(JOIN_CODES).doc(code).create({
            householdId: request.householdId,
            createdBy: uid,
            createdByName: ownerName,
            forName: request.forName,
            createdAt: now,
            expiresAt,
            status: "open",
          } satisfies Omit<JoinCode, "code">);
          break;
        } catch (err) {
          if (attempt === 2) throw err;
          code = newJoinCode();
        }
      }
    }

    await ref.update({
      status: approve ? "approved" : "declined",
      decidedAt: now,
      decidedBy: uid,
      ...(code ? { joinCode: code, joinCodeExpiresAt: expiresAt } : {}),
    });

    // Tell the requester, in the app and by email. In-app first: it does not
    // depend on the mailer, and it is where they will look.
    await db.collection("notifications").add({
      householdId: request.householdId,
      type: "member-request-decided",
      message: approve
        ? `Your request to add ${request.forName} was approved — the join code is ready to share`
        : `Your request to add ${request.forName} wasn't approved`,
      link: "/invite",
      authorName: ownerName,
      createdAt: now,
      readBy: [],
    });

    try {
      const requester = await getAdminAuth().getUser(request.requestedBy);
      if (requester.email) {
        const { subject, html, text } = buildMemberRequestDecidedEmail({
          forName: request.forName,
          bookName,
          approved: approve,
          code,
        });
        await sendTransactionalEmail({ to: requester.email, subject, html, text });
      }
    } catch (err) {
      console.error("member request decision email failed:", err);
      reportError(err, { route: "invite/request/decide", stage: "email" });
    }

    return NextResponse.json({ ok: true, approved: approve, code, expiresAt });
  } catch (err) {
    console.error("invite/request/decide error:", err);
    return NextResponse.json({ error: "decide_failed" }, { status: 500 });
  }
}
