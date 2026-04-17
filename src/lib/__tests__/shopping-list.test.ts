import { describe, expect, it } from "vitest";
import {
  byRecipeIngredientKey,
  combineIngredients,
  combinedIngredientKey,
  formatByRecipeText,
  formatCombinedText,
  formatShoppingListText,
} from "../shopping-list";
import type { Recipe } from "../types";

function r(
  overrides: Partial<Recipe> & { id: string; title: string; ingredients: string[] }
): Recipe {
  return {
    slug: overrides.id,
    description: "",
    category: "mains",
    image: "",
    prepTime: 0,
    cookTime: 0,
    servings: 2,
    difficulty: "Easy",
    instructions: [],
    contributedBy: "Sam",
    tags: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("combineIngredients", () => {
  it("returns [] for no recipes", () => {
    expect(combineIngredients([])).toEqual([]);
  });

  it("copies each ingredient once for a single recipe", () => {
    const recipes = [
      r({ id: "a", title: "Bread", ingredients: ["flour", "water", "salt"] }),
    ];
    expect(combineIngredients(recipes)).toEqual([
      { display: "flour", recipes: ["Bread"] },
      { display: "water", recipes: ["Bread"] },
      { display: "salt", recipes: ["Bread"] },
    ]);
  });

  it("dedupes case-insensitively and keeps first-seen casing", () => {
    const recipes = [
      r({ id: "a", title: "A", ingredients: ["Salt"] }),
      r({ id: "b", title: "B", ingredients: ["salt", "Pepper"] }),
    ];
    const combined = combineIngredients(recipes);
    expect(combined).toEqual([
      { display: "Salt", recipes: ["A", "B"] },
      { display: "Pepper", recipes: ["B"] },
    ]);
  });

  it("trims surrounding whitespace when matching duplicates", () => {
    const recipes = [
      r({ id: "a", title: "A", ingredients: ["butter"] }),
      r({ id: "b", title: "B", ingredients: ["  butter  "] }),
    ];
    expect(combineIngredients(recipes)).toEqual([
      { display: "butter", recipes: ["A", "B"] },
    ]);
  });

  it("does not merge ingredients that differ in quantity or phrasing", () => {
    const recipes = [
      r({ id: "a", title: "A", ingredients: ["2 cups flour"] }),
      r({ id: "b", title: "B", ingredients: ["1 cup flour"] }),
    ];
    expect(combineIngredients(recipes).map((c) => c.display)).toEqual([
      "2 cups flour",
      "1 cup flour",
    ]);
  });

  it("preserves the order of first occurrence across recipes", () => {
    const recipes = [
      r({ id: "a", title: "A", ingredients: ["onion", "garlic"] }),
      r({ id: "b", title: "B", ingredients: ["garlic", "tomato"] }),
    ];
    expect(combineIngredients(recipes).map((c) => c.display)).toEqual([
      "onion",
      "garlic",
      "tomato",
    ]);
  });
});

describe("checkbox key helpers", () => {
  it("byRecipeIngredientKey uses the '::' separator", () => {
    expect(byRecipeIngredientKey("r1", "2 cups flour")).toBe("r1::2 cups flour");
  });

  it("combinedIngredientKey prefixes with 'combined::'", () => {
    expect(combinedIngredientKey("2 cups flour")).toBe("combined::2 cups flour");
  });
});

describe("formatByRecipeText", () => {
  const recipes = [
    r({ id: "a", title: "Bread", ingredients: ["flour", "water"] }),
    r({ id: "b", title: "Pie", ingredients: ["apples"] }),
  ];

  it("renders each recipe with its ingredients as unchecked boxes by default", () => {
    const text = formatByRecipeText(recipes, new Set());
    expect(text).toBe(
      "Bread\n  [ ] flour\n  [ ] water\n\nPie\n  [ ] apples\n\n"
    );
  });

  it("marks checked ingredients with [x] using the recipe-scoped key", () => {
    const checked = new Set([byRecipeIngredientKey("a", "water")]);
    const text = formatByRecipeText(recipes, checked);
    expect(text).toContain("  [ ] flour");
    expect(text).toContain("  [x] water");
    expect(text).toContain("  [ ] apples");
  });
});

describe("formatCombinedText", () => {
  it("renders the combined list with a single-recipe item", () => {
    const combined = [{ display: "flour", recipes: ["Bread"] }];
    expect(formatCombinedText(combined, new Set())).toBe(
      "Combined Shopping List\n\n[ ] flour\n"
    );
  });

  it("appends '(recipeA, recipeB)' when an ingredient spans multiple recipes", () => {
    const combined = [
      { display: "flour", recipes: ["Bread", "Pie"] },
      { display: "water", recipes: ["Bread"] },
    ];
    expect(formatCombinedText(combined, new Set())).toContain(
      "[ ] flour (Bread, Pie)"
    );
    expect(formatCombinedText(combined, new Set())).toContain("[ ] water\n");
  });

  it("marks checked items via combinedIngredientKey", () => {
    const combined = [{ display: "flour", recipes: ["Bread"] }];
    const checked = new Set([combinedIngredientKey("flour")]);
    expect(formatCombinedText(combined, checked)).toContain("[x] flour");
  });
});

describe("formatShoppingListText (dispatch)", () => {
  const recipes = [
    r({ id: "a", title: "Bread", ingredients: ["flour"] }),
    r({ id: "b", title: "Pie", ingredients: ["flour", "apples"] }),
  ];

  it("returns the by-recipe form when viewMode is 'by-recipe'", () => {
    const text = formatShoppingListText("by-recipe", recipes, new Set());
    expect(text.startsWith("Bread")).toBe(true);
    expect(text).toContain("Pie");
    expect(text.endsWith("\n")).toBe(false); // trailing whitespace trimmed
  });

  it("returns the combined form when viewMode is 'combined'", () => {
    const text = formatShoppingListText("combined", recipes, new Set());
    expect(text.startsWith("Combined Shopping List")).toBe(true);
    expect(text).toContain("[ ] flour (Bread, Pie)");
    expect(text).toContain("[ ] apples");
  });
});
