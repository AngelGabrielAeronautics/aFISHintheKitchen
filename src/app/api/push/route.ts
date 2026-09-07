import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { addInboxNotification, sendHouseholdPush } from "@/lib/push-send";
import type { PushPrefKey } from "@/lib/push-prefs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A member telling the rest of the cookbook something happened. The app calls
 * this with a type and a one-line message; the server decides who hears it.
 *
 *   new-recipe        everyone but the author            → "Family activity"
 *   cooked            everyone but the cook              → "Family activity"
 *   loved / noted     the recipe's author only           → "Family activity"
 *   event-assignment  the assignee only                  → "Events & menus"
 *
 * The family-activity trio is the app's answer to "out of sight, out of mind":
 * news about a PERSON — Granny cooked the roast, Mum loved your bobotie —
 * rather than a nudge to open an app. new-recipe's inbox row is still written
 * by the apps (it always was); the newer kinds get theirs here.
 */
const KINDS: Record<string, { title: string; prefKey: PushPrefKey; toAuthorOnly?: boolean; inbox?: boolean }> = {
  "new-recipe": { title: "New recipe", prefKey: "notifyNewRecipes" },
  cooked: { title: "Just cooked", prefKey: "notifyNewRecipes", inbox: true },
  loved: { title: "Loved it", prefKey: "notifyNewRecipes", toAuthorOnly: true, inbox: true },
  noted: { title: "New note", prefKey: "notifyNewRecipes", toAuthorOnly: true, inbox: true },
  "event-assignment": { title: "You've been assigned", prefKey: "notifyEvents", toAuthorOnly: true },
};

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
      /** The person a targeted kind is for (assignee, or the recipe's author). */
      targetMember?: string;
      /** Older apps' name for targetMember on event-assignment. */
      assignedMember?: string;
      recipeId?: string;
    };
    const { type, householdId } = body;
    const link = body.link ?? "/";
    if (!type || !householdId || !body.message) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }
    // Only known kinds may push, and the body is bounded so a member can't
    // blast arbitrary long content to the household.
    const kind = KINDS[type];
    if (!kind) return NextResponse.json({ error: "invalid_type" }, { status: 400 });
    const message = String(body.message).slice(0, 240);
    const target = body.targetMember ?? body.assignedMember;

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
    const authorName = (membership.docs[0].data().displayName as string | undefined) ?? "";

    // A targeted kind with nobody named goes to nobody — not to everybody.
    if (kind.toAuthorOnly && !target) return NextResponse.json({ ok: true, sent: 0 });

    const result = await sendHouseholdPush(db, {
      householdId,
      type,
      title: kind.title,
      message,
      link,
      prefKey: kind.prefKey,
      excludeUid: authorUid,
      targetNames: kind.toAuthorOnly && target ? [target] : undefined,
    });
    if (kind.inbox) {
      await addInboxNotification(db, { householdId, type, message, link, authorName, recipeId: body.recipeId });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("push error", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
