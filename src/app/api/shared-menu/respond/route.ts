import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, getAdminMessaging } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

// Guest interactions on a shared event menu: claim a dish, unclaim yourself,
// or comment. The token is the capability; the caller just needs a signed-in
// app account (any household, or none). All writes happen HERE via the Admin
// SDK — guests never get Firestore access to the host family's data.
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
      await menuRef.update({
        comments: FieldValue.arrayUnion({ id: randomUUID(), author: `${guestName} (guest)`, text, createdAt: now }),
      });
      notifyMessage = `${guestName} commented on ${share.bookName}'s menu`;
    } else {
      if (!body.recipeId) return NextResponse.json({ error: "missing_recipe" }, { status: 400 });
      const rid = body.recipeId;
      let dishTitle = "a dish";
      const conflict = await db.runTransaction(async (tx) => {
        const snap = await tx.get(menuRef);
        if (!snap.exists) return "not_found";
        const menu = snap.data()!;
        if (!(menu.recipeIds ?? []).includes(rid)) return "not_found";
        const dish = await tx.get(db.collection("recipes").doc(rid));
        dishTitle = (dish.data()?.title as string | undefined) ?? "a dish";
        const assignments = { ...(menu.assignments ?? {}) } as Record<string, string[]>;
        const status = { ...(menu.assignmentStatus ?? {}) } as Record<string, Record<string, string>>;
        let names = [...(assignments[rid] ?? [])];
        const rs = { ...(status[rid] ?? {}) };
        if (body.action === "claim") {
          if (names.includes(guestName)) return null; // idempotent
          if (names.length >= 3) return "slots_full";
          names.push(guestName);
          rs[guestName] = "accepted"; // claiming IS accepting
        } else {
          names = names.filter((n) => n !== guestName);
          delete rs[guestName];
        }
        assignments[rid] = names;
        status[rid] = rs;
        tx.update(menuRef, {
          assignments,
          assignmentStatus: status,
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
        const devices = await db.collection("deviceTokens").where("householdId", "==", share.householdId).get();
        const tokens = [
          ...new Set(devices.docs.map((d) => d.data().token as string).filter(Boolean)),
        ];
        if (tokens.length > 0) {
          await getAdminMessaging().sendEachForMulticast({
            tokens,
            notification: { title: "Event menu update", body: message.slice(0, 240) },
            data: { link: `/collections/${share.collectionId}`, type: "event-assignment" },
            apns: { payload: { aps: { sound: "default" } } },
          });
        }
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
