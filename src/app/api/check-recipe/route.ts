import Anthropic from "@anthropic-ai/sdk";
import { recordAiCall } from "@/lib/ai-usage";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { reportError } from "@/lib/error-reporting";

export const runtime = "nodejs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Text-only consistency check — ~10x cheaper than the vision import, so the
// caps are looser but still bounded.
const HOUR_LIMIT = 30;
const MONTH_LIMIT = 150;
const HOUR_MS = 60 * 60 * 1000;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

async function checkRate(uid: string): Promise<"ok" | "limited"> {
  try {
    const ref = getAdminDb().collection("checkThrottle").doc(uid);
    const now = Date.now();
    const data = (await ref.get()).data() as
      | { windowStart?: number; count?: number; monthStart?: number; monthCount?: number }
      | undefined;
    const monthFresh = !data?.monthStart || now - data.monthStart > MONTH_MS;
    const monthStart = monthFresh ? now : data!.monthStart!;
    const monthCount = monthFresh ? 0 : data?.monthCount ?? 0;
    const hourFresh = !data?.windowStart || now - data.windowStart > HOUR_MS;
    const windowStart = hourFresh ? now : data!.windowStart!;
    const count = hourFresh ? 0 : data?.count ?? 0;
    if (monthCount >= MONTH_LIMIT || count >= HOUR_LIMIT) return "limited";
    await ref.set({ windowStart, count: count + 1, monthStart, monthCount: monthCount + 1 });
    return "ok";
  } catch (err) {
    console.error("check-recipe throttle failed (continuing):", err);
    return "ok";
  }
}

const FIXABLE_FIELDS = ["category", "protein", "difficulty", "noCook", "prepTime", "cookTime", "servings", "seasons", "heat"] as const;
const FLAG_FIELDS = ["title", "description", "ingredients", "instructions", "tags"] as const;
const ALLOWED = {
  category: ["starters-snacks","breakfast-brunch","soups","stews","curry","mains","seafood","sides-salads","baking-breads","cakes","desserts","jams-preserves","sauces-condiments","drinks","braai","bbq","holiday-specials"],
  protein: ["beef","poultry","lamb","pork","seafood","vegetarian","vegan","eggs","mixed"],
  difficulty: ["Easy","Medium","Hard"],
  seasons: ["summer","autumn","winter","spring","all-year"],
};

const SYSTEM_PROMPT = `You are a recipe data auditor for a family cookbook app. You receive a recipe's structured data and report REAL inconsistencies only — you are a careful proofreader, not a food critic.

Look for problems like:
- The protein label contradicting the title or ingredients (e.g. protein "vegan" but the ingredients include pork chops)
- The category contradicting the dish (e.g. a cake filed under "soups")
- noCook=true but the method involves cooking/heat (or the reverse: cookTime 0 on a dish that's clearly cooked)
- Wildly implausible times or servings for the dish described
- A heat level that contradicts the ingredients (e.g. heat 5 with no chilli/spice anywhere)
- Ingredients referenced in the method that are missing from the ingredients list (mention the ingredient)
- Ingredients on the list that the method never uses (mention the ingredient) — the two must hand-shake in both directions. Match by sense, not exact words: "the dry ingredients" covers flour, sugar, salt and ground almonds; "season" covers salt and pepper; "the eggs" covers whole eggs and a yolk; "to serve" / "for garnish" / "plus extra for decorating" items count as used; "## " section headers are not ingredients. Flag only what is genuinely unaccounted for.
- Two ingredients run together on one line (e.g. "150g butter 1 egg"), or the same ingredient listed twice so the quantity is ambiguous
- Placeholder text left in a field — a description that just says "Description", a title of "Untitled", an ingredient of "ingredient 1", "TBC", "lorem ipsum" and the like
- Seasons that contradict the dish only when blatant

TIMES — the app shows prepTime + cookTime as the recipe's Total, and families plan dinner on it, so check the method against it:
- prepTime is hands-on time; cookTime is time on heat (oven, hob, grill, air fryer). Add up the durations the method states (e.g. "bake blind for 10 minutes ... bake for 40 minutes" = 50 on heat). Flag cookTime or prepTime only when it is clearly out — off by more than a third, or by more than 20 minutes — and give the corrected integer as the fix.
- UNATTENDED time is the big one. If the method requires chilling, resting, marinating, proving, rising, soaking, freezing, setting, cooling before serving, or leaving something "overnight", and those waits add up to 30 minutes or more, the Total shown to the cook is wrong and there is no time field for it. Report this ONCE, on the "description" field with fix null, in the form: "The method needs about <total> of <chilling/proving/etc.> that the times don't show — Total will read as <prepTime+cookTime> min. Say so in the description (e.g. 'plus 3 hours chilling') so nobody starts it at 5pm." Do not also file it under prepTime or cookTime, and do not fold unattended time into either.

Do NOT flag: style, phrasing, missing optional data (story, tags, photos), a genuinely empty description, or anything subjective. If the data is coherent, return an empty list. Be conservative — a false alarm erodes trust.

Return ONLY valid JSON (no markdown):
{"issues": [{"field": "<one of: category|protein|difficulty|noCook|prepTime|cookTime|servings|seasons|heat|title|description|ingredients|instructions|tags>", "problem": "<one plain sentence a home cook understands>", "fix": <corrected value for that field, or null if only a human can decide>}]}

fix value types: category/protein/difficulty = string from the app's allowed values; noCook = true/false; prepTime/cookTime/servings/heat = integer; seasons = array of season strings. For title/description/ingredients/instructions/tags, fix must be null (flag only).`;

