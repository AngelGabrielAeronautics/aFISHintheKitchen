// One-off, 2026-09-05: Meg Faure ended up with two accounts.
//
//   megfaure@me.com    1XsDw5EBqTcNoFEP6FyapKnQGz33  Sign in with Apple — owns "Our Family Table", active
//   megfaure@gmail.com 3bt3qkcEhwRS5fWWTioJACthiai2  password — created 14 Aug when Donna's invite
//                                                    went to the Gmail; signed in once; member of
//                                                    Crous House and nothing else.
//
// Moves the Crous House membership (join row + profile card + memberIds) onto
// her real account, drops the shell's preferences doc, and — with --delete-auth
// — removes the Gmail auth user so signing in with it can't recreate the split.
// Also sets Dylan's extraSeats so Michael fits in the flagship (5 + 5).
//
//   node scripts/merge-meg-2026-09-05.mjs               # dry run
//   node scripts/merge-meg-2026-09-05.mjs --apply       # Firestore moves + seats
//   node scripts/merge-meg-2026-09-05.mjs --apply --delete-auth   # …and delete the Gmail account
import { readFileSync } from "node:fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const apply = process.argv.includes("--apply");
const deleteAuth = process.argv.includes("--delete-auth");
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
const b64 = env.match(/^FIREBASE_SERVICE_ACCOUNT_B64=(.*)$/m)?.[1].trim().replace(/^"|"$/g, "");
if (!b64) throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 not found in .env.local");
if (!getApps().length) initializeApp({ credential: cert(JSON.parse(Buffer.from(b64, "base64").toString("utf-8"))) });
const db = getFirestore();
const auth = getAuth();

const DYLAN = "Rm1cvyeSF0SbZYS1AlaBxd2uzdx1";
const MEG_REAL = "1XsDw5EBqTcNoFEP6FyapKnQGz33";
const MEG_SHELL = "3bt3qkcEhwRS5fWWTioJACthiai2";
const CROUS = "G9w43oL8n6rQvEe9kI1f";

// Sanity: the shell is still what we think it is.
const shell = await auth.getUser(MEG_SHELL).catch(() => null);
const real = await auth.getUser(MEG_REAL);
if (!shell) console.log("shell auth user already gone");
else if (shell.email !== "megfaure@gmail.com") throw new Error(`shell uid has email ${shell.email} — stop`);
if (real.email !== "megfaure@me.com") throw new Error(`real uid has email ${real.email} — stop`);

const rows = (await db.collection("householdMembers").where("userId", "==", MEG_SHELL).get()).docs;
const cards = (await db.collection("members").where("userId", "==", MEG_SHELL).get()).docs;
console.log(`shell holds ${rows.length} membership row(s), ${cards.length} profile card(s)`);
for (const r of rows) console.log(`  row ${r.id}: ${r.data().role} of ${r.data().householdId} as "${r.data().displayName}"`);
if (rows.some((r) => r.data().householdId !== CROUS)) throw new Error("shell is in a book other than Crous House — stop and look");

console.log(`\n${apply ? "APPLYING" : "would apply"}:`);
console.log(`  subscriptions/${DYLAN}.extraSeats = 5`);
console.log(`  ${rows.length} row(s) + ${cards.length} card(s): userId ${MEG_SHELL} → ${MEG_REAL}`);
console.log(`  households/${CROUS}.memberIds: −shell +real`);
console.log(`  delete userPreferences/${MEG_SHELL}`);
console.log(`  ${deleteAuth ? "DELETE" : "keep (pass --delete-auth to delete)"} auth user ${MEG_SHELL} (megfaure@gmail.com)`);

if (apply) {
  await db.collection("subscriptions").doc(DYLAN).set({ extraSeats: 5 }, { merge: true });
  const batch = db.batch();
  for (const r of rows) batch.update(r.ref, { userId: MEG_REAL });
  for (const c of cards) batch.update(c.ref, { userId: MEG_REAL });
  batch.update(db.collection("households").doc(CROUS), { memberIds: FieldValue.arrayRemove(MEG_SHELL) });
  batch.delete(db.collection("userPreferences").doc(MEG_SHELL));
  await batch.commit();
  await db.collection("households").doc(CROUS).update({ memberIds: FieldValue.arrayUnion(MEG_REAL) });
  if (deleteAuth && shell) await auth.deleteUser(MEG_SHELL);

  const memberships = (await db.collection("householdMembers").where("userId", "==", MEG_REAL).get()).docs
    .map((d) => `${d.data().role} of ${d.data().householdId}`);
  const crous = (await db.collection("households").doc(CROUS).get()).data();
  console.log("\nverify:");
  console.log("  Dylan extraSeats:", (await db.collection("subscriptions").doc(DYLAN).get()).data().extraSeats);
  console.log("  Meg (me.com) memberships:", JSON.stringify(memberships));
  console.log("  Crous memberIds has real:", crous.memberIds.includes(MEG_REAL), "| still has shell:", crous.memberIds.includes(MEG_SHELL));
  console.log("  shell leftovers in Firestore:", (await db.collection("householdMembers").where("userId", "==", MEG_SHELL).get()).size + (await db.collection("members").where("userId", "==", MEG_SHELL).get()).size);
  console.log("  shell auth user:", await auth.getUser(MEG_SHELL).then(() => "still exists").catch((e) => e.code));
} else {
  console.log("\ndry run — nothing written");
}
