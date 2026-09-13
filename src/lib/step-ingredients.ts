import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import type { Firestore } from "firebase-admin/firestore";
import { recordAiCall } from "@/lib/ai-usage";
import { reportError } from "@/lib/error-reporting";

/**
 * Which ingredient lines does each cooking step use?
 *
 * Cook Mode lists a step's ingredients under it. Nothing in the data model
 * ever linked the two, so both apps MATCH ON THE STEP'S WORDING
 * (StepIngredients.swift / .kt) — and text can't read: "blend the dry
 * ingredients and butter" showed no flour, while "using as little flour as
 * possible" (dusting the bench) showed the pastry's 180g. Hand-tagging was
 * rejected for the same reason it was rejected in 1.3: ~100 recipes nobody
 * would re-edit, and a chore on every new one.
 *
 * So the model does the tagging, once per recipe, and the result lives on the
 * recipe doc as `stepIngredients`:
 *
 *   { hash, steps: { "<instruction index>": [<ingredient index>, …] }, at, model }
 *
 * `hash` is SHA-256 of the exact ingredients + instructions it was computed
 * from. The apps use the map ONLY when the hash matches the recipe they hold
 * and fall back to text-matching otherwise — so an edit can never be served a
 * stale map, it just gets the old behaviour until the next refresh. ⚠ The
 * hash recipe below is mirrored in Swift and Kotlin; change all three or none.
 *
 * Refreshed fire-and-forget from the apps after a save (/api/step-ingredients)
 * and by the nightly sweep for anything missed (which is also the backfill).
 */
export interface StepIngredientMap {
  hash: string;
  steps: Record<string, number[]>;
  at: string;
  model: string;
  /** Bumped when the prompt changes so stored maps are recomputed; the apps ignore it. */
  v: number;
}

const MODEL = "claude-sonnet-5";
const PROMPT_VERSION = 2;
const HEADER = "## ";

export function stepIngredientsHash(ingredients: string[], instructions: string[]): string {
  return createHash("sha256")
    .update(ingredients.join("\n") + "\n\n" + instructions.join("\n"), "utf8")
    .digest("hex");
}

const SYSTEM_PROMPT = `You link the steps of a recipe to the ingredient lines each step uses, so a cook standing at the stove sees exactly what a step needs — with its quantity — without paging back to the list.

You receive the ingredient lines and the method steps, each with an index. Lines beginning "## " are section headings, not ingredients or steps.

For every step, list the indexes of the ingredient lines the step USES — adds, mixes, cooks, coats with, pours over, or otherwise handles. Read for meaning, not keywords:
- Group references to RAW ingredients resolve to their members: "the dry ingredients" is the flour, sugar, salt and ground almonds; "the eggs" includes a listed yolk; "the remaining chocolate" is the chocolate line.
- A FINISHED component made in an earlier step — "the béchamel", "the pastry", "the filling", "the marinade" — is not re-listed when a later step uses it whole. Those lines belong to the step that made it; the cook has already combined them.
- A step under a section heading ("## The Pastry") draws from that section's ingredients unless it plainly names another.
- Incidental mentions are NOT uses: flour for dusting the bench, water for a bain-marie, oil for greasing a tin — unless the list has a line for exactly that.
- Steps that only bake, rest, chill, or serve what was already assembled use nothing new. "Serve with crème fraîche" DOES use a "to serve" line.
- Every ingredient should be used by at least one step when the method mentions it in any form; never invent a use for one it doesn't.

Be precise: a wrong ingredient under a step is worse than a missing one.`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          step: { type: "integer", description: "Index of the method step" },
          ingredients: { type: "array", items: { type: "integer" }, description: "Indexes of the ingredient lines this step uses, in list order" },
        },
        required: ["step", "ingredients"],
        additionalProperties: false,
      },
    },
  },
  required: ["steps"],
  additionalProperties: false,
} as const;