export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    let uid: string;
    try {
      uid = (await getAdminAuth().verifyIdToken(token)).uid;
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    const membership = await getAdminDb().collection("householdMembers").where("userId", "==", uid).limit(1).get();
    if (membership.empty) return NextResponse.json({ error: "Join or create a cookbook first." }, { status: 403 });

    if ((await checkRate(uid)) === "limited") {
      return NextResponse.json(
        { error: "You've run a lot of checks recently — please try again later." },
        { status: 429 }
      );
    }

    const raw = await req.text();
    if (raw.length > 40_000) return NextResponse.json({ error: "Recipe too large." }, { status: 413 });
    const recipe = JSON.parse(raw);

    const response = await client.messages.create({
      model: "claude-sonnet-5",
      // ⚠ 2000 cut the JSON off mid-issue on a recipe with a lot wrong with it
      // (Reuben's pastrami: 24h soak + four flags) and the cook saw "didn't
      // complete" three times in a row. The sanitiser caps issues at 10 anyway.
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Audit this recipe's data:\n${JSON.stringify(recipe).slice(0, 30000)}` }],
    });

    // Bookkeeping only — see lib/ai-usage.ts. Fire-and-forget: it must
    // never fail or slow the request the user is waiting on.
    recordAiCall({
      route: "check-recipe",
      model: "claude-sonnet-5",
      usage: response.usage,
      uid,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }
    const jsonStr = textBlock.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    let parsed: { issues?: unknown };
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      reportError(new Error("check-recipe: model output was not JSON"), { route: "check-recipe", stage: "parse", stop: response.stop_reason ?? "", head: jsonStr.slice(0, 200) });
      return NextResponse.json({ error: "The check didn't complete — please try again." }, { status: 422 });
    }

    // Sanitise: whitelist fields, validate fix values, stringify for the client.
    const issues = (Array.isArray(parsed.issues) ? parsed.issues : [])
      .filter((i): i is { field: string; problem: string; fix: unknown } =>
        !!i && typeof i === "object" && typeof (i as { field?: unknown }).field === "string"
        && typeof (i as { problem?: unknown }).problem === "string")
      .map((i) => {
        const field = i.field;
        let fix: string | null = null;
        if ((FIXABLE_FIELDS as readonly string[]).includes(field) && i.fix != null) {
          if (field === "category" && ALLOWED.category.includes(String(i.fix))) fix = String(i.fix);
          else if (field === "protein" && ALLOWED.protein.includes(String(i.fix))) fix = String(i.fix);
          else if (field === "difficulty" && ALLOWED.difficulty.includes(String(i.fix))) fix = String(i.fix);
          else if (field === "noCook" && typeof i.fix === "boolean") fix = String(i.fix);
          else if (["prepTime", "cookTime", "servings", "heat"].includes(field)) {
            const n = Number(i.fix);
            if (Number.isFinite(n) && n >= 0 && n <= 6000) fix = String(Math.round(n));
          } else if (field === "seasons" && Array.isArray(i.fix)) {
            const vals = i.fix.filter((s: unknown) => typeof s === "string" && ALLOWED.seasons.includes(s));
            fix = vals.join(",");
          }
        }
        const known = [...FIXABLE_FIELDS, ...FLAG_FIELDS].includes(field as never);
        return known ? { field, problem: String(i.problem).slice(0, 300), fix } : null;
      })
      .filter(Boolean)
      .slice(0, 10);

    return NextResponse.json({ ok: true, issues });
  } catch (err) {
    console.error("check-recipe error:", err);
    reportError(err, { route: "check-recipe", stage: "request" });
    return NextResponse.json({ error: "The check failed. Please try again." }, { status: 500 });
  }
}
