// Remove household memberships whose Firebase Auth user no longer exists, and
// drop them from the household's denormalised memberIds. Orphans appear when an
// auth user is deleted directly (e.g. Firebase Console) instead of via the app's
// Remove button — they keep consuming seats. Idempotent and safe to re-run.
//
//   node scripts/reconcile-members.mjs

import { readFileSync } from "node:fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function env(name) {
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
}

const sa = JSON.parse(Buffer.from(env("FIREBASE_SERVICE_ACCOUNT_B64"), "base64").toString("utf-8"));
const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(sa) });
const auth = getAuth(app);
const db = getFirestore(app);

async function userExists(uid) {
  try {
    await auth.getUser(uid);
    return true;
  } catch (e) {
    if (e?.code === "auth/user-not-found") return false;
    throw e;
  }
}

const members = await db.collection("householdMembers").get();
console.log(`Scanning ${members.size} membership(s)...`);
let removed = 0;

for (const doc of members.docs) {
  const m = doc.data();
  if (await userExists(m.userId)) continue;
  console.log(`  orphan: ${m.displayName} (${m.userId}) in household ${m.householdId} — removing`);
  await db.doc(`households/${m.householdId}`).set(
    { memberIds: FieldValue.arrayRemove(m.userId) },
    { merge: true }
  );
  await doc.ref.delete();
  removed++;
}

console.log(`\nDone. Removed ${removed} orphan membership(s).`);
process.exit(0);
