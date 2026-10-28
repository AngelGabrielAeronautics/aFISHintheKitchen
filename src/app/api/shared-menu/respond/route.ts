import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { sendHouseholdPush } from "@/lib/push-send";
import { isShareToken } from "@/lib/share-snapshot";
import { checkThrottle } from "@/lib/recipe-ai";
import { FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "crypto";

// A menu doc must stay well under Firestore's 1 MB limit, or the family can no
// longer save it. 500-char comments × 200 is ~100 KB plus overhead.
const MAX_COMMENTS = 200;

export const runtime = "nodejs";

// Guest interactions on a shared event menu: claim a dish, unclaim yourself,
// or comment. The token is the capability; the caller just needs a signed-in
// app account (any household, or none). All writes happen HERE via the Admin
// SDK — guests never get Firestore access to the host family's data.
//
// ⚠ Hardened 2026-10-28 (audit A9):
//  - A guest's claim is remembered by UID (`guestClaimUids.{recipeId}.{name}`),
//    and "unclaim" only removes a name THIS account claimed. Names are
//    self-chosen: before, a link holder who renamed themselves "Mum" could
//    unclaim Mum's real assignment.
//  - Comments are capped per menu and rate-limited per account, so one link
//    holder can't fill the doc to Firestore's 1 MB limit and lock the family
//    out of their own menu.
//  - Pushes go through sendHouseholdPush, which only reaches CURRENT members
//    (it used to hit every device ever registered to the book).
//  - The token is validated before it becomes a document path.
export async function POST(req: NextRequest) {
  try {
    const auth = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    let guestName: string;
    let guestUid: string;
    try {
      const decoded = await getAdminAuth().verifyIdToken(auth);
      guestUid = decoded.uid;
      guestName = ((decoded.name as string | undefined) ?? decoded.email ?? "").trim();
    } catch {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }
    if (!guestName) return NextResponse.json({ error: "no_name" }, { status: 400 });

    const body = (await req.json()) as {
      token?: string;
      action?: "claim" | "unclaim" | "comment";
      recipeId?: string;
      text?: string;
    };
    if (!body.token || !body.action) return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    // A token with a "/" is an invalid document path and would throw (500).
    if (!isShareToken(body.token)) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const db = getAdminDb();
    const shareSnap = await db.collection("sharedMenus").doc(body.token).get();
    if (!shareSnap.exists) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const share = shareSnap.data()!;
    const menuRef = db.collection("collections").doc(share.collectionId);

    let notifyMessage: string | null = null;
    const now = new Date().toISOString();

    if (body.action === "comment") {
      const text = (body.text ?? "").trim().slice(0, 500);
      if (!text) return NextResponse.json({ error: "empty_comment" }, { status: 400 });
      if ((await checkThrottle("menuCommentThrottle", guestUid, 20, 200)) !== "ok") {
        return NextResponse.json({ error: "rate_limited" }, { status: 429 });
      }
      const full = await db.runTransaction(async (tx) => {
        const snap = await tx.get(menuRef);
        if (!snap.exists) return "not_found";
        if (((snap.data()!.comments as unknown[] | undefined) ?? []).length >= MAX_COMMENTS) return "full";
        tx.update(menuRef, {
          comments: FieldValue.arrayUnion({ id: randomUUID(), author: `${guestName} (guest)`, text, createdAt: now }),
        });
        return null;
      });
      if (full === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
      if (full === "full") return NextResponse.json({ error: "comments_full" }, { status: 409 });
      notifyMessage = `${guestName} commented on ${share.bookName}'s menu`;
    } else {
      if (!body.recipeId) return NextResponse.json({ error: "missing_recipe" }, { status: 400 });
      const rid = body.recipeId;
      let dishTitle = "a dish";
      // The family's own names (profile cards + accounts). A guest claim made
      // before claims were recorded by uid can still be withdrawn — but never
      // a name that belongs to the family.
      const familyNames = new Set<string>();
      if (body.action === "unclaim") {
        const [profiles, accounts] = await Promise.all([
          db.collection("members").where("householdId", "==", share.householdId).get(),
          db.collection("householdMembers").where("householdId", "==", share.householdId).get(),
        ]);
        profiles.docs.forEach((d) => d.data().name && familyNames.add(String(d.data().name).trim()));
        accounts.docs.forEach((d) => d.data().displayName && familyNames.add(String(d.data().displayName).trim()));
      }
      const conflict = await db.runTransaction(async (tx) => {
        const snap = await tx.get(menuRef);
        if (!snap.exists) return "not_found";
        const menu = snap.data()!;
        if (!(menu.recipeIds ?? []).includes(rid)) return "not_found";
        const dish = await tx.get(db.collection("recipes").doc(rid));
        dishTitle = (dish.data()?.title as string | undefined) ?? "a dish";
        const assignments = { ...(menu.assignments ?? {}) } as Record<string, string[]>;
        const status = { ...(menu.assignmentStatus ?? {}) } as Record<string, Record<string, string>>;
        const claimUids = { ...(menu.guestClaimUids ?? {}) } as Record<string, Record<string, string>>;
        let names = [...(assignments[rid] ?? [])];
        const rs = { ...(status[rid] ?? {}) };
        const rc = { ...(claimUids[rid] ?? {}) };
        if (body.action === "claim") {
          if (names.includes(guestName)) return null; // idempotent
          if (names.length >= 3) return "slots_full";
          names.push(guestName);
          rs[guestName] = "accepted"; // claiming IS accepting
          rc[guestName] = guestUid;
        } else {
          // Only a name this account claimed. Anyone else's — a family
          // member's, or another guest's — is not ours to remove.
          if (!names.includes(guestName)) return null; // idempotent
          const legacyGuestClaim = rc[guestName] === undefined && !familyNames.has(guestName);
          if (rc[guestName] !== guestUid && !legacyGuestClaim) return "not_yours";
          names = names.filter((n) => n !== guestName);
          delete rs[guestName];
          delete rc[guestName];
        }
        assignments[rid] = names;
        status[rid] = rs;
        claimUids[rid] = rc;
        tx.update(menuRef, {
          assignments,
          assignmentStatus: status,
          guestClaimUids: claimUids,
          editHistory: FieldValue.arrayUnion({
            editor: `${guestName} (guest)`,
            date: now,
            summary: body.action === "claim" ? `${guestName} will bring ${dishTitle}` : `${guestName} can no longer bring ${dishTitle}`,
          }),
        });
        return null;
      });
      if (conflict === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
      if (conflict === "slots_full") return NextResponse.json({ error: "slots_full" }, { status: 409 });
      if (conflict === "not_yours") return NextResponse.json({ error: "not_yours" }, { status: 403 });
      notifyMessage =
        body.action === "claim" ? `${guestName} will bring ${dishTitle} 🎉` : `${guestName} can no longer bring ${dishTitle}`;
    }

    // Tell the host family: in-app notification + push to their devices.
    if (notifyMessage) {
      const menuName = (await menuRef.get()).data()?.name ?? "your event menu";
      const message = `${notifyMessage} — ${menuName}`;
      await db.collection("notifications").add({
        householdId: share.householdId,
        type: "event-assignment",
        message,
        link: `/collections/${share.collectionId}`,
        authorName: guestName,
        collectionId: share.collectionId,
        createdAt: now,
        readBy: [],
      });
      try {
        await sendHouseholdPush(db, {
          householdId: share.householdId,
          title: "Event menu update",
          message,
          link: `/collections/${share.collectionId}`,
          type: "event-assignment",
          prefKey: "notifyEvents",
          excludeUid: guestUid,
        });
      } catch (e) {
        console.error("shared-menu push", e); // push is best-effort
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("shared-menu respond", e);
    return NextResponse.json({ error: "respond_failed" }, { status: 500 });
  }
}
