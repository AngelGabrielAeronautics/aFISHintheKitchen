import { describe, it, expect } from "vitest";
import { slugify, matchesRecipeQuery } from "../recipe-utils";
import type { Recipe } from "../types";

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: "r1",
    slug: "r1",
    title: "Sample",
    description: "A sample recipe",
    category: "mains",
    image: "",
    prepTime: 10,
    cookTime: 20,
    servings: 4,
    difficulty: "Easy",
    ingredients: [],
    instructions: [],
    contributedBy: "Sam",
    tags: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(slugify("Roast Chicken")).toBe("roast-chicken");
  });

  it("strips punctuation", () => {
    expect(slugify("Mom's #1 Lasagna!")).toBe("moms-1-lasagna");
  });

  it("collapses runs of whitespace and hyphens", () => {
    expect(slugify("Pea   Soup")).toBe("pea-soup");
    expect(slugify("Fish --- Pie")).toBe("fish-pie");
  });

  it("preserves numbers and existing hyphens", () => {
    expect(slugify("3-bean chilli")).toBe("3-bean-chilli");
  });

  it("returns empty string for empty and whitespace-only input", () => {
    expect(slugify("")).toBe("");
    expect(slugify("   ")).toBe("");
  });

  it("strips leading and trailing hyphens from punctuation-heavy titles", () => {
    expect(slugify("-- Stew --")).toBe("stew");
    expect(slugify("!!! chicken !!!")).toBe("chicken");
  });

  it("strips accented characters (ASCII-only)", () => {
    // Current implementation only keeps [a-z0-9\s-], so accents drop.
    // This test pins the existing behavior so we notice if it changes.
    expect(slugify("Crème Brûlée")).toBe("crme-brle");
  });
});

describe("matchesRecipeQuery", () => {
  const recipe = makeRecipe({
    title: "Beef Stew",
    description: "Slow-cooked comfort food",
    tags: ["winter", "hearty"],
    ingredients: ["beef chuck", "carrots", "red wine"],
  });

  it("matches by title, case-insensitively", () => {
    expect(matchesRecipeQuery(recipe, "beef")).toBe(true);
    expect(matchesRecipeQuery(recipe, "BEEF")).toBe(true);
    expect(matchesRecipeQuery(recipe, "stew")).toBe(true);
  });

  it("matches by description", () => {
    expect(matchesRecipeQuery(recipe, "comfort")).toBe(true);
  });

  it("matches by tag", () => {
    expect(matchesRecipeQuery(recipe, "winter")).toBe(true);
    expect(matchesRecipeQuery(recipe, "HEARTY")).toBe(true);
  });

  it("matches by ingredient", () => {
    expect(matchesRecipeQuery(recipe, "carrots")).toBe(true);
    expect(matchesRecipeQuery(recipe, "red wine")).toBe(true);
  });

  it("returns false when nothing matches", () => {
    expect(matchesRecipeQuery(recipe, "salmon")).toBe(false);
  });

  it("returns true for an empty query (every field contains '')", () => {
    // Document current behavior: empty query matches everything.
    expect(matchesRecipeQuery(recipe, "")).toBe(true);
  });
});
