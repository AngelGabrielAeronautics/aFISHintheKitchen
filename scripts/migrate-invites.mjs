// Copy every address-keyed `invitedUsers/{email}` doc into the (address, book)
// keyed `invites/{email}_{householdId}` collection. The legacy doc is LEFT IN
// PLACE as the mirror the 1.10 apps still read (see src/lib/invites.ts).
//
//   node scripts/migrate-invites.mjs          # dry run — prints what it would write
//   node scripts/migrate-invites.mjs --apply  # writes
//
// Requires FIREBASE_SERVICE_ACCOUNT_B64 in .env.local (same as the app).
import { readFileSync } from "node:fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const apply = process.argv.includes("--apply");
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
const b64 = env.match(/^FIREBASE_SERVICE_ACCOUNT_B64=(.*)$/m)?.[1].trim().replace(/^"|"$/g, "");
if (!b64) throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 not found in .env.local");
if (!getApps().length) initializeApp({ credential: cert(JSON.parse(Buffer.from(b64, "base64").toString("utf-8"))) });
const db = getFirestore();

const legacy = await db.collection("invitedUsers").get();
let written = 0, skipped = 0, broken = 0;
for (const d of legacy.docs) {
  const email = d.id.toLowerCase().trim();
  const data = d.data();
  if (!data.householdId) { console.log(`  ⚠ ${email}: no householdId — left alone`); broken++; continue; }
  const id = `${email}_${data.householdId}`;
  const ref = db.collection("invites").doc(id);
  if ((await ref.get()).exists) { skipped++; continue; }
  const doc = { ...data, email };
  console.log(`  ${apply ? "write" : "would write"} invites/${id}  status=${data.status ?? "pending"}`);
  if (apply) await ref.set(doc);
  written++;
}
console.log(`\n${legacy.size} legacy docs · ${written} ${apply ? "written" : "to write"} · ${skipped} already present · ${broken} skipped`);
if (!apply) console.log("dry run — re-run with --apply to write");
