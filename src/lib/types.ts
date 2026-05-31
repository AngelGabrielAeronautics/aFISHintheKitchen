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
  householdId?: string;
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
  householdId?: string;
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
  "Bella",
  "Charlie",
  "Dylan",
  "Granny Gill",
  "Poppie",
  "Quaid",
  "Sam",
] as const;

export const CATEGORIES: CategoryInfo[] = [
  {
    slug: "baking-breads",
    name: "Baking & Breads",
    description: "Fill the house with that smell",
    icon: "🍞",
  },
  {
    slug: "braai",
    name: "Braai",
    description: "Fire, meat, and good company",
    icon: "🔥",
  },
  {
    slug: "desserts",
    name: "Desserts",
    description: "Save room — you will want seconds",
    icon: "🍰",
  },
  {
    slug: "drinks",
    name: "Drinks & Shakes",
    description: "Something to sip on",
    icon: "🥤",
  },
  {
    slug: "holiday-specials",
    name: "Holiday Specials",
    description: "Traditions that bring everyone to the table",
    icon: "🎄",
  },
  {
    slug: "mains",
    name: "Mains",
    description: "The heart of every family dinner",
    icon: "🍽️",
  },
  {
    slug: "sauces-condiments",
    name: "Sauces & Condiments",
    description: "The secret weapons behind every great dish",
    icon: "🫙",
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
    slug: "soups",
    name: "Soups",
    description: "Warm the soul, one bowl at a time",
    icon: "🍲",
  },
  {
    slug: "starters-snacks",
    name: "Starters & Snacks",
    description: "Kick things off with something tasty",
    icon: "🧀",
  },
  {
    slug: "stews",
    name: "Stews",
    description: "Low and slow, worth the wait",
    icon: "🫕",
  },
];

export interface EventMenuComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface RecipeCollection {
  id: string;
  householdId?: string;
  name: string;
  description: string;
  createdBy: string;
  recipeIds: string[];
  assignments?: Record<string, string[]>; // recipeId -> up to 3 family member names
  assignmentStatus?: Record<string, Record<string, "pending" | "accepted" | "declined">>;
  comments?: EventMenuComment[];
  editHistory?: EditLogEntry[];
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

export type TipCategory =
  | "technique"
  | "ingredient"
  | "equipment"
  | "time-saver"
  | "substitution"
  | "safety"
  | "general";

export const TIP_CATEGORIES: { value: TipCategory; label: string; icon: string }[] = [
  { value: "equipment", label: "Equipment", icon: "🍳" },
  { value: "general", label: "General", icon: "💡" },
  { value: "ingredient", label: "Ingredient", icon: "🧅" },
  { value: "safety", label: "Safety", icon: "🧤" },
  { value: "substitution", label: "Substitution", icon: "🔄" },
  { value: "technique", label: "Technique", icon: "🔪" },
  { value: "time-saver", label: "Time Saver", icon: "⏱️" },
];

export interface KitchenTip {
  id: string;
  householdId?: string;
  title: string;
  content: string;
  category: TipCategory;
  author: string;
  images?: string[];
  video?: string;
  linkedRecipes?: { id: string; title: string; slug: string }[];
  createdAt: string;
}

export interface AppNotification {
  id: string;
  householdId?: string;
  type: "new-recipe" | "event-assignment";
  message: string;
  link: string;
  authorName: string;
  // Event assignment metadata
  collectionId?: string;
  recipeId?: string;
  assignedMember?: string;
  createdAt: string;
  readBy: string[];
}

export interface UserPreferences {
  notifyNewRecipes: boolean;
}

// ── Multi-tenancy ──

export interface HouseholdCustomisation {
  brandName: string;
  tagline: string;
  primaryColor?: string;
  logoUrl?: string;
}

// Mirrored access state, advanced by the lapse-ladder scheduled job so rules and
// UI can gate with a single read. "active" covers paid, trialing, and the grace window.
export type HouseholdAccessState = "active" | "read_only" | "suspended";

export interface Household {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  // Denormalised member uids so security rules can authorise with one read
  // (rules can't run queries). Maintained alongside the householdMembers docs.
  memberIds: string[];
  customisation: HouseholdCustomisation;
  /** @deprecated superseded by the owner's Subscription + accessState */
  plan?: "free" | "premium";
  accessState?: HouseholdAccessState; // undefined treated as "active" (legacy docs)
  stateChangedAt?: string;
  deleteAfter?: string; // set when suspended; hard-deleted ~1 year later
  createdAt: string;
  // Set when an owner asks for more than the base 5 seats. Captures demand until
  // the paid extra-seats add-on (billing milestone) ships.
  seatUpgradeRequestedAt?: string;
  recipeOfWeek?: {
    weekId: string;
    recipeId: string;
  };
}

export type HouseholdRole = "owner" | "member";

export interface HouseholdMember {
  id: string;
  userId: string;
  householdId: string;
  displayName: string;
  role: HouseholdRole;
  joinedAt: string;
}

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";

// One subscription per paying user; pays for exactly one owned cookbook.
export interface Subscription {
  userId: string; // doc id
  householdId: string; // the one book this subscription pays for
  provider: "stripe" | "paddle" | null; // chosen at the billing milestone
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  status: SubscriptionStatus;
  plan: "monthly" | "annual" | null;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  hasUsedTrial: boolean; // enforces one trial ever
  extraSeats: number; // paid add-on beyond the base 5
  lapsedAt?: string; // when the unpaid ladder started; cleared on recovery
  updatedAt: string;
}