/** Ask the model for the map. Throws on API failure; returns a sanitised map. */
export async function computeStepIngredients(
  ingredients: string[],
  instructions: string[],
  usage: { uid?: string; householdId?: string; route: string }
): Promise<Record<string, number[]>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const numbered = (lines: string[]) => lines.map((l, i) => `${i}: ${l}`).join("\n");
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    messages: [{
      role: "user",
      content: `INGREDIENTS\n${numbered(ingredients)}\n\nMETHOD\n${numbered(instructions)}`,
    }],
  });
  recordAiCall({ route: usage.route, model: MODEL, usage: response.usage, uid: usage.uid, householdId: usage.householdId });

  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("step-ingredients: no text in response");
  const parsed = JSON.parse(text.text) as { steps?: { step?: unknown; ingredients?: unknown }[] };

  // Sanitise: real indexes only, never a heading, deduped, in list order.
  const isHeader = (i: number, lines: string[]) => lines[i].startsWith(HEADER);
  const steps: Record<string, number[]> = {};
  for (const entry of Array.isArray(parsed.steps) ? parsed.steps : []) {
    const s = Number(entry.step);
    if (!Number.isInteger(s) || s < 0 || s >= instructions.length || isHeader(s, instructions)) continue;
    const idx = (Array.isArray(entry.ingredients) ? entry.ingredients : [])
      .map(Number)
      .filter((i) => Number.isInteger(i) && i >= 0 && i < ingredients.length && !isHeader(i, ingredients));
    const unique = [...new Set(idx)].sort((a, b) => a - b);
    if (unique.length) steps[String(s)] = unique;
  }
  return steps;
}

function isCurrent(stored: Partial<StepIngredientMap> | undefined, hash: string): boolean {
  return stored?.hash === hash && stored?.v === PROMPT_VERSION;
}

/**
 * Bring one recipe's map up to date. "current" means the stored hash already
 * matches; "skipped" means there was nothing to map (drafts with no method).
 */
export async function refreshStepIngredients(
  db: Firestore,
  recipeId: string,
  usage: { uid?: string; route: string }
): Promise<"written" | "current" | "skipped"> {
  const ref = db.collection("recipes").doc(recipeId);
  const snap = await ref.get();
  if (!snap.exists) return "skipped";
  const r = snap.data()!;
  const ingredients: string[] = Array.isArray(r.ingredients) ? r.ingredients.map(String) : [];
  const instructions: string[] = Array.isArray(r.instructions) ? r.instructions.map(String) : [];
  if (ingredients.length === 0 || instructions.length === 0) return "skipped";

  const hash = stepIngredientsHash(ingredients, instructions);
  if (isCurrent(r.stepIngredients, hash)) return "current";

  const steps = await computeStepIngredients(ingredients, instructions, {
    uid: usage.uid,
    householdId: r.householdId,
    route: usage.route,
  });
  const map: StepIngredientMap = { hash, steps, at: new Date().toISOString(), model: MODEL, v: PROMPT_VERSION };
  await ref.update({ stepIngredients: map });
  return "written";
}

/**
 * The nightly pass: any recipe whose map is missing or stale gets one, up to
 * `limit` per run so a cold backfill can't blow the cron's time budget. One
 * failure never stops the rest — it is reported and the recipe is retried
 * tomorrow.
 */
export async function sweepStepIngredients(db: Firestore, limit: number): Promise<{ checked: number; written: number; failed: number }> {
  const snap = await db.collection("recipes").select("ingredients", "instructions", "stepIngredients").get();
  let written = 0, failed = 0;
  for (const d of snap.docs) {
    if (written + failed >= limit) break;
    const r = d.data();
    const ingredients: string[] = Array.isArray(r.ingredients) ? r.ingredients.map(String) : [];
    const instructions: string[] = Array.isArray(r.instructions) ? r.instructions.map(String) : [];
    if (ingredients.length === 0 || instructions.length === 0) continue;
    if (isCurrent(r.stepIngredients, stepIngredientsHash(ingredients, instructions))) continue;
    try {
      if ((await refreshStepIngredients(db, d.id, { route: "step-ingredients/sweep" })) === "written") written++;
    } catch (err) {
      failed++;
      console.error(`step-ingredients sweep failed for ${d.id}:`, err);
      reportError(err, { route: "step-ingredients/sweep", recipeId: d.id });
    }
  }
  return { checked: snap.size, written, failed };
}
