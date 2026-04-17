import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { messagesCreate } = vi.hoisted(() => ({ messagesCreate: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: messagesCreate };
  },
}));

// Silence expected error logs from the route's catch block.
vi.spyOn(console, "error").mockImplementation(() => {});

// Imported after vi.mock so the route's module-level Anthropic instance
// uses our mock.
import { POST } from "../route";

function textBlock(text: string) {
  return { type: "text" as const, text };
}

function successResponse() {
  return {
    content: [
      textBlock(
        JSON.stringify({
          title: "Roast Chicken",
          description: "A Sunday staple",
          ingredients: ["chicken", "salt"],
          instructions: ["season", "roast"],
          prepTime: 10,
          cookTime: 60,
          servings: 4,
          category: "mains",
          protein: "poultry",
          difficulty: "Medium",
          tags: ["sunday"],
          seasons: [],
        })
      ),
    ],
  };
}

function makeRequest(formData: FormData): NextRequest {
  return new NextRequest("http://localhost/api/import-recipe", {
    method: "POST",
    body: formData,
  });
}

function formWithImage(
  bytes: BlobPart,
  name: string,
  type: string
): FormData {
  const fd = new FormData();
  fd.append("image", new File([bytes], name, { type }));
  return fd;
}

beforeEach(() => {
  messagesCreate.mockReset();
});

describe("POST /api/import-recipe", () => {
  it("returns 400 when no image is provided", async () => {
    const res = await POST(makeRequest(new FormData()));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "No image provided" });
    expect(messagesCreate).not.toHaveBeenCalled();
  });

  it("forwards the image to Claude and returns the parsed recipe", async () => {
    messagesCreate.mockResolvedValueOnce(successResponse());
    const res = await POST(
      makeRequest(formWithImage("jpeg-bytes", "recipe.jpg", "image/jpeg"))
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("Roast Chicken");
    expect(messagesCreate).toHaveBeenCalledTimes(1);
    const arg = messagesCreate.mock.calls[0][0];
    expect(arg.messages[0].content[0]).toMatchObject({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: Buffer.from("jpeg-bytes").toString("base64"),
      },
    });
  });

  it.each([
    ["image/png", "image/png"],
    ["image/gif", "image/gif"],
    ["image/webp", "image/webp"],
  ] as const)("maps %s file.type to %s media_type", async (fileType, expected) => {
    messagesCreate.mockResolvedValueOnce(successResponse());
    await POST(makeRequest(formWithImage("x", "r.bin", fileType)));
    const arg = messagesCreate.mock.calls[0][0];
    expect(arg.messages[0].content[0].source.media_type).toBe(expected);
  });

  it("[known-risk] silently treats non-image MIME types as image/jpeg", async () => {
    // There's no MIME allow-list: a PDF (or anything else) is still forwarded
    // to Claude with media_type "image/jpeg". Pinning this so tightening the
    // input validation forces the test to be updated.
    messagesCreate.mockResolvedValueOnce(successResponse());
    await POST(makeRequest(formWithImage("%PDF", "r.pdf", "application/pdf")));
    const arg = messagesCreate.mock.calls[0][0];
    expect(arg.messages[0].content[0].source.media_type).toBe("image/jpeg");
  });

  it("[known-risk] does not require authentication", async () => {
    // The route has no auth check — any anonymous caller can spend Anthropic
    // credits. Pinning this so adding an auth gate forces the test to update.
    messagesCreate.mockResolvedValueOnce(successResponse());
    const res = await POST(
      makeRequest(formWithImage("x", "r.jpg", "image/jpeg"))
    );
    expect(res.status).toBe(200);
  });

  it("returns 500 when the model reply contains no text block", async () => {
    messagesCreate.mockResolvedValueOnce({ content: [] });
    const res = await POST(
      makeRequest(formWithImage("x", "r.jpg", "image/jpeg"))
    );
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "No response from AI" });
  });

  it("returns 500 when the model reply is not valid JSON", async () => {
    messagesCreate.mockResolvedValueOnce({
      content: [textBlock("not json at all")],
    });
    const res = await POST(
      makeRequest(formWithImage("x", "r.jpg", "image/jpeg"))
    );
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "Failed to process image. Please try again.",
    });
  });

  it("returns 500 when the Anthropic SDK throws", async () => {
    messagesCreate.mockRejectedValueOnce(new Error("rate limited"));
    const res = await POST(
      makeRequest(formWithImage("x", "r.jpg", "image/jpeg"))
    );
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "Failed to process image. Please try again.",
    });
  });
});
