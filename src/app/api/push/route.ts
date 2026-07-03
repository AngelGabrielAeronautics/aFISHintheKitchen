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
    const { type, householdId } = body;
    const link = body.link ?? "/";
    if (!type || !householdId || !body.message) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }
    // Only our two known notification types may push, and the body is bounded so
    // a member can't blast arbitrary long content to the household.
    if (type !== "new-recipe" && type !== "event-assignment") {
      return NextResponse.json({ error: "invalid_type" }, { status: 400 });
    }
    const message = String(body.message).slice(0, 240);

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
      // Resolve the assignee to their account uid(s) via authoritative membership
      // (display names aren't unique and the request value is client-supplied), then
      // target that user's devices. A profile-only member with no account → no push.
      const memberSnap = await db
        .collection("householdMembers")
        .where("householdId", "==", householdId)
        .where("displayName", "==", body.assignedMember)
        .get();
      const assigneeUids = new Set(memberSnap.docs.map((d) => d.data().userId as string));
      targets = targets.filter((t) => assigneeUids.has(t.uid));
    } else {
      // new-recipe (and any broadcast): everyone but the author — minus anyone
      // who turned new-recipe alerts off (userPreferences.notifyNewRecipes).
      targets = targets.filter((t) => t.uid !== authorUid);
      const uids = [...new Set(targets.map((t) => t.uid))];
      const prefSnaps = await Promise.all(uids.map((uid) => db.collection("userPreferences").doc(uid).get()));
      const optedOut = new Set(
        prefSnaps.filter((s) => s.exists && s.data()?.notifyNewRecipes === false).map((s) => s.id)
      );
      targets = targets.filter((t) => !optedOut.has(t.uid));
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
