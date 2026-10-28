import Anthropic from "@anthropic-ai/sdk";
import { recordAiCall } from "@/lib/ai-usage";
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { checkThrottle } from "@/lib/recipe-ai";

export const runtime = "nodejs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// One call tags up to 30 recipes — cheap, but still bounded per user.
const HOUR_LIMIT = 10;
const MONTH_LIMIT = 40;
const MAX_RECIPES = 30;


const SYSTEM_PROMPT = `You suggest search tags for recipes in a family cookbook app. For each recipe you receive, propose 3-6 short, useful, lowercase tags a home cook would search for: cuisine (e.g. "south african", "italian"), cooking method ("braai", "one-pot", "baked"), occasion ("weeknight", "sunday lunch", "party"), key ingredient ("chicken", "chocolate"), and dietary notes ("vegetarian", "gluten-free" ONLY when clearly true).

Rules:
- lowercase, 1-3 words per tag, no "#"
- for anything cooked over fire/coals (a braai), also add "bbq" and "grill" so cooks outside South Africa find it
- never duplicate the recipe's existing tags (they're provided)
- never invent dietary claims
- Return ONLY valid JSON: {"suggestions": [{"id": "<recipe id>", "tags": ["tag1", "tag2"]}]}
- Use exactly the ids you were given.`;

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
    if ((await checkThrottle("tagThrottle", uid, HOUR_LIMIT, MONTH_LIMIT)) !== "ok") {
      return NextResponse.json({ error: "You've run a lot of tag suggestions recently — try again later." }, { status: 429 });
    }

    const body = (await req.json()) as {
      recipes?: { id?: string; title?: string; description?: string; category?: string; protein?: string; ingredients?: string[]; tags?: string[] }[];
    };
    const recipes = (body.recipes ?? []).slice(0, MAX_RECIPES).filter((r) => r.id && r.title);
    if (recipes.length === 0) return NextResponse.json({ error: "No recipes provided" }, { status: 400 });
    const inputIds = new Set(recipes.map((r) => String(r.id)));

    const compact = recipes.map((r) => ({
      id: String(r.id),
      title: String(r.title).slice(0, 150),
      description: String(r.description ?? "").slice(0, 300),
      category: r.category ?? "",
      protein: r.protein ?? "",
      ingredients: (r.ingredients ?? []).slice(0, 10).map((i) => String(i).slice(0, 80)),
      existingTags: (r.tags ?? []).slice(0, 10),
    }));

    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Suggest tags for these recipes:\n${JSON.stringify(compact)}` }],
    });

    // Bookkeeping only — see lib/ai-usage.ts. Fire-and-forget: it must
    // never fail or slow the request the user is waiting on.
    recordAiCall({
      route: "suggest-tags",
      model: "claude-sonnet-5",
      usage: response.usage,
      uid,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }
    const jsonStr = textBlock.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    let parsed: { suggestions?: unknown };
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json({ error: "Suggestions didn't complete — please try again." }, { status: 422 });
    }

    const suggestions = (Array.isArray(parsed.suggestions) ? parsed.suggestions : [])
      .filter((s): s is { id: string; tags: unknown } =>
        !!s && typeof s === "object" && typeof (s as { id?: unknown }).id === "string"
        && inputIds.has((s as { id: string }).id))
      .map((s) => ({
        id: s.id,
        tags: (Array.isArray(s.tags) ? s.tags : [])
          .filter((t: unknown) => typeof t === "string")
          .map((t: string) => t.toLowerCase().trim().replace(/^#/, "").slice(0, 30))
          .filter((t: string) => t.length > 1 && /^[a-z0-9 '\-]+$/.test(t))
          .slice(0, 6),
      }))
      .filter((s) => s.tags.length > 0);

    return NextResponse.json({ ok: true, suggestions });
  } catch (err) {
    console.error("suggest-tags error:", err);
    return NextResponse.json({ error: "Tag suggestions failed. Please try again." }, { status: 500 });
  }
}
