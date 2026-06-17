import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, getAdminMessaging } from "@/lib/firebase-admin";

export const runtime = "nodejs";

// Fans a notification out as an APNs/FCM push to the right devices in a
// household. The in-app notification doc is still written client-side (for the
// inbox); this adds out-of-app delivery. Targets:
//   new-recipe        → everyone in the household except the author
//   event-assignment  → the assigned member's devices (by display name)
// Invalid tokens are pruned as we go.
export async function POST(req: NextRequest) {
  try {
    const auth = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    let authorUid: string;
    try {
      authorUid = (await getAdminAuth().verifyIdToken(auth)).uid;
    } catch {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }

    const body = (await req.json()) as {
      type?: string;
      householdId?: string;
      message?: string;
      link?: string;
      assignedMember?: string;
    };
    const { type, householdId, message } = body;
    const link = body.link ?? "/";
    if (!type || !householdId || !message) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    const db = getAdminDb();

    // Caller must belong to the household they're pushing to.
    const membership = await db
      .collection("householdMembers")
      .where("userId", "==", authorUid)
      .where("householdId", "==", householdId)
      .limit(1)
      .get();
    if (membership.empty) {
      return NextResponse.json({ error: "not_a_member" }, { status: 403 });
    }

    // Candidate device tokens for this household.
    const snap = await db.collection("deviceTokens").where("householdId", "==", householdId).get();
    let targets = snap.docs.map((d) => d.data() as { token: string; uid: string; displayName: string });

    if (type === "event-assignment" && body.assignedMember) {
      targets = targets.filter((t) => t.displayName === body.assignedMember);
    } else {
      // new-recipe (and any broadcast): everyone but the author.
      targets = targets.filter((t) => t.uid !== authorUid);
    }

    const tokens = [...new Set(targets.map((t) => t.token))].filter(Boolean);
    if (tokens.length === 0) return NextResponse.json({ ok: true, sent: 0 });

    const title = type === "event-assignment" ? "You've been assigned" : "New recipe";
    const res = await getAdminMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body: message },
      data: { link, type },
      apns: { payload: { aps: { sound: "default" } } },
    });

    // Prune tokens Apple/FCM rejected as unregistered.
    const stale: string[] = [];
    res.responses.forEach((r, i) => {
      const code = r.error?.code;
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
        stale.push(tokens[i]);
      }
    });
    await Promise.all(stale.map((t) => db.collection("deviceTokens").doc(t).delete().catch(() => {})));

    return NextResponse.json({ ok: true, sent: res.successCount, failed: res.failureCount });
  } catch (err) {
    console.error("push error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
