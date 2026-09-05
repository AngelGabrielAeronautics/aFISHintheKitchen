/*
 * Backfill `createdByUid` on legacy recipe documents.
 *
 * Strategy
 * ────────
 *   For every recipe that has no `createdByUid`:
 *     1. Find the `householdMembers` document whose `householdId` matches
 *        the recipe's `householdId` AND whose `displayName` case-
 *        insensitively equals the recipe's `contributedBy`.
 *     2. If exactly ONE member matches, stamp that member's `userId`
 *        onto the recipe as `createdByUid`.
 *     3. If zero or multiple matches, leave the recipe alone and log
 *        it in the CSV as "no-match" or "ambiguous" so a human can
 *        resolve it.
 *
 * Recipes without a `householdId` (older data) are always logged as
 * "no-household" and skipped.
 *
 * Safety
 * ──────
 *   The script defaults to a dry run. It writes NOTHING unless invoked
 *   with `--commit`. Both modes emit a CSV that lists every recipe's
 *   proposed action so it can be reviewed before committing.
 *
 * Credentials
 * ───────────
 *   Uses the Firebase Admin SDK. Set FIREBASE_SERVICE_ACCOUNT_KEY (the
 *   service-account JSON, inline) or GOOGLE_APPLICATION_CREDENTIALS
 *   (path to the JSON file) before running. The Admin SDK bypasses
 *   Firestore rules.
 *
 * Usage
 * ─────
 *   npx tsx scripts/backfill-recipe-creator-uids.ts              # dry run
 *   npx tsx scripts/backfill-recipe-creator-uids.ts --commit     # apply
 *   npx tsx scripts/backfill-recipe-creator-uids.ts --out=x.csv  # log path
 */

import { writeFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

interface RecipeRow {
  id: string;
  householdId?: string;
  contributedBy?: string;
  createdByUid?: string;
}

interface MemberRow {
  userId: string;
  householdId: string;
  displayName: string;
}

type Outcome = "matched" | "skipped-has-uid" | "no-match" | "ambiguous" | "no-household";

interface DecisionRow {
  recipeId: string;
  householdId: string;
  contributedBy: string;
  outcome: Outcome;
  matchedUid: string;
  candidateUids: string;
}

function parseArgs(argv: string[]) {
  const commit = argv.includes("--commit");
  const outArg = argv.find((a) => a.startsWith("--out="));
  const outPath = outArg?.slice("--out=".length) ?? "backfill-report.csv";
  return { commit, outPath };
}

function initAdmin(): void {
  if (getApps().length > 0) return;
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (inline) {
    const parsed = JSON.parse(inline) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    initializeApp({
      credential: cert({
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key,
      }),
    });
    return;
  }
  // Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS etc.)
  initializeApp();
}

async function loadAllRecipes(): Promise<RecipeRow[]> {
  const snap = await getFirestore().collection("recipes").get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RecipeRow, "id">) }));
}

async function loadAllMembers(): Promise<MemberRow[]> {
  const snap = await getFirestore().collection("householdMembers").get();
  return snap.docs.map((d) => d.data() as MemberRow);
}

/**
 * Pure matcher — exported for unit-testing. Given a recipe and every
 * membership record in the system, return the uid(s) whose displayName
 * matches the recipe's contributedBy inside the recipe's household.
 */
export function candidateUidsFor(
  recipe: RecipeRow,
  members: MemberRow[]
): string[] {
  if (!recipe.householdId) return [];
  if (!recipe.contributedBy) return [];
  const target = recipe.contributedBy.trim().toLowerCase();
  const uids = new Set<string>();
  for (const m of members) {
    if (m.householdId !== recipe.householdId) continue;
    if (m.displayName.trim().toLowerCase() === target) {
      uids.add(m.userId);
    }
  }
  return Array.from(uids);
}

export function decideOutcome(
  recipe: RecipeRow,
  members: MemberRow[]
): { outcome: Outcome; matchedUid: string; candidateUids: string[] } {
  if (recipe.createdByUid) {
    return { outcome: "skipped-has-uid", matchedUid: recipe.createdByUid, candidateUids: [] };
  }
  if (!recipe.householdId) {
    return { outcome: "no-household", matchedUid: "", candidateUids: [] };
  }
  const uids = candidateUidsFor(recipe, members);
  if (uids.length === 0) return { outcome: "no-match", matchedUid: "", candidateUids: [] };
  if (uids.length === 1) return { outcome: "matched", matchedUid: uids[0], candidateUids: uids };
  return { outcome: "ambiguous", matchedUid: "", candidateUids: uids };
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(path: string, rows: DecisionRow[]): void {
  const header = "recipeId,householdId,contributedBy,outcome,matchedUid,candidateUids";
  const body = rows
    .map((r) =>
      [
        r.recipeId,
        r.householdId,
        r.contributedBy,
        r.outcome,
        r.matchedUid,
        r.candidateUids,
      ]
        .map(csvEscape)
        .join(",")
    )
    .join("\n");
  writeFileSync(path, `${header}\n${body}\n`, "utf8");
}

async function main() {
  const { commit, outPath } = parseArgs(process.argv.slice(2));

  console.log(commit ? "MODE: commit (will write)" : "MODE: dry run");
  console.log(`Report: ${outPath}`);

  initAdmin();

  const [recipes, members] = await Promise.all([loadAllRecipes(), loadAllMembers()]);
  console.log(`Loaded ${recipes.length} recipes and ${members.length} memberships`);

  const decisions: DecisionRow[] = [];
  const toWrite: { id: string; uid: string }[] = [];

  for (const recipe of recipes) {
    const { outcome, matchedUid, candidateUids } = decideOutcome(recipe, members);
    decisions.push({
      recipeId: recipe.id,
      householdId: recipe.householdId ?? "",
      contributedBy: recipe.contributedBy ?? "",
      outcome,
      matchedUid,
      candidateUids: candidateUids.join(" "),
    });
    if (outcome === "matched") toWrite.push({ id: recipe.id, uid: matchedUid });
  }

  writeCsv(outPath, decisions);

  const summary = decisions.reduce<Record<Outcome, number>>(
    (acc, d) => {
      acc[d.outcome] = (acc[d.outcome] ?? 0) + 1;
      return acc;
    },
    {} as Record<Outcome, number>
  );
  console.log("Summary:", summary);
  console.log(`Would write ${toWrite.length} recipes.`);

  if (!commit) {
    console.log("Dry run complete. Re-run with --commit to apply.");
    return;
  }

  // Firestore batches cap at 500 writes each.
  const db = getFirestore();
  const CHUNK = 400;
  for (let i = 0; i < toWrite.length; i += CHUNK) {
    const slice = toWrite.slice(i, i + CHUNK);
    const batch = db.batch();
    for (const { id, uid } of slice) {
      batch.update(db.collection("recipes").doc(id), { createdByUid: uid });
    }
    await batch.commit();
    console.log(`Committed ${Math.min(i + CHUNK, toWrite.length)} / ${toWrite.length}`);
  }
  console.log("Done.");
}

// Only invoke main when run directly, not when the module is imported
// for unit testing.
if (process.argv[1] && process.argv[1].endsWith("backfill-recipe-creator-uids.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
