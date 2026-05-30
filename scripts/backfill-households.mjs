// Backfill memberIds + accessState on existing household docs — the precondition
// the Firestore rules require (isMember() reads household.memberIds; isOwner and
// state checks read accessState). Without this, member-gated reads/writes are
// denied. Idempotent: rebuilds memberIds from householdMembers, sets accessState
// to "active" only if missing.
//
//   node scripts/backfill-households.mjs

import { readFileSync } from "node:fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
}

const sa = JSON.parse(Buffer.from(readEnvVar("FIREBASE_SERVICE_ACCOUNT_B64"), "base64").toString("utf-8"));
const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(sa) });
const db = getFirestore(app);

const households = await db.collection("households").get();
console.log(`Found ${households.size} household(s).`);

for (const doc of households.docs) {
  const h = doc.data();

  // Rebuild memberIds from the householdMembers join docs (+ ensure owner present).
  const memberSnap = await db.collection("householdMembers").where("householdId", "==", doc.id).get();
  const ids = new Set(memberSnap.docs.map((m) => m.data().userId).filter(Boolean));
  if (h.ownerId) ids.add(h.ownerId);
  const memberIds = [...ids];

  const update = { memberIds };
  if (!h.accessState) update.accessState = "active";

  console.log(`\n${doc.id} (${h.slug ?? "?"}):`);
  console.log(`  memberIds: ${JSON.stringify(h.memberIds)} -> ${JSON.stringify(memberIds)}`);
  console.log(`  accessState: ${h.accessState ?? "(none)"} -> ${update.accessState ?? h.accessState}`);

  await doc.ref.set(update, { merge: true });
  console.log("  ✓ updated");
}

console.log("\nDone.");
process.exit(0);
