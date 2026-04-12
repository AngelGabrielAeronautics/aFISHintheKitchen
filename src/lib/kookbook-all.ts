import type { Recipe } from "./types";
import { KOOKBOOK_RECIPES_1 } from "./kookbook-recipes-1";
import { KOOKBOOK_RECIPES_2 } from "./kookbook-recipes-2";
import { KOOKBOOK_RECIPES_3 } from "./kookbook-recipes-3";
import { KOOKBOOK_RECIPES_4 } from "./kookbook-recipes-4";

export const KOOKBOOK_RECIPES: Recipe[] = [
  ...KOOKBOOK_RECIPES_1,
  ...KOOKBOOK_RECIPES_2,
  ...KOOKBOOK_RECIPES_3,
  ...KOOKBOOK_RECIPES_4,
];
