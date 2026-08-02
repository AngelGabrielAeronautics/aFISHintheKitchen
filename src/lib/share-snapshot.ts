// The public shape of a shared recipe — family-private fields (verdicts,
// notes, edit history) deliberately absent. Used by /api/share-recipe when a
// link is minted or re-shared, and by /api/refresh-shares when an editor
// pushes the latest version to existing links.
export function buildShareSnapshot(recipe: FirebaseFirestore.DocumentData) {
  return {
    title: recipe.title ?? "",
    description: recipe.description ?? "",
    image: recipe.image ?? "",
    images: recipe.images ?? [],
    category: recipe.category ?? "other",
    prepTime: recipe.prepTime ?? 0,
    cookTime: recipe.cookTime ?? 0,
    noCook: recipe.noCook ?? false,
    servings: recipe.servings ?? 0,
    difficulty: recipe.difficulty ?? "Medium",
    protein: recipe.protein ?? null,
    heat: recipe.heat ?? null,
    ingredients: recipe.ingredients ?? [],
    instructions: recipe.instructions ?? [],
    story: recipe.story ?? null,
    originalSource: recipe.originalSource ?? null,
    contributedBy: recipe.contributedBy ?? "",
    tags: recipe.tags ?? [],
  };
}
