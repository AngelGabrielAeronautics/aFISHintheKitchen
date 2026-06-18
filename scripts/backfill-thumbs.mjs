// Backfill `thumbUrl` on existing recipes: download each recipe's cover image,
// generate a ~500px JPEG thumbnail, upload it next to the original, and store
// its download URL on the recipe. Cards/lists then load the small thumbnail
// instead of the multi-megabyte original. Idempotent: skips recipes that
// already have a thumbUrl.
//
//   node scripts/backfill-thumbs.mjs
//
// Requires FIREBASE_SERVICE_ACCOUNT_B64 in .env.local (same as the app).

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import sharp from "sharp";

function readEnvVar(name) {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1 || t.slice(0, eq).trim() !== name) continue;
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    return v;
  }
  throw new Error(`${name} not found in .env.local`);
}

// Parse a Firebase download URL → { bucket, path }.
function parseDownloadUrl(url) {
  const m = url.match(/\/v0\/b\/([^/]+)\/o\/([^?]+)/);
  if (!m) return null;
  return { bucket: m[1], path: decodeURIComponent(m[2]) };
}

const sa = JSON.parse(Buffer.from(readEnvVar("FIREBASE_SERVICE_ACCOUNT_B64"), "base64").toString("utf-8"));
const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(sa) });
const db = getFirestore(app);

const snap = await db.collection("recipes").get();
console.log(`Found ${snap.size} recipe(s).`);

let done = 0, skipped = 0, failed = 0;

for (const doc of snap.docs) {
  const r = doc.data();
  if (r.thumbUrl) { skipped++; continue; }
  if (!r.image) { skipped++; continue; }

  const parsed = parseDownloadUrl(r.image);
  if (!parsed) { console.log(`  ${doc.id}: unparseable image URL, skipping`); failed++; continue; }

  try {
    const bucket = getStorage(app).bucket(parsed.bucket);
    const [orig] = await bucket.file(parsed.path).download();
    const thumb = await sharp(orig).rotate().resize({ width: 500, height: 500, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 70 }).toBuffer();

    const dir = parsed.path.includes("/") ? parsed.path.slice(0, parsed.path.lastIndexOf("/")) : "";
    const name = parsed.path.slice(parsed.path.lastIndexOf("/") + 1);
    const thumbPath = `${dir}/thumb-${name}`.replace(/^\//, "");
    const token = randomUUID();
    await bucket.file(thumbPath).save(thumb, {
      metadata: { contentType: "image/jpeg", metadata: { firebaseStorageDownloadTokens: token } },
    });
    const thumbUrl = `https://firebasestorage.googleapis.com/v0/b/${parsed.bucket}/o/${encodeURIComponent(thumbPath)}?alt=media&token=${token}`;

    await doc.ref.update({ thumbUrl });
    done++;
    console.log(`  ✓ ${r.title ?? doc.id}  (${(orig.length / 1024).toFixed(0)}KB → ${(thumb.length / 1024).toFixed(0)}KB)`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${r.title ?? doc.id}: ${err.message}`);
  }
}

console.log(`\nDone. thumbed ${done}, skipped ${skipped}, failed ${failed}.`);
process.exit(0);
