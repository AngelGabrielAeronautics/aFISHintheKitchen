import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
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

    // Parse the JSON response
    const jsonStr = textBlock.text.trim();
    const recipe = JSON.parse(jsonStr);

    return NextResponse.json(recipe);
  } catch (err) {
    console.error("Recipe import error:", err);
    return NextResponse.json(
      { error: "Failed to process image. Please try again." },
      { status: 500 }
    );
  }
}
