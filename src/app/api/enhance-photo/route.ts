import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { recordAiCall } from "@/lib/ai-usage";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 60; // image generation can take 20-30s

// AI photo enhancement (Gemini image model): restyle and re-shoot the COVER
// photo of a dish as a cookbook would print it. Opt-in, previewed, and the
// original is always kept.
//
// The line this draws is DISH IDENTITY, not pixel fidelity. The model may
// re-plate, change the vessel, garnish, and choose the surface and props — a
// food stylist's job as much as a photographer's. What it may not do is change
// what the meal IS: no substituting a different dish, no adding ingredients
// that would misrepresent the recipe (meat onto a vegetarian plate being the
// case that actually matters).
//
// It used to open with "KEEP THE FOOD IDENTICAL" and forbid restyling outright,
// which the model read as "return roughly what you were given" — the results
// were barely distinguishable from the snapshot, so nobody used the feature.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const HOUR_LIMIT = 10;
const MONTH_LIMIT = 20;
const HOUR_MS = 60 * 60 * 1000;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

const PROMPT =
  "You are a professional food photographer and food stylist. Take THIS DISH and produce the photograph " +
  "a cookbook would print: properly styled, properly lit, properly shot. The result should look clearly " +
  "and obviously better than the snapshot you were given — not a subtle touch-up.\n\n" +
  "RESTYLE IT FREELY. Re-plate the food attractively; choose a more flattering plate, bowl, board or " +
  "glass; tidy away smears and stray crumbs; wipe the rim; reposition components for balance; and add " +
  "tasteful garnish that belongs to this dish — its own herbs, a dusting, a drizzle of its own sauce. " +
  "Choose the surface, background and props: natural wood, stone, ceramic or linen, with cutlery, a " +
  "napkin or a cloth where they help. Pick the most flattering angle (around 45 degrees for plated " +
  "meals, straight down for flat dishes, bowls and boards), a shallow depth of field with a gently " +
  "blurred background, soft directional light like window light, and rich, natural, mouth-watering " +
  "colour with professional grading.\n\n" +
  "IT MUST STILL BE THIS MEAL. Same dish, same recipe, same food. Do not substitute a different dish, " +
  "and do not add any ingredient that would change what the meal is — never add meat, fish or dairy to " +
  "a plate that has none. The person who cooked this has to recognise it as theirs, cooked well.\n\n" +
  "The result must be a real PHOTOGRAPH — not an illustration, render or cartoon. No text, no " +
  "watermarks, no hands and no people in the frame.";

// Cheap vision gate — runs before the (paid) image model. Blocks photos that
// aren't a dish, and photos that feature a person or child. A generative image
// model must never re-render someone's face, and this is a family app where
// kids' photos are everywhere on the camera roll.
const CLASSIFY_PROMPT =
  "Look at this photo and reply with JSON only, no other text: " +
  '{"isDish": boolean, "hasPerson": boolean}. ' +
  "isDish is true if the main subject is a plate, bowl, board, or glass of prepared food or a drink " +
  "(a cooked dish or meal). hasPerson is true only if the photo prominently shows a person, a human " +
  "face, or a child — ignore an incidental hand holding a plate or a blurred person far in the background.";

async function classifyImage(
  base64: string,
  mime: string
): Promise<{ isDish: boolean; hasPerson: boolean } | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ inline_data: { mime_type: mime, data: base64 } }, { text: CLASSIFY_PROMPT }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
      }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    const parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")) as {
      isDish?: unknown;
      hasPerson?: unknown;
    };
    return { isDish: parsed.isDish === true, hasPerson: parsed.hasPerson === true };
  } catch (err) {
    // Fail open — Gemini's own image-model safety filter is the backstop for
    // the people case, and a flaky classifier shouldn't block real dishes.
    console.error("enhance classify failed (continuing):", err);
    return null;
  }
}

async function checkRate(uid: string): Promise<"ok" | "limited"> {
  try {
    const ref = getAdminDb().collection("enhanceThrottle").doc(uid);
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
    console.error("enhance throttle failed (continuing):", err);
    return "ok";
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Photo enhancement isn't configured yet." }, { status: 503 });
    }
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

    const formData = await req.formData();
    const file = formData.get("image") as File | null;
    if (!file) return NextResponse.json({ error: "No image provided" }, { status: 400 });
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "That photo is too large. Please use an image under 10 MB." }, { status: 413 });
    }
    const mime = file.type || "image/jpeg";
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

    // Content gate before spending on the image model (and before the rate
    // counter, so a rejected photo doesn't cost a user one of their 20/month).
    const verdict = await classifyImage(base64, mime);
    if (verdict?.hasPerson) {
      return NextResponse.json(
        { error: "For privacy, we can only enhance photos of the food itself — not photos with people in them. Please use a photo of just the dish." },
        { status: 422 }
      );
    }
    if (verdict && !verdict.isDish) {
      return NextResponse.json(
        { error: "That doesn't look like a photo of a dish. The enhancer works on photos of plated food or drinks." },
        { status: 422 }
      );
    }

    if ((await checkRate(uid)) === "limited") {
      return NextResponse.json(
        { error: "You've enhanced a lot of photos recently — the limit is 20 a month. Try again later." },
        { status: 429 }
      );
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: mime, data: base64 } },
                { text: PROMPT },
              ],
            },
          ],
        }),
      }
    );
    if (!geminiRes.ok) {
      console.error("gemini error", geminiRes.status, (await geminiRes.text()).slice(0, 500));
      return NextResponse.json({ error: "The enhancement didn't complete. Please try again." }, { status: 502 });
    }
    const gemini = (await geminiRes.json()) as {
      candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string } }[] } }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };

    // ⚠ Gemini names its token counts differently to Anthropic, and this is an
    // IMAGE model — lib/ai-usage.ts has no rate for it, so it is deliberately
    // recorded and left UNPRICED rather than costed with a made-up figure. The
    // console lists unpriced models so the gap is visible rather than silent.
    recordAiCall({
      route: "enhance-photo",
      model: "gemini-2.5-flash-image",
      usage: {
        input_tokens: gemini.usageMetadata?.promptTokenCount ?? 0,
        output_tokens: gemini.usageMetadata?.candidatesTokenCount ?? 0,
      },
      uid,
    });
    const parts = gemini.candidates?.[0]?.content?.parts ?? [];
    const normalised = parts
      .map((p) => p.inlineData ?? p.inline_data)
      .filter((d): d is { mimeType?: string; mime_type?: string; data?: string } => !!d?.data)
      .map((d) => ({ mime: ("mimeType" in d ? d.mimeType : undefined) ?? ("mime_type" in d ? d.mime_type : undefined) ?? "image/jpeg", data: d.data! }));
    const imgPart = normalised[0];
    if (!imgPart) {
      return NextResponse.json({ error: "The enhancement didn't produce an image. Please try again." }, { status: 502 });
    }

    // Store next to other recipe images (public-read path) with a download token.
    const bucket = getStorage().bucket("a-fish-in-the-kitchen.firebasestorage.app");
    const path = `recipe-images/enhanced/${uid}-${randomUUID()}.jpg`;
    const dl = randomUUID();
    await bucket.file(path).save(Buffer.from(imgPart.data, "base64"), {
      metadata: {
        contentType: imgPart.mime,
        metadata: { firebaseStorageDownloadTokens: dl },
      },
    });
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${dl}`;
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    console.error("enhance-photo error:", err);
    return NextResponse.json({ error: "The enhancement failed. Please try again." }, { status: 500 });
  }
}
