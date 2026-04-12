export type Category =
  | "starters-snacks"
  | "soups-stews"
  | "mains"
  | "seafood"
  | "sides-salads"
  | "baking-breads"
  | "desserts"
  | "sauces-condiments"
  | "drinks"
  | "holiday-specials";

export interface CategoryInfo {
  slug: Category;
  name: string;
  description: string;
  icon: string;
}

export interface Recipe {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: Category;
  image: string;
  prepTime: number;
  cookTime: number;
  servings: number;
  difficulty: "Easy" | "Medium" | "Hard";
  ingredients: string[];
  instructions: string[];
  contributedBy: string;
  story?: string;
  tags: string[];
  featured?: boolean;
  createdAt: string;
}

export const CATEGORIES: CategoryInfo[] = [
  {
    slug: "starters-snacks",
    name: "Starters & Snacks",
    description: "Kick things off with something tasty",
    icon: "🧀",
  },
  {
    slug: "soups-stews",
    name: "Soups & Stews",
    description: "Warm the soul, one bowl at a time",
    icon: "🍲",
  },
  {
    slug: "mains",
    name: "Mains",
    description: "The heart of every family dinner",
    icon: "🍽️",
  },
  {
    slug: "seafood",
    name: "Seafood",
    description: "Fresh catches from The Fish Kitchen",
    icon: "🐟",
  },
  {
    slug: "sides-salads",
    name: "Sides & Salads",
    description: "The perfect supporting cast",
    icon: "🥗",
  },
  {
    slug: "baking-breads",
    name: "Baking & Breads",
    description: "Fill the house with that smell",
    icon: "🍞",
  },
  {
    slug: "desserts",
    name: "Desserts",
    description: "Save room — you will want seconds",
    icon: "🍰",
  },
  {
    slug: "sauces-condiments",
    name: "Sauces & Condiments",
    description: "The secret weapons behind every great dish",
    icon: "🫙",
  },
  {
    slug: "drinks",
    name: "Drinks",
    description: "Something to sip on",
    icon: "🥤",
  },
  {
    slug: "holiday-specials",
    name: "Holiday Specials",
    description: "Traditions that bring everyone to the table",
    icon: "🎄",
  },
];

export function getCategoryBySlug(slug: string): CategoryInfo | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
}
