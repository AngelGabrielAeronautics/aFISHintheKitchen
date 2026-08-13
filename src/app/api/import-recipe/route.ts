import Anthropic from "@anthropic-ai/sdk";
import { recordAiCall } from "@/lib/ai-usage";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { RECIPE_JSON_SPEC, checkThrottle, parseModelJson, sanitiseRecipe } from "@/lib/recipe-ai";

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

const SYSTEM_PROMPT = `You are a recipe extraction assistant. You are given a recipe either as an image (a cookbook page, magazine, handwritten card or screenshot) or as pasted text (from a website, a message, or an email). Extract the recipe data into structured JSON.

${RECIPE_JSON_SPEC}

Extra rules for extraction:
- Estimate prepTime and cookTime if they are not stated.
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

    const rate = await checkThrottle("importThrottle", uid, RATE_LIMIT, MONTHLY_LIMIT);
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

    // Bookkeeping only — see lib/ai-usage.ts. Fire-and-forget: it must
    // never fail or slow the request the user is waiting on.
    recordAiCall({
      route: "import-recipe",
      model: "claude-sonnet-5",
      usage: response.usage,
      uid,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }

    // Parse the JSON response. The model is told to return raw JSON, but it
    // can wrap it in markdown fences or fail to extract — handle both.
    const recipe = parseModelJson(textBlock.text);
    if (!recipe) {
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

    return NextResponse.json(sanitiseRecipe(recipe));
  } catch (err) {
    console.error("Recipe import error:", err);
    return NextResponse.json(
      { error: "Failed to process image. Please try again." },
      { status: 500 }
    );
  }
}
