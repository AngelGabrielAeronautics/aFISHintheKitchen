import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifySuperAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The character avatars a family member picks from instead of uploading a
// photo — the same server-side pattern as the hero photos (Dylan, 2026-08-24).
// Add one here and it appears in every app on the next launch, no release.
//
// WHY THIS EXISTS: 43 member profiles across 12 cookbooks and exactly ONE had
// a photo. Finding and cropping a picture of Granny is work; picking a
// character is two taps. Initials are the fallback, not the offer.
//
// ⚠ A member stores the chosen avatar in the SAME field as an uploaded photo
// (`members/{id}.photoUrl`). That is deliberate — every avatar surface in both
// apps already renders that field, so this needed no rendering changes at all.

const BUCKET =
  process.env.FIREBASE_STORAGE_BUCKET ?? "a-fish-in-the-kitchen.firebasestorage.app";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

interface PresetDoc {
  label: string;
  url: string;
  storagePath?: string;
  sortOrder: number;
  createdAt: string;
}

/** Members using each avatar — the honest measure of whether this landed. */
async function usageByUrl() {
  const db = getAdminDb();
  const [members, households] = await Promise.all([
    db.collection("members").get(),
    db.collection("households").get(),
  ]);
  const bookName = new Map(households.docs.map((d) => [d.id, (d.data().name as string) ?? d.id]));
  const used = new Map<string, string[]>();
  let withAny = 0;
  for (const d of members.docs) {
    const m = d.data();
    const url = ((m.photoUrl as string | undefined) ?? "").trim();
    if (!url) continue;
    withAny++;
    const who = `${m.name ?? "?"} (${bookName.get(m.householdId as string) ?? "?"})`;
    used.set(url, [...(used.get(url) ?? []), who]);
  }
  return { used, totalMembers: members.size, withAny };
}

export async function GET(req: NextRequest) {
  const auth = await verifySuperAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = getAdminDb();
  const [snap, usage] = await Promise.all([db.collection("avatarPresets").get(), usageByUrl()]);

  const presets = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as PresetDoc) }))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.label.localeCompare(b.label))
    .map((p) => ({ ...p, usedByNames: usage.used.get(p.url) ?? [] }));

  // Anything in photoUrl that isn't one of ours is a real uploaded photo.
  const presetUrls = new Set(presets.map((p) => p.url));
  const uploads = [...usage.used.entries()]
    .filter(([url]) => !presetUrls.has(url))
    .flatMap(([, who]) => who);

  return NextResponse.json({
    presets,
    totalMembers: usage.totalMembers,
    withAnyPicture: usage.withAny,
    uploadedPhotoNames: uploads,
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

  const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : "png";
  const storagePath = `avatar-presets/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  const token = randomUUID();

  const bucket = getStorage().bucket(BUCKET);
  const buffer = Buffer.from(await file.arrayBuffer());
  // ⚠ The download token is what makes the URL readable with no signed
  // request — the same shape every other image in the app uses.
  await bucket.file(storagePath).save(buffer, {
    contentType: file.type,
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });

  const url =
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/` +
    `${encodeURIComponent(storagePath)}?alt=media&token=${token}`;

  const db = getAdminDb();
  const existing = await db.collection("avatarPresets").get();
  const maxOrder = existing.docs.reduce((m, d) => Math.max(m, Number(d.data().sortOrder ?? 0)), 0);

  const ref = await db.collection("avatarPresets").add({
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

  await getAdminDb().collection("avatarPresets").doc(body.id).update(fields);
  return NextResponse.json({ ok: true });
}

/**
 * Remove an avatar from the picker.
 *
 * ⚠ The Storage FILE stays, and this is far more load-bearing here than it is
 * for heroes: one avatar object is referenced by MANY member documents across
 * DIFFERENT households. Deleting the object would blank every one of them at
 * once. Removing it here only takes it out of the list people choose from.
 * (The 2026-08-13 lesson: shared storage objects are not yours to delete.)
 */
export async function DELETE(req: NextRequest) {
  const auth = await verifySuperAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const db = getAdminDb();
  const doc = await db.collection("avatarPresets").doc(id).get();
  const url = doc.data()?.url as string | undefined;
  const inUse = url ? ((await usageByUrl()).used.get(url) ?? []).length : 0;

  await db.collection("avatarPresets").doc(id).delete();
  return NextResponse.json({ ok: true, stillUsedBy: inUse });
}
