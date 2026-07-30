import { getAdminDb } from "@/lib/firebase-admin";

// Shared plumbing for the AI recipe routes. Both /api/import-recipe (read a
// recipe the cook already has) and /api/suggest-recipe (invent one) return the
// SAME shape into the SAME editor merge on both clients, so the schema, the
// sanitiser and the throttle live here rather than being restated per route.

export const CATEGORIES = [
  "starters-snacks", "breakfast-brunch", "soups", "stews", "curry", "mains",
  "seafood", "sides-salads", "baking-breads", "cakes", "desserts",
  "jams-preserves", "sauces-condiments", "drinks", "braai", "bbq",
  "holiday-specials",
] as const;

export const PROTEINS = [
  "beef", "poultry", "lamb", "pork", "seafood", "vegetarian", "vegan", "eggs", "mixed",
] as const;

export const SEASONS = ["summer", "autumn", "winter", "spring", "all-year"] as const;

/** The JSON contract, identical for extraction and generation. */
export const RECIPE_JSON_SPEC = `Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "title": "Recipe Title",
  "description": "A short 1-2 sentence description of the dish",
  "ingredients": ["ingredient 1", "ingredient 2"],
  "instructions": ["Step 1 text", "Step 2 text"],
  "prepTime": 15,
  "cookTime": 30,
  "servings": 4,
  "category": "mains",
  "protein": "poultry",
  "difficulty": "Medium",
  "noCook": false,
  "tags": ["tag1", "tag2"],
  "seasons": []
}

Rules:
- prepTime and cookTime are in minutes (integers).
- If the dish requires NO cooking or heat at all (salads, no-bake desserts, dips), set cookTime to 0 and noCook to true. Otherwise noCook is false.
- servings is an integer. Default to 4 if not stated.
- category must be one of: ${CATEGORIES.join(", ")}
- protein must be one of: ${PROTEINS.join(", ")} (or empty string if unclear)
- difficulty must be one of: Easy, Medium, Hard
- tags should be relevant keywords (cuisine type, cooking method, etc.)
- seasons should be from: ${SEASONS.join(", ")} (or empty array if not seasonal)
- If the recipe has sections (e.g. "For the crust" / "For the filling"), prefix section headers with "## " in both ingredients and instructions arrays
- Keep ingredient formatting natural (e.g. "2 cups flour" not "flour: 2 cups")
- Keep instruction steps clear and concise`;

/**
 * Food-safety floor for GENERATED recipes.
 *
 * Extraction doesn't need this — the cook is importing something they already
 * trusted. Generation does: this app has Jams & Preserves and poultry
 * categories, and a model inventing a water-bath time for low-acid preserves or
 * a temperature for chicken is a real-world harm on a paid product, not a bad
 * user experience.
 */
export const SAFETY_RULES = `Food safety is not optional:
- Give safe, conventional cooking temperatures and times. Poultry cooked through (74C/165F internal), pork and mince cooked through, no raw flour in no-bake items.
- Do NOT invent home-preserving, canning, bottling, curing, fermenting or smoking methods. If the request needs one, give the recipe but state in the description that the preserving method should be followed from a tested, published source.
- Do not suggest anything involving foraged mushrooms or plants, raw milk, or home-distilled alcohol.
- If the requested combination would be genuinely unsafe or inedible, return {"error": "..."} explaining why in one sentence instead of a recipe.`;

type Clean = Record<string, unknown>;

/**
 * Coerce and clamp whatever the model returned. The clients decode strictly
 * typed fields, so one malformed value would otherwise sink the whole response.
 */
export function sanitiseRecipe(raw: unknown): Clean {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const strArr = (v: unknown) =>
    Array.isArray(v)
      ? v.filter((x) => typeof x === "string").map((x) => String(x).slice(0, 500))
      : undefined;
  const int = (v: unknown) => {
    const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
    return Number.isFinite(n) ? Math.max(0, Math.min(6000, Math.round(n))) : undefined;
  };
  const oneOf = (v: unknown, allowed: readonly string[]) =>
    typeof v === "string" && allowed.includes(v) ? v : undefined;

  return {
    title: str(r.title)?.slice(0, 200),
    description: str(r.description)?.slice(0, 1000),
    ingredients: strArr(r.ingredients)?.slice(0, 100),
    instructions: strArr(r.instructions)?.slice(0, 100),
    prepTime: int(r.prepTime),
    cookTime: int(r.cookTime),
    servings: int(r.servings),
    category: oneOf(r.category, CATEGORIES),
    protein: oneOf(r.protein, PROTEINS),
    difficulty: oneOf(r.difficulty, ["Easy", "Medium", "Hard"]),
    noCook: r.noCook === true ? true : undefined,
    tags: strArr(r.tags)?.slice(0, 15),
    seasons: strArr(r.seasons)?.filter((x) => (SEASONS as readonly string[]).includes(x)),
    // Generation only: a line to the cook, e.g. "you already have Poppie's
    // chakalaka, which uses those peppers". Extraction never sets it.
    note: str(r.note)?.slice(0, 300),
  };
}

/** Strip the markdown fence models add even when told not to. */
export function parseModelJson(text: string): unknown | null {
  const s = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/**
 * Fixed-window per-uid counter in Firestore. Serverless has no memory, so this
 * mirrors the authEmailThrottle pattern. Fails OPEN on a Firestore error —
 * availability of the feature beats a perfect limiter.
 */
export async function checkThrottle(
  collection: string,
  uid: string,
  hourLimit: number,
  monthLimit: number
): Promise<"ok" | "hour" | "month"> {
  const HOUR_MS = 60 * 60 * 1000;
  const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
  try {
    const ref = getAdminDb().collection(collection).doc(uid);
    const now = Date.now();
    const data = (await ref.get()).data() as
      | { windowStart?: number; count?: number; monthStart?: number; monthCount?: number }
      | undefined;

    const monthFresh = !data?.monthStart || now - data.monthStart > MONTH_MS;
    const monthStart = monthFresh ? now : data!.monthStart!;
    const monthCount = monthFresh ? 0 : data?.monthCount ?? 0;
    if (monthCount >= monthLimit) return "month";

    const hourFresh = !data?.windowStart || now - data.windowStart > HOUR_MS;
    const windowStart = hourFresh ? now : data!.windowStart!;
    const count = hourFresh ? 0 : data?.count ?? 0;
    if (count >= hourLimit) return "hour";

    await ref.set({ windowStart, count: count + 1, monthStart, monthCount: monthCount + 1 });
    return "ok";
  } catch (err) {
    console.error(`${collection} throttle check failed (continuing):`, err);
    return "ok";
  }
}
