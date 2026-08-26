// Ops script: add prepared avatars to the picker.
//
//   node scripts/upload-avatar-presets.mjs "/path/to/ready"      # dry run
//   node scripts/upload-avatar-presets.mjs "/path/to/ready" --go
//
// Labels come from MANIFEST.json in that folder (written by
// scripts/avatar_prep.py); without one, the filename is used.
//
// Mirrors POST /api/admin/avatar-presets exactly — same storage path shape,
// same download-token trick, same doc fields, same sortOrder step — because
// the picker reads whatever is in the collection and does not care who wrote
// it. Doing it here avoids minting a superadmin ID token just to POST nine
// files.
//
// ⚠ Adds only. It never deletes: a preset's Storage object is referenced by
// every member who picked it, so removing one blanks their profile picture.
// ⚠ Skips a label that already exists, so re-running after a partial failure
// is safe.
//
// Requires FIREBASE_SERVICE_ACCOUNT_B64 in .env.local.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { randomUUID } from "node:crypto";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const BUCKET = process.env.FIREBASE_STORAGE_BUCKET ?? "a-fish-in-the-kitchen.firebasestorage.app";

function envVar(name) {
  if (process.env[name]) return process.env[name];
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
  for (const line of text.split("\n")) {
    const m = line.match(new RegExp(`^${name}=(.*)$`));
    if (m) return m[1].replace(/^["']|["']$/g, "");
  }
  return null;
}

const dir = process.argv[2];
const go = process.argv.includes("--go");
if (!dir) { console.error("usage: node scripts/upload-avatar-presets.mjs <dir> [--go]"); process.exit(1); }

const manifestPath = join(dir, "MANIFEST.json");
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf-8")) : [];
const labelFor = (file) =>
  manifest.find((m) => m.file === file)?.label ??
  basename(file, ".png").replace(/^avatar-\d+-/, "").replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const files = readdirSync(dir).filter((f) => f.endsWith(".png")).sort();
if (!files.length) { console.error(`no PNGs in ${dir}`); process.exit(1); }

const sa = JSON.parse(Buffer.from(envVar("FIREBASE_SERVICE_ACCOUNT_B64"), "base64").toString("utf-8"));
if (!getApps().length) initializeApp({ credential: cert(sa), storageBucket: BUCKET });
const db = getFirestore();

const existing = await db.collection("avatarPresets").get();
const haveLabels = new Set(existing.docs.map((d) => String(d.data().label)));
let maxOrder = existing.docs.reduce((m, d) => Math.max(m, Number(d.data().sortOrder ?? 0)), 0);
console.log(`avatarPresets already holds ${existing.size}: ${[...haveLabels].join(", ") || "(none)"}\n`);

const bucket = getStorage().bucket(BUCKET);
let added = 0;
for (const file of files) {
  const label = labelFor(file);
  if (haveLabels.has(label)) { console.log(`  skip   ${label}  (already a preset)`); continue; }
  if (!go) { console.log(`  would add  ${label.padEnd(20)} <- ${file}`); continue; }

  const buffer = readFileSync(join(dir, file));
  const storagePath = `avatar-presets/${Date.now()}-${randomUUID().slice(0, 8)}.png`;
  const token = randomUUID();
  // ⚠ The download token is what makes the URL readable with no signed
  // request — the same shape every other image in the app uses.
  await bucket.file(storagePath).save(buffer, {
    contentType: "image/png",
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });
  const url =
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/` +
    `${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
  maxOrder += 10;
  await db.collection("avatarPresets").add({
    label: label.slice(0, 60), url, storagePath,
    sortOrder: maxOrder, createdAt: new Date().toISOString(),
  });
  console.log(`  added  ${label.padEnd(20)} order ${maxOrder}`);
  added++;
}
console.log(go ? `\n${added} added.` : `\nDry run — nothing written. Re-run with --go.`);
