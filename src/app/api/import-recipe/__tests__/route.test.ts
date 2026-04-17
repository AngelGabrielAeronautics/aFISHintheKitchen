import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { messagesCreate, verifyIdToken } = vi.hoisted(() => ({
  messagesCreate: vi.fn(),
  verifyIdToken: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: messagesCreate };
  },
}));

vi.mock("@/lib/firebase-admin", () => ({
  getAdminAuth: () => ({ verifyIdToken }),
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

function makeRequest(formData: FormData, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/import-recipe", {
    method: "POST",
    headers: {
      Authorization: "Bearer valid-token",
      ...headers,
    },
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
  verifyIdToken.mockReset();
  // Default: valid token for most tests. Auth-specific tests override this.
  verifyIdToken.mockResolvedValue({ uid: "test-uid" });
});

describe("POST /api/import-recipe — authentication", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const req = new NextRequest("http://localhost/api/import-recipe", {
      method: "POST",
      body: formWithImage("x", "r.jpg", "image/jpeg"),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: "Authentication required",
    });
    expect(verifyIdToken).not.toHaveBeenCalled();
    expect(messagesCreate).not.toHaveBeenCalled();
  });

  it("returns 401 for a malformed Authorization header", async () => {
    const req = new NextRequest("http://localhost/api/import-recipe", {
      method: "POST",
      headers: { Authorization: "NotBearer xxx" },
      body: formWithImage("x", "r.jpg", "image/jpeg"),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it("returns 401 when the ID token is invalid", async () => {
    verifyIdToken.mockRejectedValueOnce(new Error("expired"));
    const res = await POST(
      makeRequest(formWithImage("x", "r.jpg", "image/jpeg"))
    );
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: "Invalid or expired token",
    });
    expect(messagesCreate).not.toHaveBeenCalled();
  });

  it("calls verifyIdToken with the bearer token from the header", async () => {
    messagesCreate.mockResolvedValueOnce(successResponse());
    const req = new NextRequest("http://localhost/api/import-recipe", {
      method: "POST",
      headers: { Authorization: "Bearer my-id-token" },
      body: formWithImage("x", "r.jpg", "image/jpeg"),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(verifyIdToken).toHaveBeenCalledWith("my-id-token");
  });
});

describe("POST /api/import-recipe — input validation", () => {
  it("returns 400 when no image is provided", async () => {
    const res = await POST(makeRequest(new FormData()));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "No image provided" });
    expect(messagesCreate).not.toHaveBeenCalled();
  });

  it("rejects non-image MIME types with 400 (closes previous [known-risk])", async () => {
    const res = await POST(
      makeRequest(formWithImage("%PDF", "r.pdf", "application/pdf"))
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "Unsupported image type. Use JPEG, PNG, GIF, or WebP.",
    });
    expect(messagesCreate).not.toHaveBeenCalled();
  });

  it("rejects octet-stream / missing MIME type", async () => {
    const res = await POST(
      makeRequest(formWithImage("x", "r.bin", "application/octet-stream"))
    );
    expect(res.status).toBe(400);
    expect(messagesCreate).not.toHaveBeenCalled();
  });

  it("rejects images over the 10MB size cap with 413", async () => {
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    const res = await POST(
      makeRequest(formWithImage(big, "huge.jpg", "image/jpeg"))
    );
    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toEqual({
      error: "Image is too large. Maximum 10MB.",
    });
    expect(messagesCreate).not.toHaveBeenCalled();
  });
});

describe("POST /api/import-recipe — happy path", () => {
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
});

describe("POST /api/import-recipe — error branches", () => {
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
