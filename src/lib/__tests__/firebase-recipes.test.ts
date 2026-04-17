import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  addDocMock,
  collectionMock,
  getDbMock,
} = vi.hoisted(() => ({
  addDocMock: vi.fn(),
  collectionMock: vi.fn(),
  getDbMock: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: collectionMock,
  query: vi.fn(),
  orderBy: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  addDoc: addDocMock,
  writeBatch: vi.fn(),
  doc: vi.fn(),
  getCountFromServer: vi.fn(),
  updateDoc: vi.fn(),
  arrayUnion: vi.fn(),
  arrayRemove: vi.fn(),
  deleteDoc: vi.fn(),
}));
vi.mock("firebase/storage", () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}));
vi.mock("../firebase", () => ({
  getDb: getDbMock,
  getFirebaseStorage: vi.fn(),
}));

import { addRecipe, type NewRecipeInput } from "../firebase-recipes";
import type { Category } from "../types";

function makeInput(overrides: Partial<NewRecipeInput> = {}): NewRecipeInput {
  return {
    title: "Roast Chicken",
    description: "A Sunday staple",
    category: "mains" as Category,
    image: "",
    prepTime: 15,
    cookTime: 60,
    servings: 4,
    difficulty: "Medium",
    ingredients: ["chicken", "salt"],
    instructions: ["season", "roast"],
    contributedBy: "Alice",
    tags: [],
    createdByUid: "uid-alice",
    ...overrides,
  };
}

beforeEach(() => {
  addDocMock.mockReset();
  collectionMock.mockReset();
  getDbMock.mockReset();
  getDbMock.mockReturnValue({ __mockDb: true });
  collectionMock.mockReturnValue({ __mockRecipes: true });
  addDocMock.mockResolvedValue({ id: "generated-id" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("addRecipe", () => {
  it("stamps createdByUid onto the persisted document", async () => {
    await addRecipe(makeInput({ createdByUid: "uid-alice" }));
    expect(addDocMock).toHaveBeenCalledTimes(1);
    const payload = addDocMock.mock.calls[0][1];
    expect(payload.createdByUid).toBe("uid-alice");
  });

  it("derives the slug from the title", async () => {
    await addRecipe(makeInput({ title: "Mom's Famous!! Lasagna" }));
    const payload = addDocMock.mock.calls[0][1];
    expect(payload.slug).toBe("moms-famous-lasagna");
  });

  it("stamps a createdAt ISO timestamp", async () => {
    await addRecipe(makeInput());
    const payload = addDocMock.mock.calls[0][1];
    expect(typeof payload.createdAt).toBe("string");
    expect(() => new Date(payload.createdAt).toISOString()).not.toThrow();
  });

  it("returns the generated doc id alongside the input fields", async () => {
    addDocMock.mockResolvedValueOnce({ id: "abc123" });
    const saved = await addRecipe(makeInput({ title: "Bread" }));
    expect(saved.id).toBe("abc123");
    expect(saved.title).toBe("Bread");
    expect(saved.createdByUid).toBe("uid-alice");
  });
});
