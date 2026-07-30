import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import {
  RECIPE_JSON_SPEC,
  SAFETY_RULES,
  checkThrottle,
  parseModelJson,
  sanitiseRecipe,
} from "@/lib/recipe-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Ask for a recipe — "what can I make with what's in the fridge", "something
// to use up the cream before it turns".
//
// The point of doing this INSIDE the app rather than leaving people to a general
// assistant is that this one knows their cookbook. It can say "you already have
// Poppie's chakalaka, which uses those peppers" and suggest around what the
// family actually cooks. Ungrounded, this would just be a worse version of the
// chat app they'd have used instead.
//
// Generation costs more than the extraction routes and is easier to sit and
// play with, so it gets its own, tighter allowance rather than sharing theirs.
const HOUR_LIMIT = 8;
const MONTH_LIMIT = 40;
const MAX_PROMPT_CHARS = 1_000;
// Titles are cheap and are what makes a suggestion feel like it knows them.
const MAX_CONTEXT_RECIPES = 120;

const SYSTEM_PROMPT = `You are a home cook's recipe assistant inside a private family cookbook app. The cook asks for something to make; you give them ONE recipe.

${RECIPE_JSON_SPEC}

Two extra fields for this task:
- "note": one short, warm sentence to the cook. Use it to point at what they already have — for example "You already have Granny Gill's version of this, which is close." — or to say what you assumed. Omit it if you have nothing useful to say. Never use it to pad or flatter.
- Return {"error": "one sentence"} instead of a recipe if the request isn't a request for something to cook.

How to suggest well:
- Use what they said they have. If they name ingredients to use up, the recipe must actually use them, and prominently.
- You will be given the titles of the recipes already in their cookbook. If one of them is essentially the dish being asked for, still give a recipe, but SAY SO in "note" — they would rather cook their family's version than a stranger's.
- Prefer honest home cooking over restaurant flourishes. This is a family app: things that get made on a Tuesday.
- Respect stated constraints absolutely — vegetarian means no meat, fish or stock; an allergy means the ingredient does not appear at all, including in garnishes.

${SAFETY_RULES}`;

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

    // Must belong to a household — blocks drive-by accounts made to burn the key.
    const membership = await getAdminDb()
      .collection("householdMembers")
      .where("userId", "==", uid)
      .limit(1)
      .get();
    if (membership.empty) {
      return NextResponse.json({ error: "Join or create a cookbook first." }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      prompt?: unknown;
      householdId?: unknown;
    };
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return NextResponse.json({ error: "Tell us what you'd like to cook." }, { status: 400 });
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
      return NextResponse.json(
        { error: "That's a long request — please keep it under 1,000 characters." },
        { status: 413 }
      );
    }

    const rate = await checkThrottle("suggestThrottle", uid, HOUR_LIMIT, MONTH_LIMIT);
    if (rate === "hour") {
      return NextResponse.json(
        { error: "You've asked for a lot of ideas in the last hour — give it a little while." },
        { status: 429 }
      );
    }
    if (rate === "month") {
      return NextResponse.json(
        { error: "You've used this month's recipe ideas. It resets in a few weeks." },
        { status: 429 }
      );
    }

    // Grounding: the titles already in this cookbook. Read server-side from the
    // household the caller actually belongs to, never from a client-supplied
    // list — otherwise anyone could ask us to read another family's recipes.
    const householdId = (membership.docs[0].data() as { householdId?: string }).householdId;
    let known: string[] = [];
    if (householdId) {
      const snap = await getAdminDb()
        .collection("recipes")
        .where("householdId", "==", householdId)
        .limit(MAX_CONTEXT_RECIPES)
        .get();
      known = snap.docs
        .map((d) => (d.data() as { title?: string }).title)
        .filter((t): t is string => !!t && t.length < 120);
    }

    const context = known.length
      ? `Recipes already in their cookbook:\n${known.map((t) => `- ${t}`).join("\n")}`
      : "Their cookbook is empty so far.";

    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `${context}\n\nWhat they asked for:\n<request>\n${prompt}\n</request>`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }
    const parsed = parseModelJson(textBlock.text);
    if (!parsed) {
      return NextResponse.json(
        { error: "That didn't come back as a recipe. Please try asking again." },
        { status: 422 }
      );
    }
    if (parsed && typeof parsed === "object" && "error" in parsed) {
      return NextResponse.json(
        { error: String((parsed as { error: unknown }).error) },
        { status: 422 }
      );
    }

    return NextResponse.json(sanitiseRecipe(parsed));
  } catch (err) {
    console.error("suggest-recipe error:", err);
    return NextResponse.json({ error: "Couldn't get a suggestion. Please try again." }, { status: 500 });
  }
}
