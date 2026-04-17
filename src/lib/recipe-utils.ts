import type { Recipe } from "./types";

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function matchesRecipeQuery(recipe: Recipe, query: string): boolean {
  const lower = query.toLowerCase();
  return (
    recipe.title.toLowerCase().includes(lower) ||
    recipe.description.toLowerCase().includes(lower) ||
    recipe.tags.some((tag) => tag.toLowerCase().includes(lower)) ||
    recipe.ingredients.some((ingredient) =>
      ingredient.toLowerCase().includes(lower)
    )
  );
}
