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
const RATE_LIMIT = 20;                     // imports per user per window
const RATE_WINDOW_MS = 60 * 60 * 1000;     // 1 hour

/// Fixed-window per-uid counter in Firestore (serverless has no memory; this
/// mirrors the authEmailThrottle pattern). Fail-open on Firestore errors —
/// availability of the feature beats a perfect limiter here.
async function checkRateLimit(uid: string): Promise<boolean> {
  try {
    const ref = getAdminDb().collection("importThrottle").doc(uid);
    const now = Date.now();
    const snap = await ref.get();
    const data = snap.data() as { windowStart?: number; count?: number } | undefined;
    if (!data || now - (data.windowStart ?? 0) > RATE_WINDOW_MS) {
      await ref.set({ windowStart: now, count: 1 });
      return true;
    }
    if ((data.count ?? 0) >= RATE_LIMIT) return false;
    await ref.set({ windowStart: data.windowStart, count: (data.count ?? 0) + 1 });
    return true;
  } catch (err) {
    console.error("import-recipe throttle check failed (continuing):", err);
    return true;
  }
}

const SYSTEM_PROMPT = `You are a recipe extraction assistant. Given an image of a recipe (from a cookbook, magazine, handwritten card, or screenshot), extract the recipe data into structured JSON.

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
  "tags": ["tag1", "tag2"],
  "seasons": []
}

Rules:
- prepTime and cookTime are in minutes (integers). Estimate if not stated.
- servings is an integer. Default to 4 if not stated.
- category must be one of: starters-snacks, soups, stews, mains, seafood, sides-salads, baking-breads, desserts, sauces-condiments, drinks, braai, holiday-specials
- protein must be one of: beef, poultry, lamb, pork, seafood, vegetarian, vegan, eggs, mixed (or empty string if unclear)
- difficulty must be one of: Easy, Medium, Hard
- tags should be relevant keywords (cuisine type, cooking method, etc.)
- seasons should be from: summer, autumn, winter, spring, all-year (or empty array if not seasonal)
- If the recipe has sections (e.g. "For the crust" / "For the filling"), prefix section headers with "## " in both ingredients and instructions arrays
- Keep ingredient formatting natural (e.g. "2 cups flour" not "flour: 2 cups")
- Keep instruction steps clear and concise
- If you cannot read or extract a recipe from the image, return: {"error": "Could not extract a recipe from this image. Please try a clearer photo."}`;

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

    if (!(await checkRateLimit(uid))) {
      return NextResponse.json(
        { error: "You've imported a lot of recipes in the last hour — please try again later." },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "That photo is too large. Please use an image under 10 MB." },
        { status: 413 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    // Determine media type
    let mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" = "image/jpeg";
    if (file.type === "image/png") mediaType = "image/png";
    else if (file.type === "image/gif") mediaType = "image/gif";
    else if (file.type === "image/webp") mediaType = "image/webp";

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: "text",
              text: "Extract the recipe from this image into structured JSON.",
            },
          ],
        },
      ],
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
        { error: "Could not read a recipe from this image. Please try a clearer photo." },
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

    return NextResponse.json(recipe);
  } catch (err) {
    console.error("Recipe import error:", err);
    return NextResponse.json(
      { error: "Failed to process image. Please try again." },
      { status: 500 }
    );
  }
}
