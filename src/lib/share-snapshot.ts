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

/**
 * Is this a share token we could have minted?
 *
 * Tokens are `randomBytes(12).toString("base64url")` — 16 url-safe chars. A
 * value with a slash in it is not just absent, it is an INVALID Firestore
 * document path, and `doc(token).get()` throws rather than returning "not
 * found" — so a mangled link returned a hard 500 instead of the app's friendly
 * "that share isn't available any more" screen.
 *
 * That is not hypothetical: WhatsApp appended junk to a real customer's share
 * token in July. Validate first, 404 on anything that can't be ours.
 */
export function isShareToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(token);
}
