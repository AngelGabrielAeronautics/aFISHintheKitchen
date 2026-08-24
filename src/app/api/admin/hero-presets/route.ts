import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifySuperAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Hero photos are big; give the upload room to land.
export const maxDuration = 60;

// The hero photos a new owner picks from — now DATA, not an enum compiled
// into the apps (Dylan, 2026-08-24). Add one here and it appears in every
// app on the next launch, with no release.
//
// ⚠ "Classic" is deliberately NOT in this collection. It's the app-bundled
// image and the fallback when the network or this collection is unavailable,
// so the picker can never come up empty. The apps prepend it themselves.

const BUCKET =
  process.env.FIREBASE_STORAGE_BUCKET ?? "a-fish-in-the-kitchen.firebasestorage.app";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

interface PresetDoc {
  label: string;
  url: string;
  storagePath?: string;
  sortOrder: number;
  createdAt: string;
}

export async function GET(req: NextRequest) {
  const auth = await verifySuperAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = getAdminDb();
  const [snap, households] = await Promise.all([
    db.collection("heroPresets").get(),
    db.collection("households").get(),
  ]);

  const books = households.docs.map((d) => ({
    name: (d.data().name as string) ?? d.id,
    heroUrl: ((d.data().customisation?.heroUrl as string | undefined) ?? "").trim(),
  }));

  const usedBy = (url: string) => books.filter((b) => b.heroUrl === url).map((b) => b.name);

  const presets = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as PresetDoc) }))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.label.localeCompare(b.label))
    .map((p) => ({ ...p, usedByNames: usedBy(p.url) }));

  // Classic is the bundled default: every book with no heroUrl set is on it.
  const classicNames = books.filter((b) => b.heroUrl === "").map((b) => b.name);
  const presetUrls = new Set(presets.map((p) => p.url));
  const custom = books
    .filter((b) => b.heroUrl !== "" && !presetUrls.has(b.heroUrl))
    .map((b) => ({ name: b.name, url: b.heroUrl }));

  return NextResponse.json({
    classic: { label: "Classic", displayUrl: "/hero.jpg", usedByNames: classicNames },
    presets,
    custom,
    totalHouseholds: books.length,
  });
}

/** Create a preset from an uploaded image (multipart: file + label). */
export async function POST(req: NextRequest) {
  const auth = await verifySuperAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const form = await req.formData();
  const file = form.get("file");
  const label = String(form.get("label") ?? "").trim();
  if (!label) return NextResponse.json({ error: "missing_label" }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "missing_file" }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "unsupported_type" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 400 });

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const storagePath = `hero-presets/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  const token = randomUUID();

  const bucket = getStorage().bucket(BUCKET);
  const buffer = Buffer.from(await file.arrayBuffer());
  // ⚠ The download token is what makes the URL readable without a signed
  // request — the same shape every other image in the app uses, so the apps
  // need no auth header to load a hero.
  await bucket.file(storagePath).save(buffer, {
    contentType: file.type,
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });

  const url =
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/` +
    `${encodeURIComponent(storagePath)}?alt=media&token=${token}`;

  const db = getAdminDb();
  const existing = await db.collection("heroPresets").get();
  const maxOrder = existing.docs.reduce((m, d) => Math.max(m, Number(d.data().sortOrder ?? 0)), 0);

  const ref = await db.collection("heroPresets").add({
    label: label.slice(0, 60),
    url,
    storagePath,
    sortOrder: maxOrder + 10,
    createdAt: new Date().toISOString(),
  } satisfies PresetDoc);

  return NextResponse.json({ ok: true, id: ref.id, url });
}

/** Rename or reorder. */
export async function PATCH(req: NextRequest) {
  const auth = await verifySuperAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await req.json()) as { id?: string; label?: string; sortOrder?: number };
  if (!body.id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const fields: Record<string, unknown> = {};
  if (typeof body.label === "string" && body.label.trim()) fields.label = body.label.trim().slice(0, 60);
  if (Number.isFinite(body.sortOrder)) fields.sortOrder = Number(body.sortOrder);
  if (Object.keys(fields).length === 0) return NextResponse.json({ error: "nothing_to_do" }, { status: 400 });

  await getAdminDb().collection("heroPresets").doc(body.id).update(fields);
  return NextResponse.json({ ok: true });
}

/**
 * Remove a preset from the picker.
 *
 * ⚠ The Storage FILE stays. Any cookbook already using this photo stores the
 * URL on its own household doc and renders it directly — deleting the object
 * would blank the hero of every family that chose it. Removing it here only
 * takes it out of the list new owners choose from. (The 2026-08-13 lesson:
 * shared storage objects are not yours to delete.)
 */
export async function DELETE(req: NextRequest) {
  const auth = await verifySuperAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const db = getAdminDb();
  const doc = await db.collection("heroPresets").doc(id).get();
  const url = doc.data()?.url as string | undefined;

  const inUse = url
    ? (await db.collection("households").get()).docs.filter(
        (d) => (d.data().customisation?.heroUrl ?? "") === url
      ).length
    : 0;

  await db.collection("heroPresets").doc(id).delete();
  return NextResponse.json({ ok: true, stillUsedBy: inUse });
}
