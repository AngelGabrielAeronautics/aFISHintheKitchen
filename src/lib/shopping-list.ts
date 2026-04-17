import type { Recipe } from "./types";

export interface CombinedIngredient {
  /** Original display string (first occurrence wins). */
  display: string;
  /** Titles of recipes that contributed this ingredient. */
  recipes: string[];
}

export type ShoppingListViewMode = "by-recipe" | "combined";

/**
 * Collapse the ingredient lists of several recipes into a single unique list.
 * Ingredients are deduped case-insensitively by their trimmed text; the first
 * occurrence's casing is preserved as `display`.
 */
export function combineIngredients(recipes: Recipe[]): CombinedIngredient[] {
  const map = new Map<string, CombinedIngredient>();
  for (const recipe of recipes) {
    for (const ing of recipe.ingredients) {
      const key = ing.toLowerCase().trim();
      const existing = map.get(key);
      if (existing) {
        existing.recipes.push(recipe.title);
      } else {
        map.set(key, { display: ing, recipes: [recipe.title] });
      }
    }
  }
  return Array.from(map.values());
}

/**
 * Stable checkbox key for a per-recipe ingredient row, matching
 * the key the UI uses when reading/writing `checkedIngredients`.
 */
export function byRecipeIngredientKey(recipeId: string, ingredient: string): string {
  return `${recipeId}::${ingredient}`;
}

export function combinedIngredientKey(display: string): string {
  return `combined::${display}`;
}

function checkbox(checked: boolean): string {
  return checked ? "[x]" : "[ ]";
}

export function formatByRecipeText(
  recipes: Recipe[],
  checkedKeys: ReadonlySet<string>
): string {
  let text = "";
  for (const recipe of recipes) {
    text += `${recipe.title}\n`;
    for (const ing of recipe.ingredients) {
      const key = byRecipeIngredientKey(recipe.id, ing);
      text += `  ${checkbox(checkedKeys.has(key))} ${ing}\n`;
    }
    text += "\n";
  }
  return text;
}

export function formatCombinedText(
  combined: CombinedIngredient[],
  checkedKeys: ReadonlySet<string>
): string {
  let text = "Combined Shopping List\n\n";
  for (const item of combined) {
    const key = combinedIngredientKey(item.display);
    text += `${checkbox(checkedKeys.has(key))} ${item.display}`;
    if (item.recipes.length > 1) {
      text += ` (${item.recipes.join(", ")})`;
    }
    text += "\n";
  }
  return text;
}

export function formatShoppingListText(
  viewMode: ShoppingListViewMode,
  recipes: Recipe[],
  checkedKeys: ReadonlySet<string>
): string {
  if (viewMode === "by-recipe") {
    return formatByRecipeText(recipes, checkedKeys).trim();
  }
  return formatCombinedText(combineIngredients(recipes), checkedKeys).trim();
}
