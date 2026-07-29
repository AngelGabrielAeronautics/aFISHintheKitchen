import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Abuse guards for the metered Anthropic call: any Firebase account could
// otherwise run up the API bill with unlimited oversized requests.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // matches what phone photos need
const MAX_TEXT_CHARS = 20_000;             // a very long recipe page, pasted whole
const RATE_LIMIT = 20;                     // imports per user per hour (burst guard)
const RATE_WINDOW_MS = 60 * 60 * 1000;     // 1 hour
const MONTHLY_LIMIT = 50;                  // imports per user per 30 days (cost cap ≈ $1/user worst case)
const MONTH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/// Fixed-window per-uid counter in Firestore (serverless has no memory; this
/// mirrors the authEmailThrottle pattern). Fail-open on Firestore errors —
/// availability of the feature beats a perfect limiter here.
async function checkRateLimit(uid: string): Promise<"ok" | "hour" | "month"> {
  try {
    const ref = getAdminDb().collection("importThrottle").doc(uid);
    const now = Date.now();
    const snap = await ref.get();
    const data = snap.data() as
      | { windowStart?: number; count?: number; monthStart?: number; monthCount?: number }
      | undefined;

    const monthFresh = !data?.monthStart || now - data.monthStart > MONTH_WINDOW_MS;
    const monthStart = monthFresh ? now : data!.monthStart!;
    const monthCount = monthFresh ? 0 : data?.monthCount ?? 0;
    if (monthCount >= MONTHLY_LIMIT) return "month";

    const hourFresh = !data?.windowStart || now - data.windowStart > RATE_WINDOW_MS;
    const windowStart = hourFresh ? now : data!.windowStart!;
    const count = hourFresh ? 0 : data?.count ?? 0;
    if (count >= RATE_LIMIT) return "hour";

    await ref.set({ windowStart, count: count + 1, monthStart, monthCount: monthCount + 1 });
    return "ok";
  } catch (err) {
    console.error("import-recipe throttle check failed (continuing):", err);
    return "ok";
  }
}

const SYSTEM_PROMPT = `You are a recipe extraction assistant. You are given a recipe either as an image (a cookbook page, magazine, handwritten card or screenshot) or as pasted text (from a website, a message, or an email). Extract the recipe data into structured JSON.

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
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
- prepTime and cookTime are in minutes (integers). Estimate if not stated.
- If the dish requires NO cooking or heat at all (salads, no-bake desserts, dips), set cookTime to 0 and noCook to true. Otherwise noCook is false.
- servings is an integer. Default to 4 if not stated.
- category must be one of: starters-snacks, breakfast-brunch, soups, stews, curry, mains, seafood, sides-salads, baking-breads, cakes, desserts, jams-preserves, sauces-condiments, drinks, braai, bbq, holiday-specials
- protein must be one of: beef, poultry, lamb, pork, seafood, vegetarian, vegan, eggs, mixed (or empty string if unclear)
- difficulty must be one of: Easy, Medium, Hard
- tags should be relevant keywords (cuisine type, cooking method, etc.)
- seasons should be from: summer, autumn, winter, spring, all-year (or empty array if not seasonal)
- If the recipe has sections (e.g. "For the crust" / "For the filling"), prefix section headers with "## " in both ingredients and instructions arrays
- Keep ingredient formatting natural (e.g. "2 cups flour" not "flour: 2 cups")
- Keep instruction steps clear and concise
- Pasted text often carries the surrounding page with it — navigation, adverts, cookie notices, comment threads, "jump to recipe", a long personal story before the recipe. Ignore all of it and extract only the recipe.
- If you cannot read or extract a recipe, return: {"error": "Could not extract a recipe from this."}`;

