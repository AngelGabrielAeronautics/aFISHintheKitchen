// Two data fixes the rebuilt AI check surfaced on 2026-09-12 (see the
// check-recipe commit): stray test steps in the flagship Chakalaka, and the
// Espresso Tart's merged pastry line, cook time and placeholder description.
//
//   node scripts/fix-recipes-2026-09-12.mjs          # dry run — prints what it would change
//   node scripts/fix-recipes-2026-09-12.mjs --apply  # writes
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
const now = new Date().toISOString();
const hist = (r, summary) => [...(r.editHistory || []), { editor: "Dylan", date: now, summary }];
const verb = apply ? "write" : "would write";

// 1. Chakalaka — drop the two "uitest step one" steps.
{
  const ref = db.collection("recipes").doc("kb-10");
  const r = (await ref.get()).data();
  const junk = r.instructions.filter((s) => s.trim() === "uitest step one");
  const kept = r.instructions.filter((s) => s.trim() !== "uitest step one");
  console.log(`Chakalaka  (hh ${r.householdId}, by ${r.contributedBy}) — ${r.instructions.length} steps, ${junk.length} to remove`);
  if (junk.length) {
    console.log(`  ${verb}: instructions → ${kept.length} steps`);
    if (apply) await ref.update({ instructions: kept, editHistory: hist(r, "Removed two stray test steps") });
  }
}

// 2. Espresso Tart — merged "150g unsalted butter / 1 egg" line, cook 55, rest 180 (2h + 1h in the fridge), blank the "Description" placeholder.
{
  const ref = db.collection("recipes").doc("9RYzW6lQvz9krg58zmZy");
  const r = (await ref.get()).data();
  const ing = r.ingredients.map((s) => (s.startsWith("150g unsalted butter") ? "150g unsalted butter" : s === "1 Egg" ? "1 egg" : s));
  console.log(`Espresso Tart  (hh ${r.householdId}, by ${r.contributedBy}) — cook ${r.cookTime}, description ${JSON.stringify(r.description)}`);
  r.ingredients.forEach((s, i) => { if (s !== ing[i]) console.log(`  ${verb}: ${JSON.stringify(s)} → ${JSON.stringify(ing[i])}`); });
  console.log(`  ${verb}: cookTime 55, restTime 180, description ""`);
  if (apply) await ref.update({ ingredients: ing, cookTime: 55, restTime: 180, description: "", editHistory: hist(r, "Fixed pastry ingredients, timings and description") });
}
console.log(apply ? "\ndone" : "\ndry run — re-run with --apply to write");
