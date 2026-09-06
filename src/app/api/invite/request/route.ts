import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { MEMBER_REQUESTS, pendingFor, minesFor, type MemberRequest } from "@/lib/member-requests";
import { buildMemberRequestEmail } from "@/lib/auth-email";
import { sendTransactionalEmail } from "@/lib/email";
import { reportError } from "@/lib/error-reporting";

export const runtime = "nodejs";

/** The caller's membership of this cookbook, or null. */
async function membership(db: ReturnType<typeof getAdminDb>, uid: string, householdId: string) {
  const snap = await db
    .collection("householdMembers")
    .where("userId", "==", uid)
    .where("householdId", "==", householdId)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].data();
}

async function caller(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try {
    const d = await getAdminAuth().verifyIdToken(token);
    return { uid: d.uid, name: (d.name as string | undefined) || d.email || "A member" };
  } catch {
    return null;
  }
}

// POST /api/invite/request — a member asks the owner to let somebody in.
// Body: { householdId, forName, note? }. The owner gets an in-app notification
// and an email; nothing is minted until they approve.
export async function POST(req: NextRequest) {
  try {
    const me = await caller(req);
    if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const body = (await req.json().catch(() => ({}))) as { householdId?: string; forName?: string; note?: string };
    const householdId = body.householdId?.trim();
    const forName = body.forName?.trim().slice(0, 60);
    const note = body.note?.trim().slice(0, 200) || undefined;
    if (!householdId || !forName) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

    const db = getAdminDb();
    const mine = await membership(db, me.uid, householdId);
    if (!mine) return NextResponse.json({ error: "not_a_member" }, { status: 403 });

    const hhSnap = await db.collection("households").doc(householdId).get();
    if (!hhSnap.exists) return NextResponse.json({ error: "household_not_found" }, { status: 404 });
    const hh = hhSnap.data()!;
    if ((hh.accessState ?? "active") !== "active") {
      return NextResponse.json({ error: "household_inactive" }, { status: 403 });
    }
    // The owner has the button; they don't need to ask themselves.
    if (hh.ownerId === me.uid) return NextResponse.json({ error: "you_are_the_owner" }, { status: 409 });

    // One open request per person, per cookbook — a member tapping twice
    // should not give the owner the same decision to make twice.
    const already = (await pendingFor(db, householdId)).find(
      (r) => r.requestedBy === me.uid && r.forName.toLowerCase() === forName.toLowerCase()
    );
    if (already) return NextResponse.json({ error: "already_requested" }, { status: 409 });

    const now = new Date().toISOString();
    const doc: Omit<MemberRequest, "id"> = {
      householdId,
      requestedBy: me.uid,
      requestedByName: mine.displayName || me.name,
      forName,
      ...(note ? { note } : {}),
      status: "pending",
      createdAt: now,
    };
    const ref = await db.collection(MEMBER_REQUESTS).add(doc);

    const bookName: string = hh.customisation?.brandName || hh.name || "your cookbook";
    // In-app first — it is the one the owner will actually see, and it must
    // not depend on the mailer being up.
    await db.collection("notifications").add({
      householdId,
      type: "member-request",
      message: `${doc.requestedByName} would like to add ${forName} to ${bookName}`,
      link: "/invite",
      authorName: doc.requestedByName,
      createdAt: now,
      readBy: [],
    });

    let emailSent = false;
    try {
      const owner = await getAdminAuth().getUser(hh.ownerId);
      if (owner.email) {
        const { subject, html, text } = buildMemberRequestEmail({
          requesterName: doc.requestedByName,
          forName,
          bookName,
          note,
        });
        await sendTransactionalEmail({ to: owner.email, subject, html, text });
        emailSent = true;
      }
    } catch (err) {
      // The request is recorded and the in-app notification is up; a mailer
      // outage must not lose it.
      console.error("member request email failed:", err);
      reportError(err, { route: "invite/request", stage: "email" });
    }

    return NextResponse.json({ ok: true, id: ref.id, emailSent });
  } catch (err) {
    console.error("invite/request error:", err);
    return NextResponse.json({ error: "request_failed" }, { status: 500 });
  }
}

// GET /api/invite/request?householdId= — the owner gets the pending queue;
// anybody else gets their own requests, including the code once approved.
export async function GET(req: NextRequest) {
  try {
    const me = await caller(req);
    if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const householdId = req.nextUrl.searchParams.get("householdId")?.trim();
    if (!householdId) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

    const db = getAdminDb();
    if (!(await membership(db, me.uid, householdId))) {
      return NextResponse.json({ error: "not_a_member" }, { status: 403 });
    }
    const hh = (await db.collection("households").doc(householdId).get()).data();
    if (!hh) return NextResponse.json({ error: "household_not_found" }, { status: 404 });

    const isOwner = hh.ownerId === me.uid;
    const requests = isOwner ? await pendingFor(db, householdId) : await minesFor(db, householdId, me.uid);
    return NextResponse.json({ ok: true, isOwner, requests });
  } catch (err) {
    console.error("invite/request list error:", err);
    return NextResponse.json({ error: "request_failed" }, { status: 500 });
  }
}
