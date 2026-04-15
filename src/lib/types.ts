export type Category =
  | "starters-snacks"
  | "soups"
  | "stews"
  | "mains"
  | "seafood"
  | "sides-salads"
  | "baking-breads"
  | "desserts"
  | "sauces-condiments"
  | "drinks"
  | "braai"
  | "holiday-specials";

export interface CategoryInfo {
  slug: Category;
  name: string;
  description: string;
  icon: string;
}

export type Protein =
  | "beef"
  | "poultry"
  | "lamb"
  | "pork"
  | "seafood"
  | "vegetarian"
  | "vegan"
  | "eggs"
  | "mixed";

export const DIFFICULTY_ICONS: Record<string, string> = {
  Easy: "/icons/easy.png",
  Medium: "/icons/medium.png",
  Hard: "/icons/hard.png",
};

export type HeatLevel = 1 | 2 | 3 | 4 | 5;

export const HEAT_LABELS: Record<HeatLevel, string> = {
  1: "Mild",
  2: "Medium",
  3: "Hot",
  4: "Very Hot",
  5: "Extreme",
};

export const HEAT_ICONS: Record<HeatLevel, string> = {
  1: "/icons/heat/mild.png",
  2: "/icons/heat/medium.png",
  3: "/icons/heat/hot.png",
  4: "/icons/heat/very-hot.png",
  5: "/icons/heat/extreme.png",
};

export interface RecipeNote {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface EditLogEntry {
  editor: string;
  date: string;
  summary: string;
}

export interface Recipe {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: Category;
  image: string;
  images?: string[];
  prepTime: number;
  cookTime: number;
  servings: number;
  difficulty: "Easy" | "Medium" | "Hard";
  protein?: Protein;
  heat?: HeatLevel;
  ingredients: string[];
  instructions: string[];
  instructionImages?: Record<string, string>;
  video?: string;
  contributedBy: string;
  story?: string;
  originalSource?: string;
  tags: string[];
  lovedBy?: string[];
  dislikedBy?: string[];
  seasons?: Season[];
  mustTry?: string[];
  triedBy?: string[];
  notes?: RecipeNote[];
  editHistory?: EditLogEntry[];
  forkedFrom?: string;
  versionOf?: string;
  versionAuthor?: string;
  featured?: boolean;
  createdAt: string;
}

export interface Member {
  id: string;
  order: number;
  name: string;
  title: string;
  bio: string;
  goodAt: string[];
  loves: string[];
  hates: string[];
  favouriteFromBook: string;
  favouriteNotInBook: string;
}

export type Season = "summer" | "autumn" | "winter" | "spring" | "all-year";

export const SEASONS: { value: Season; label: string }[] = [
  { value: "summer", label: "Summer" },
  { value: "autumn", label: "Autumn" },
  { value: "winter", label: "Winter" },
  { value: "spring", label: "Spring" },
  { value: "all-year", label: "All Year" },
];

export const FAMILY_MEMBERS = [
  "Poppie",
  "Granny Gill",
  "Dylan",
  "Sam",
  "Bella",
  "Charlie",
  "Quaid",
] as const;

export const CATEGORIES: CategoryInfo[] = [
  {
    slug: "starters-snacks",
    name: "Starters & Snacks",
    description: "Kick things off with something tasty",
    icon: "🧀",
  },
  {
    slug: "soups",
    name: "Soups",
    description: "Warm the soul, one bowl at a time",
    icon: "🍲",
  },
  {
    slug: "stews",
    name: "Stews",
    description: "Low and slow, worth the wait",
    icon: "🫕",
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
    description: "Fresh catches from A Fish in the Kitchen",
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
    name: "Drinks & Shakes",
    description: "Something to sip on",
    icon: "🥤",
  },
  {
    slug: "braai",
    name: "Braai",
    description: "Fire, meat, and good company",
    icon: "🔥",
  },
  {
    slug: "holiday-specials",
    name: "Holiday Specials",
    description: "Traditions that bring everyone to the table",
    icon: "🎄",
  },
];

export interface RecipeCollection {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  recipeIds: string[];
  createdAt: string;
}

export function getCategoryBySlug(slug: string): CategoryInfo | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
}
