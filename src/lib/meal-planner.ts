// Pure helpers for the meal planner.
// Kept free of Firebase / React so they can be unit-tested directly.

export type DayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface MealAssignment {
  recipeId: string;
  title: string;
  slug: string;
  image?: string;
}

export interface MealPlan {
  weekId: string;
  userId: string;
  userName: string;
  meals: Partial<Record<DayKey, MealAssignment[]>>;
}

export const DAYS: { key: DayKey; label: string; short: string }[] = [
  { key: "monday", label: "Monday", short: "Mon" },
  { key: "tuesday", label: "Tuesday", short: "Tue" },
  { key: "wednesday", label: "Wednesday", short: "Wed" },
  { key: "thursday", label: "Thursday", short: "Thu" },
  { key: "friday", label: "Friday", short: "Fri" },
  { key: "saturday", label: "Saturday", short: "Sat" },
  { key: "sunday", label: "Sunday", short: "Sun" },
];

/**
 * ISO 8601 week id, formatted "YYYY-Www". Weeks start on Monday and week 1
 * of the year is the one containing 4 January.
 */
export function getWeekId(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    );
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/** Monday (at 00:00 local) of the week containing `date`. */
export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

/** Human-readable "d MMM - d MMM" spanning a Monday to its Sunday. */
export function formatDateRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${fmt(monday)} - ${fmt(sunday)}`;
}

const JS_DAY_TO_KEY: Record<number, DayKey> = {
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
  0: "sunday",
};

/** DayKey for the given date's `.getDay()`. */
export function dayKeyForDate(date: Date): DayKey {
  return JS_DAY_TO_KEY[date.getDay()];
}

/** DayKey for today (per the local clock). */
export function getTodayDayKey(): DayKey {
  return dayKeyForDate(new Date());
}

/** Firestore doc id shape for per-user, per-week meal plans. */
export function planDocId(uid: string, weekId: string): string {
  return `${uid}_${weekId}`;
}

/**
 * Migrate raw per-day meal values from Firestore into the canonical
 * `MealAssignment[]` shape.
 *
 * Historical data used a single MealAssignment object per day; new data
 * uses arrays. Anything else (null, undefined, malformed) is dropped so a
 * bad row can't crash the planner.
 */
export function normalizeMeals(
  raw: unknown
): Partial<Record<DayKey, MealAssignment[]>> {
  const out: Partial<Record<DayKey, MealAssignment[]>> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [day, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!isDayKey(day)) continue;
    if (Array.isArray(val)) {
      out[day] = val as MealAssignment[];
    } else if (val && typeof val === "object" && "recipeId" in val) {
      out[day] = [val as MealAssignment];
    }
    // else: skip
  }
  return out;
}

function isDayKey(s: string): s is DayKey {
  return (
    s === "monday" ||
    s === "tuesday" ||
    s === "wednesday" ||
    s === "thursday" ||
    s === "friday" ||
    s === "saturday" ||
    s === "sunday"
  );
}
