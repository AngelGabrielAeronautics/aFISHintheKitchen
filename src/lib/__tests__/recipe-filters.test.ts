import { describe, it, expect } from "vitest";
import {
  filterRecipes,
  sortRecipes,
  paginate,
  totalPages,
} from "../recipe-filters";
import type { Recipe } from "../types";

function r(overrides: Partial<Recipe> & { id: string; title: string }): Recipe {
  return {
    slug: overrides.id,
    description: "",
    category: "mains",
    image: "",
    prepTime: 0,
    cookTime: 0,
    servings: 2,
    difficulty: "Easy",
    ingredients: [],
    instructions: [],
    contributedBy: "Sam",
    tags: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const beef = r({
  id: "beef",
  title: "Beef Stew",
  difficulty: "Medium",
  protein: "beef",
  prepTime: 20,
  cookTime: 100,
  contributedBy: "Charlie",
  ingredients: ["Beef chuck", "carrots", "red wine"],
  seasons: ["winter"],
  mustTry: ["Bella"],
  triedBy: ["Dylan"],
});

const salad = r({
  id: "salad",
  title: "Summer Salad",
  difficulty: "Easy",
  protein: "vegetarian",
  prepTime: 10,
  cookTime: 0,
  contributedBy: "Bella",
  ingredients: ["lettuce", "tomato", "olive oil"],
  seasons: ["summer", "spring"],
});

const pie = r({
  id: "pie",
  title: "Apple Pie",
  difficulty: "Hard",
  protein: "vegetarian",
  prepTime: 30,
  cookTime: 60,
  contributedBy: "Charlie",
  ingredients: ["apples", "flour", "butter"],
  mustTry: ["Dylan"],
  triedBy: ["Bella"],
});

const dataset = [beef, salad, pie];

describe("filterRecipes", () => {
  it("returns all recipes when no filters are set", () => {
    expect(filterRecipes(dataset)).toEqual(dataset);
  });

  it("filters by cook (contributor)", () => {
    expect(filterRecipes(dataset, { cook: "Charlie" }).map((r) => r.id)).toEqual(
      ["beef", "pie"]
    );
  });

  it("filters by difficulty", () => {
    expect(
      filterRecipes(dataset, { difficulty: "Hard" }).map((r) => r.id)
    ).toEqual(["pie"]);
  });

  it("filters by protein", () => {
    expect(
      filterRecipes(dataset, { protein: "vegetarian" }).map((r) => r.id)
    ).toEqual(["salad", "pie"]);
  });

  it("filters by season membership", () => {
    expect(
      filterRecipes(dataset, { season: "summer" }).map((r) => r.id)
    ).toEqual(["salad"]);
  });

  it("filters by maxTime using prepTime + cookTime", () => {
    // beef = 120, salad = 10, pie = 90
    expect(
      filterRecipes(dataset, { maxTime: 30 }).map((r) => r.id)
    ).toEqual(["salad"]);
    expect(
      filterRecipes(dataset, { maxTime: 90 }).map((r) => r.id)
    ).toEqual(["salad", "pie"]);
  });

  it("filters by ingredient substring case-insensitively", () => {
    expect(
      filterRecipes(dataset, { ingredient: "Butter" }).map((r) => r.id)
    ).toEqual(["pie"]);
    expect(
      filterRecipes(dataset, { ingredient: "  APPLES  " }).map((r) => r.id)
    ).toEqual(["pie"]);
  });

  it("treats empty/whitespace ingredient filter as no-op", () => {
    expect(filterRecipes(dataset, { ingredient: "   " })).toEqual(dataset);
  });

  it("ignores the status filter when no user name is supplied", () => {
    expect(filterRecipes(dataset, { status: "must-try" })).toEqual(dataset);
  });

  it("filters by must-try for the current user", () => {
    expect(
      filterRecipes(dataset, {
        status: "must-try",
        statusUserName: "Bella",
      }).map((r) => r.id)
    ).toEqual(["beef"]);
  });

  it("filters by tried recipes for the current user", () => {
    expect(
      filterRecipes(dataset, {
        status: "tried",
        statusUserName: "Dylan",
      }).map((r) => r.id)
    ).toEqual(["beef"]);
  });

  it("filters by not-tried for the current user (includes recipes with no triedBy)", () => {
    expect(
      filterRecipes(dataset, {
        status: "not-tried",
        statusUserName: "Quaid",
      }).map((r) => r.id)
    ).toEqual(["beef", "salad", "pie"]);
  });

  it("AND-combines multiple filters", () => {
    expect(
      filterRecipes(dataset, {
        cook: "Charlie",
        difficulty: "Medium",
        maxTime: 120,
      }).map((r) => r.id)
    ).toEqual(["beef"]);
  });

  it("does not mutate the input array", () => {
    const input = [...dataset];
    filterRecipes(input, { difficulty: "Hard" });
    expect(input).toEqual(dataset);
  });
});

describe("sortRecipes", () => {
  it("sorts quickest first by total time", () => {
    expect(sortRecipes(dataset, "quickest").map((r) => r.id)).toEqual([
      "salad",
      "pie",
      "beef",
    ]);
  });

  it("sorts longest first by total time", () => {
    expect(sortRecipes(dataset, "longest").map((r) => r.id)).toEqual([
      "beef",
      "pie",
      "salad",
    ]);
  });

  it("sorts A-Z by title", () => {
    expect(sortRecipes(dataset, "az").map((r) => r.id)).toEqual([
      "pie",
      "beef",
      "salad",
    ]);
  });

  it("preserves input order for 'newest' (Firestore already orders)", () => {
    expect(sortRecipes(dataset, "newest").map((r) => r.id)).toEqual([
      "beef",
      "salad",
      "pie",
    ]);
  });

  it("does not mutate the input array", () => {
    const input = [...dataset];
    sortRecipes(input, "az");
    expect(input.map((r) => r.id)).toEqual(["beef", "salad", "pie"]);
  });
});

describe("paginate", () => {
  const items = [1, 2, 3, 4, 5, 6, 7];

  it("returns the requested page slice", () => {
    expect(paginate(items, 1, 3)).toEqual([1, 2, 3]);
    expect(paginate(items, 2, 3)).toEqual([4, 5, 6]);
    expect(paginate(items, 3, 3)).toEqual([7]);
  });

  it("returns [] for a page past the end", () => {
    expect(paginate(items, 99, 3)).toEqual([]);
  });

  it("clamps negative/zero page to the first page", () => {
    expect(paginate(items, 0, 3)).toEqual([1, 2, 3]);
    expect(paginate(items, -5, 3)).toEqual([1, 2, 3]);
  });

  it("returns [] for non-positive page size", () => {
    expect(paginate(items, 1, 0)).toEqual([]);
    expect(paginate(items, 1, -1)).toEqual([]);
  });
});

describe("totalPages", () => {
  it("rounds up to cover partial pages", () => {
    expect(totalPages(0, 10)).toBe(0);
    expect(totalPages(10, 10)).toBe(1);
    expect(totalPages(11, 10)).toBe(2);
    expect(totalPages(25, 10)).toBe(3);
  });

  it("returns 0 for a non-positive page size", () => {
    expect(totalPages(100, 0)).toBe(0);
  });
});
