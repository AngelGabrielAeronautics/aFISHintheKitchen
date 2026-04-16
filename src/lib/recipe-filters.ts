import type { Protein, Recipe, Season } from "./types";

export type Difficulty = "Easy" | "Medium" | "Hard";
export type SortOption = "newest" | "quickest" | "longest" | "az";
export type RecipeStatus = "all" | "must-try" | "tried" | "not-tried";

export interface RecipeFilterOptions {
  cook?: string; // "all" or a contributor name
  difficulty?: Difficulty | "all";
  maxTime?: number | "";
  protein?: Protein | "all";
  /** Status filter is ignored unless `statusUserName` is also supplied. */
  status?: RecipeStatus;
  statusUserName?: string;
  season?: Season | "all";
  ingredient?: string;
}

export function filterRecipes(
  recipes: Recipe[],
  opts: RecipeFilterOptions = {}
): Recipe[] {
  const {
    cook = "all",
    difficulty = "all",
    maxTime = "",
    protein = "all",
    status = "all",
    statusUserName,
    season = "all",
    ingredient = "",
  } = opts;

  let results = recipes;

  if (cook !== "all") {
    results = results.filter((r) => r.contributedBy === cook);
  }
  if (difficulty !== "all") {
    results = results.filter((r) => r.difficulty === difficulty);
  }
  if (maxTime !== "") {
    results = results.filter((r) => r.prepTime + r.cookTime <= maxTime);
  }
  if (protein !== "all") {
    results = results.filter((r) => r.protein === protein);
  }
  if (status !== "all" && statusUserName) {
    const name = statusUserName;
    if (status === "must-try") {
      results = results.filter((r) => r.mustTry?.includes(name));
    } else if (status === "tried") {
      results = results.filter((r) => r.triedBy?.includes(name));
    } else if (status === "not-tried") {
      results = results.filter((r) => !r.triedBy?.includes(name));
    }
  }
  if (season !== "all") {
    results = results.filter((r) => r.seasons?.includes(season));
  }
  const trimmed = ingredient.trim();
  if (trimmed) {
    const term = trimmed.toLowerCase();
    results = results.filter((r) =>
      r.ingredients.some((ing) => ing.toLowerCase().includes(term))
    );
  }

  return results;
}

export function sortRecipes(recipes: Recipe[], sort: SortOption): Recipe[] {
  const copy = [...recipes];
  switch (sort) {
    case "quickest":
      return copy.sort(
        (a, b) => a.prepTime + a.cookTime - (b.prepTime + b.cookTime)
      );
    case "longest":
      return copy.sort(
        (a, b) => b.prepTime + b.cookTime - (a.prepTime + a.cookTime)
      );
    case "az":
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    case "newest":
    default:
      // Preserve incoming order — Firestore returns newest-first.
      return copy;
  }
}

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  if (pageSize <= 0) return [];
  const start = Math.max(0, (page - 1) * pageSize);
  return items.slice(start, start + pageSize);
}

export function totalPages(count: number, pageSize: number): number {
  if (pageSize <= 0) return 0;
  return Math.ceil(count / pageSize);
}