export async function POST(request: NextRequest) {
  try {
    // Gate the metered Anthropic call behind a valid signed-in user — any
    // member may import, but anonymous callers can't burn the API key.
    const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    let uid: string;
    try {
      uid = (await getAdminAuth().verifyIdToken(token)).uid;
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Must belong to a household — blocks drive-by accounts created solely to
    // burn the Anthropic key.
    const membership = await getAdminDb()
      .collection("householdMembers")
      .where("userId", "==", uid)
      .limit(1)
      .get();
    if (membership.empty) {
      return NextResponse.json({ error: "Join or create a cookbook first." }, { status: 403 });
    }

    const rate = await checkRateLimit(uid);
    if (rate === "hour") {
      return NextResponse.json(
        { error: "You've imported a lot of recipes in the last hour — please try again later." },
        { status: 429 }
      );
    }
    if (rate === "month") {
      return NextResponse.json(
        { error: "You've reached this month's limit of 50 recipe imports. It resets in a few weeks — recipes can still be added by hand anytime." },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("image") as File | null;
    // Pasted text is the other way in: someone was sent a recipe in a message,
    // or copied one off a website. Same extraction, same limits — only the
    // content block handed to the model differs.
    const pasted = (formData.get("text") as string | null)?.trim() ?? "";

    if (!file && !pasted) {
      return NextResponse.json({ error: "No recipe provided" }, { status: 400 });
    }
    if (file && file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "That photo is too large. Please use an image under 10 MB." },
        { status: 413 }
      );
    }
    if (!file && pasted.length > MAX_TEXT_CHARS) {
      return NextResponse.json(
        { error: "That's a lot of text. Please paste just the recipe (under 20,000 characters)." },
        { status: 413 }
      );
    }

    let content: Anthropic.MessageParam["content"];
    if (file) {
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");

      // Determine media type
      let mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" = "image/jpeg";
      if (file.type === "image/png") mediaType = "image/png";
      else if (file.type === "image/gif") mediaType = "image/gif";
      else if (file.type === "image/webp") mediaType = "image/webp";

      content = [
        { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
        { type: "text", text: "Extract the recipe from this image into structured JSON." },
      ];
    } else {
      content = [
        {
          type: "text",
          text:
            "Extract the recipe from the following text into structured JSON. " +
            "Ignore anything that isn't part of the recipe.\n\n<recipe>\n" +
            pasted +
            "\n</recipe>",
        },
      ];
    }

    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }

    // Parse the JSON response. The model is told to return raw JSON, but it
    // can wrap it in markdown fences or fail to extract — handle both.
    const jsonStr = textBlock.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    let recipe: unknown;
    try {
      recipe = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        {
          error: file
            ? "Could not read a recipe from this image. Please try a clearer photo."
            : "Could not read a recipe from that text. Try pasting just the recipe itself.",
        },
        { status: 422 }
      );
    }

    // The model signals a failed extraction with an { error } object — surface
    // it as an error response rather than a 200 that looks like a recipe.
    if (recipe && typeof recipe === "object" && "error" in recipe) {
      return NextResponse.json(
        { error: String((recipe as { error: unknown }).error) },
        { status: 422 }
      );
    }

    // Sanitise: the client decodes strictly-typed fields, so coerce/clamp here
    // rather than let one malformed value sink the whole import.
    const r = (recipe ?? {}) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v : undefined);
    const strArr = (v: unknown) =>
      Array.isArray(v) ? v.filter((x) => typeof x === "string").map((x) => String(x).slice(0, 500)) : undefined;
    const int = (v: unknown) => {
      const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
      return Number.isFinite(n) ? Math.max(0, Math.min(6000, Math.round(n))) : undefined;
    };
    const oneOf = (v: unknown, allowed: string[]) =>
      typeof v === "string" && allowed.includes(v) ? v : undefined;
    const clean = {
      title: str(r.title)?.slice(0, 200),
      description: str(r.description)?.slice(0, 1000),
      ingredients: strArr(r.ingredients)?.slice(0, 100),
      instructions: strArr(r.instructions)?.slice(0, 100),
      prepTime: int(r.prepTime),
      cookTime: int(r.cookTime),
      servings: int(r.servings),
      category: oneOf(r.category, ["starters-snacks","breakfast-brunch","soups","stews","curry","mains","seafood","sides-salads","baking-breads","cakes","desserts","jams-preserves","sauces-condiments","drinks","braai","bbq","holiday-specials"]),
      protein: oneOf(r.protein, ["beef","poultry","lamb","pork","seafood","vegetarian","vegan","eggs","mixed"]),
      difficulty: oneOf(r.difficulty, ["Easy","Medium","Hard"]),
      noCook: r.noCook === true ? true : undefined,
      tags: strArr(r.tags)?.slice(0, 15),
      seasons: strArr(r.seasons)?.filter((x) => ["summer","autumn","winter","spring","all-year"].includes(x)),
    };
    return NextResponse.json(clean);
  } catch (err) {
    console.error("Recipe import error:", err);
    return NextResponse.json(
      { error: "Failed to process image. Please try again." },
      { status: 500 }
    );
  }
}
