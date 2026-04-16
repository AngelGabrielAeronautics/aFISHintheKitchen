"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { doc, setDoc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { getAllRecipes } from "@/lib/firebase-recipes";
import Avatar from "@/components/Avatar";
import { useAuth } from "@/context/AuthContext";
import type { Recipe } from "@/lib/types";

// --- Types ---

type DayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

interface MealAssignment {
  recipeId: string;
  title: string;
  slug: string;
  image?: string;
}

interface MealPlan {
  weekId: string;
  userId: string;
  userName: string;
  meals: Partial<Record<DayKey, MealAssignment>>;
}

const DAYS: { key: DayKey; label: string; short: string }[] = [
  { key: "monday", label: "Monday", short: "Mon" },
  { key: "tuesday", label: "Tuesday", short: "Tue" },
  { key: "wednesday", label: "Wednesday", short: "Wed" },
  { key: "thursday", label: "Thursday", short: "Thu" },
  { key: "friday", label: "Friday", short: "Fri" },
  { key: "saturday", label: "Saturday", short: "Sat" },
  { key: "sunday", label: "Sunday", short: "Sun" },
];

// --- Week helpers ---

function getWeekId(date: Date): string {
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

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

function formatDateRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${fmt(monday)} - ${fmt(sunday)}`;
}

function getTodayDayKey(): DayKey | null {
  const jsDay = new Date().getDay(); // 0=Sun
  const map: Record<number, DayKey> = {
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday",
    0: "sunday",
  };
  return map[jsDay] ?? null;
}

// --- Firestore helpers ---

function planDocId(uid: string, weekId: string) {
  return `${uid}_${weekId}`;
}

async function loadMealPlan(uid: string, userName: string, weekId: string): Promise<MealPlan> {
  const snap = await getDoc(doc(getDb(), "mealPlans", planDocId(uid, weekId)));
  if (snap.exists()) {
    return snap.data() as MealPlan;
  }
  return { weekId, userId: uid, userName, meals: {} };
}

async function saveMealPlan(plan: MealPlan): Promise<void> {
  await setDoc(doc(getDb(), "mealPlans", planDocId(plan.userId, plan.weekId)), plan);
}

async function loadFamilyPlans(weekId: string): Promise<MealPlan[]> {
  const q = query(collection(getDb(), "mealPlans"), where("weekId", "==", weekId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as MealPlan);
}

// --- Recipe Search Modal ---

function RecipeSearchModal({
  recipes,
  onSelect,
  onClose,
}: {
  recipes: Recipe[];
  onSelect: (r: Recipe) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const sorted = [...recipes].sort((a, b) => a.title.localeCompare(b.title));
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter((r) => r.title.toLowerCase().includes(q));
  }, [search, recipes]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-warm-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
        {/* Search header */}
        <div className="p-4 border-b border-gold-light/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-serif text-lg text-charcoal">Choose a recipe</h3>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate hover:text-charcoal hover:bg-cream-dark/60 transition-colors cursor-pointer"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search recipes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gold-light bg-cream text-charcoal placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta text-sm"
          />
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="text-center text-slate text-sm py-8">
              No recipes found
            </p>
          ) : (
            <div className="space-y-1">
              {filtered.map((recipe) => (
                <button
                  key={recipe.id}
                  onClick={() => onSelect(recipe)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-cream-dark/60 transition-colors cursor-pointer"
                >
                  {recipe.image ? (
                    <Image
                      src={recipe.image}
                      alt={recipe.title}
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <span className="w-10 h-10 rounded-lg bg-gold-light/30 flex items-center justify-center shrink-0 text-slate/50">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.379a48.474 48.474 0 00-6-.371c-2.032 0-4.034.126-6 .371m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.169c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12M12.265 3.11a.375.375 0 11-.53 0L12 2.845l.265.265zm-3 0a.375.375 0 11-.53 0L9 2.845l.265.265zm6 0a.375.375 0 11-.53 0L15 2.845l.265.265z"
                        />
                      </svg>
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-charcoal truncate">
                      {recipe.title}
                    </p>
                    <p className="text-xs text-slate truncate">
                      {recipe.category.replace("-", " ")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---

export default function MealPlannerPage() {
  const { user, loading: authLoading } = useAuth();
  const [currentMonday, setCurrentMonday] = useState<Date>(
    getMondayOfWeek(new Date())
  );
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [familyPlans, setFamilyPlans] = useState<MealPlan[]>([]);
  const [viewMode, setViewMode] = useState<"mine" | "family">("mine");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectingDay, setSelectingDay] = useState<DayKey | null>(null);

  const weekId = getWeekId(currentMonday);
  const todayWeekId = getWeekId(new Date());
  const todayDayKey = getTodayDayKey();
  const isCurrentWeek = weekId === todayWeekId;

  // Load recipes once
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getAllRecipes().then((r) => {
      if (!cancelled) {
        setRecipes(r);
        setLoadingRecipes(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Load meal plan when week changes
  useEffect(() => {
    if (!user) return;
    const userName = user.displayName || user.email || "Unknown";
    let cancelled = false;
    setLoadingPlan(true);
    Promise.all([
      loadMealPlan(user.uid, userName, weekId),
      loadFamilyPlans(weekId),
    ]).then(([myPlan, allPlans]) => {
      if (!cancelled) {
        setMealPlan(myPlan);
        setFamilyPlans(allPlans.filter((p) => p.userId !== user.uid && Object.keys(p.meals).length > 0));
        setLoadingPlan(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [weekId, user]);

  function navigateWeek(offset: number) {
    setCurrentMonday((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + offset * 7);
      return d;
    });
  }

  function goToThisWeek() {
    setCurrentMonday(getMondayOfWeek(new Date()));
  }

  async function assignRecipe(day: DayKey, recipe: Recipe) {
    if (!mealPlan) return;
    const updated: MealPlan = {
      ...mealPlan,
      meals: {
        ...mealPlan.meals,
        [day]: {
          recipeId: recipe.id,
          title: recipe.title,
          slug: recipe.slug,
          ...(recipe.image ? { image: recipe.image } : {}),
        },
      },
    };
    setMealPlan(updated);
    setSelectingDay(null);
    setSaving(true);
    await saveMealPlan(updated);
    setSaving(false);
  }

  async function removeMeal(day: DayKey) {
    if (!mealPlan) return;
    if (!confirm("Remove this meal from the plan?")) return;
    const meals = { ...mealPlan.meals };
    delete meals[day];
    const updated: MealPlan = { ...mealPlan, meals };
    setMealPlan(updated);
    setSaving(true);
    await saveMealPlan(updated);
    setSaving(false);
  }

  // --- Auth loading ---
  if (authLoading) {
    return (
      <main className="min-h-screen bg-cream py-8 sm:py-16 px-4">
        <div className="max-w-md mx-auto flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cream-dark border-t-terracotta" />
        </div>
      </main>
    );
  }

  // --- Not signed in ---
  if (!user) {
    return (
      <main className="min-h-screen bg-cream py-8 sm:py-16 px-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-10 text-center">
            <div className="w-16 h-16 bg-gold-light/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-charcoal/60"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
            </div>
            <h2 className="font-serif text-2xl text-charcoal mb-2">
              Sign in to plan your meals
            </h2>
            <p className="text-slate mb-8">
              You need to be signed in to use the meal planner.
            </p>
            <Link
              href="/auth"
              className="inline-block px-6 py-3 bg-terracotta text-white font-medium rounded-xl hover:bg-terracotta-dark transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="font-serif text-3xl sm:text-4xl text-charcoal mb-1">
            Meal Planner
          </h1>
          <p className="text-slate text-sm">
            Plan your week, one meal at a time.
          </p>
        </div>

        {/* Week navigation */}
        <div className="flex items-center justify-between mb-6 bg-warm-white rounded-2xl p-4 shadow-sm border border-gold-light/30">
          <button
            onClick={() => navigateWeek(-1)}
            className="p-2 rounded-xl text-slate hover:text-charcoal hover:bg-cream-dark/60 transition-colors cursor-pointer"
            aria-label="Previous week"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
          </button>

          <div className="text-center flex-1 min-w-0">
            <p className="font-serif text-lg sm:text-xl text-charcoal font-semibold">
              {formatDateRange(currentMonday)}
            </p>
            <p className="text-xs text-slate mt-0.5">
              {weekId}
              {saving && (
                <span className="ml-2 text-terracotta">Saving...</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-1">
            {!isCurrentWeek && (
              <button
                onClick={goToThisWeek}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-terracotta bg-terracotta/8 hover:bg-terracotta/15 transition-colors cursor-pointer"
              >
                This Week
              </button>
            )}
            <button
              onClick={() => navigateWeek(1)}
              className="p-2 rounded-xl text-slate hover:text-charcoal hover:bg-cream-dark/60 transition-colors cursor-pointer"
              aria-label="Next week"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.25 4.5l7.5 7.5-7.5 7.5"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Loading state */}
        {loadingPlan ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cream-dark border-t-terracotta" />
          </div>
        ) : (
          <>
            {/* Today highlight banner */}
            {isCurrentWeek && todayDayKey && (
              <div className="mb-6 bg-terracotta/8 border border-terracotta/20 rounded-2xl p-4">
                <p className="text-sm text-charcoal">
                  <span className="font-semibold text-terracotta">
                    What&apos;s cooking today?
                  </span>{" "}
                  {mealPlan?.meals[todayDayKey] ? (
                    <Link
                      href={`/recipes/${mealPlan.meals[todayDayKey]!.slug}`}
                      className="font-medium text-charcoal underline decoration-terracotta/40 hover:decoration-terracotta transition-colors"
                    >
                      {mealPlan.meals[todayDayKey]!.title}
                    </Link>
                  ) : (
                    <span className="text-slate italic">
                      Nothing planned yet -{" "}
                      <button
                        onClick={() => setSelectingDay(todayDayKey)}
                        className="text-terracotta underline cursor-pointer"
                      >
                        add something
                      </button>
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* View tabs */}
            <div className="flex gap-2 mb-6">
              <button
                type="button"
                onClick={() => setViewMode("mine")}
                className={`rounded-full px-4 py-1.5 font-sans text-sm font-medium transition-colors cursor-pointer ${viewMode === "mine" ? "bg-terracotta text-white" : "bg-warm-white text-slate ring-1 ring-cream-dark/40 hover:text-charcoal"}`}
              >
                My Plan
              </button>
              <button
                type="button"
                onClick={() => setViewMode("family")}
                className={`rounded-full px-4 py-1.5 font-sans text-sm font-medium transition-colors cursor-pointer ${viewMode === "family" ? "bg-terracotta text-white" : "bg-warm-white text-slate ring-1 ring-cream-dark/40 hover:text-charcoal"}`}
              >
                Family
                {familyPlans.length > 0 && (
                  <span className={`ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 text-xs ${viewMode === "family" ? "bg-white/20" : "bg-cream-dark/30"}`}>
                    {familyPlans.length}
                  </span>
                )}
              </button>
            </div>

            {viewMode === "mine" ? (
            <>
            {/* Day grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {DAYS.map(({ key, label, short }) => {
                const meal = mealPlan?.meals[key];
                const isToday = isCurrentWeek && key === todayDayKey;

                return (
                  <div
                    key={key}
                    className={`bg-warm-white rounded-2xl shadow-sm border overflow-hidden transition-colors ${
                      isToday
                        ? "border-terracotta/40 border-l-4 border-l-terracotta"
                        : "border-gold-light/30"
                    }`}
                  >
                    {/* Day header */}
                    <div
                      className={`px-4 py-2.5 border-b ${
                        isToday
                          ? "bg-terracotta/8 border-terracotta/20"
                          : "bg-cream-dark/30 border-gold-light/30"
                      }`}
                    >
                      <h3
                        className={`font-serif text-sm font-semibold ${
                          isToday ? "text-terracotta" : "text-charcoal"
                        }`}
                      >
                        <span className="lg:hidden">{label}</span>
                        <span className="hidden lg:inline">{short}</span>
                      </h3>
                    </div>

                    {/* Day body */}
                    <div className="p-3">
                      {meal ? (
                        <div className="space-y-2">
                          {/* Recipe thumbnail + title */}
                          <Link
                            href={`/recipes/${meal.slug}`}
                            className="flex items-start gap-2.5 group"
                          >
                            {meal.image ? (
                              <Image
                                src={meal.image}
                                alt={meal.title}
                                width={48}
                                height={48}
                                className="w-12 h-12 rounded-lg object-cover shrink-0"
                              />
                            ) : (
                              <span className="w-12 h-12 rounded-lg bg-gold-light/30 flex items-center justify-center shrink-0 text-slate/40">
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth={1.5}
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.379a48.474 48.474 0 00-6-.371c-2.032 0-4.034.126-6 .371m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.169c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12M12.265 3.11a.375.375 0 11-.53 0L12 2.845l.265.265zm-3 0a.375.375 0 11-.53 0L9 2.845l.265.265zm6 0a.375.375 0 11-.53 0L15 2.845l.265.265z"
                                  />
                                </svg>
                              </span>
                            )}
                            <p className="text-sm font-medium text-charcoal leading-snug group-hover:text-terracotta transition-colors line-clamp-3">
                              {meal.title}
                            </p>
                          </Link>

                          {/* Remove button */}
                          <button
                            onClick={() => removeMeal(key)}
                            className="flex items-center gap-1 text-xs text-slate hover:text-red-500 transition-colors cursor-pointer"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="text-center py-3">
                          <p className="text-xs text-slate/60 mb-2">
                            No meal planned
                          </p>
                          <button
                            onClick={() => setSelectingDay(key)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-terracotta bg-terracotta/8 hover:bg-terracotta/15 transition-colors cursor-pointer"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 4.5v15m7.5-7.5h-15"
                              />
                            </svg>
                            Add
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Shopping list link */}
            {mealPlan && Object.keys(mealPlan.meals).length > 0 && (
              <div className="mt-6 text-center">
                <Link
                  href={`/shopping-list?recipes=${Object.values(mealPlan.meals).map((m) => m!.recipeId).join(",")}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-terracotta px-6 py-3 font-sans text-sm font-semibold text-white shadow-sm transition-colors hover:bg-terracotta-dark"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                    <path fillRule="evenodd" d="M6 5v1H4.667a1.75 1.75 0 0 0-1.743 1.598l-.826 9.5A1.75 1.75 0 0 0 3.84 19H16.16a1.75 1.75 0 0 0 1.743-1.902l-.826-9.5A1.75 1.75 0 0 0 15.333 6H14V5a4 4 0 0 0-8 0Zm4-2.5A2.5 2.5 0 0 0 7.5 5v1h5V5A2.5 2.5 0 0 0 10 2.5ZM7.5 10a2.5 2.5 0 0 0 5 0V8.75a.75.75 0 0 1 1.5 0V10a4 4 0 0 1-8 0V8.75a.75.75 0 0 1 1.5 0V10Z" clipRule="evenodd" />
                  </svg>
                  Generate Shopping List for This Week
                </Link>
              </div>
            )}
            </>
            ) : (
            /* ---- Family view ---- */
            <div>
              {familyPlans.length === 0 ? (
                <div className="text-center py-12">
                  <p className="font-sans text-sm text-slate">No other family members have planned meals for this week yet.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {familyPlans.map((plan) => (
                    <div key={plan.userId} className="rounded-2xl bg-warm-white p-5 ring-1 ring-cream-dark/30">
                      <div className="flex items-center gap-2 mb-4">
                        <Avatar name={plan.userName} size="md" ring />
                        <h3 className="font-serif text-lg font-bold text-charcoal">{plan.userName}&rsquo;s Plan</h3>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
                        {DAYS.map(({ key, short }) => {
                          const meal = plan.meals[key];
                          return (
                            <div key={key} className="rounded-lg bg-cream/60 p-2.5">
                              <p className="font-sans text-[10px] font-semibold text-slate/60 uppercase mb-1.5">{short}</p>
                              {meal ? (
                                <Link href={`/recipes/${meal.slug}`} className="block">
                                  {meal.image && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={meal.image} alt="" className="w-full aspect-square rounded-md object-cover mb-1.5" />
                                  )}
                                  <p className="font-sans text-xs font-medium text-charcoal leading-tight line-clamp-2 hover:text-terracotta transition-colors">{meal.title}</p>
                                </Link>
                              ) : (
                                <p className="font-sans text-[10px] text-slate/40 italic">No meal</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}
          </>
        )}
      </div>

      {/* Recipe search modal */}
      {selectingDay && !loadingRecipes && (
        <RecipeSearchModal
          recipes={recipes}
          onSelect={(recipe) => assignRecipe(selectingDay, recipe)}
          onClose={() => setSelectingDay(null)}
        />
      )}
    </main>
  );
}
