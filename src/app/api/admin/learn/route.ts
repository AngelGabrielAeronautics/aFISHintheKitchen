import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminMessaging } from "@/lib/firebase-admin";
import { verifySuperAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

// Authoring for the global Learn library (docs/LEARN.md). The apps read
// learnItems directly from Firestore (published only); this route is the ONLY
// write path, so content never waits on an app release.

// "weekly" = the Learn-this-recipe-this-week pool: the apps rotate through
// published weekly items in sortOrder, one per week (weeks counted from the
// fixed epoch Monday 2026-08-24), cycling when they run out. 52 in the pool
// means a year without repeats; any smaller pool still works, it just cycles
// sooner.
const TYPES = new Set(["tip", "video", "series", "weekly"]);

interface LearnItemInput {
  type?: string;
  title?: string;
  body?: string;
  youtubeId?: string | null;
  seriesId?: string | null;
  seriesOrder?: number | null;
  sortOrder?: number;
}

// Accepts a bare 11-char id or any of the usual YouTube URL shapes, and
// always stores the bare id — the apps build their own embed page around it.
function extractYoutubeId(raw: string): string | null {
  const s = raw.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m =
    s.match(/[?&]v=([A-Za-z0-9_-]{11})/) ??
    s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) ??
    s.match(/\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function sanitize(input: LearnItemInput): { ok: true; fields: Record<string, unknown> } | { ok: false; error: string } {
  const type = input.type ?? "";
  if (!TYPES.has(type)) return { ok: false, error: "invalid_type" };
  const title = String(input.title ?? "").trim();
  if (!title) return { ok: false, error: "missing_title" };

  let youtubeId: string | null = null;
  if (type === "video" || type === "weekly") {
    youtubeId = extractYoutubeId(String(input.youtubeId ?? ""));
    if (!youtubeId) return { ok: false, error: "invalid_youtube" };
  }

  return {
    ok: true,
    fields: {
      type,
      title: title.slice(0, 200),
      body: String(input.body ?? "").trim().slice(0, 5000),
      youtubeId,
      seriesId: type === "video" ? (input.seriesId ? String(input.seriesId) : null) : null,
      seriesOrder: type === "video" && Number.isFinite(input.seriesOrder) ? Number(input.seriesOrder) : null,
      sortOrder: Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 0,
    },
  };
}

export async function GET(req: NextRequest) {
  const auth = await verifySuperAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const snap = await getAdminDb().collection("learnItems").get();
  const items = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
      Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) || String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")));
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const auth = await verifySuperAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await req.json()) as { action?: string; id?: string; item?: LearnItemInput };
  const db = getAdminDb();
  const now = new Date().toISOString();

  switch (body.action) {
    case "create": {
      const parsed = sanitize(body.item ?? {});
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      const ref = await db.collection("learnItems").add({
        ...parsed.fields,
        status: "draft",
        notifiedAt: null,
        publishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      return NextResponse.json({ ok: true, id: ref.id });
    }

    case "update": {
      if (!body.id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
      const parsed = sanitize(body.item ?? {});
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      await db.collection("learnItems").doc(body.id).update({ ...parsed.fields, updatedAt: now });
      return NextResponse.json({ ok: true });
    }

    case "publish":
    case "unpublish": {
      if (!body.id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
      const publish = body.action === "publish";
      await db.collection("learnItems").doc(body.id).update({
        status: publish ? "published" : "draft",
        publishedAt: publish ? now : null,
        updatedAt: now,
      });
      return NextResponse.json({ ok: true });
    }

    case "delete": {
      if (!body.id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
      // A series takes its videos' membership with it, not the videos.
      const orphans = await db.collection("learnItems").where("seriesId", "==", body.id).get();
      for (const doc of orphans.docs) {
        await doc.ref.update({ seriesId: null, seriesOrder: null, updatedAt: now });
      }
      await db.collection("learnItems").doc(body.id).delete();
      return NextResponse.json({ ok: true });
    }

    // Broadcast push for one published item. Manually triggered, never a cron
    // (Vercel Hobby: two cron slots, both taken). One a week is the cadence.
    case "notify": {
      if (!body.id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
      const snap = await db.collection("learnItems").doc(body.id).get();
      const item = snap.data();
      if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });
      if (item.status !== "published") return NextResponse.json({ error: "not_published" }, { status: 400 });

      const tokensSnap = await db.collection("deviceTokens").get();
      const tokens = [...new Set(tokensSnap.docs.map((d) => d.data().token as string))].filter(Boolean);
      if (tokens.length === 0) return NextResponse.json({ ok: true, sent: 0 });

      const message = String(item.title).slice(0, 240);
      const res = await getAdminMessaging().sendEachForMulticast({
        tokens,
        notification: { title: "Learn something new", body: message },
        data: { link: "/learn", type: "learn" },
        apns: { payload: { aps: { sound: "default" } } },
      });

      const stale: string[] = [];
      res.responses.forEach((r, i) => {
        const code = r.error?.code;
        if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
          stale.push(tokens[i]);
        }
      });
      await Promise.all(stale.map((t) => db.collection("deviceTokens").doc(t).delete().catch(() => {})));

      await snap.ref.update({ notifiedAt: now, updatedAt: now });
      return NextResponse.json({ ok: true, sent: res.successCount, failed: res.failureCount });
    }

    default:
      return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }
}
