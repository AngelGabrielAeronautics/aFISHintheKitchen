"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getAllRecipes,
  searchRecipes,
  getRecipesByCategory,
} from "@/lib/firebase-recipes";
import { CATEGORIES, SEASONS, type Recipe, type Protein, type Season } from "@/lib/types";
import RecipeCard from "@/components/RecipeCard";
import { useAuth } from "@/context/AuthContext";

type Difficulty = "Easy" | "Medium" | "Hard";
type SortOption = "newest" | "quickest" | "longest" | "az";

function RecipesContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category") ?? "all";
  const searchParam = searchParams.get("search") ?? "";
  const cookParam = searchParams.get("cook") ?? "all";
  const difficultyParam = searchParams.get("difficulty") ?? "all";
  const proteinParam = searchParams.get("protein") ?? "all";
  const ingredientParam = searchParams.get("ingredient") ?? "";
  const maxTimeParam = searchParams.get("maxTime") ?? "";
  const sortParam = searchParams.get("sort") ?? "newest";

  const hasUrlFilters = cookParam !== "all" || difficultyParam !== "all" || proteinParam !== "all" || ingredientParam !== "" || maxTimeParam !== "" || sortParam !== "newest";

  const [searchQuery, setSearchQuery] = useState(searchParam);
  const [activeCategory, setActiveCategory] = useState(categoryParam);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  // Advanced filters
  const [filtersOpen, setFiltersOpen] = useState(hasUrlFilters);
  const [filterCook, setFilterCook] = useState(cookParam);
  const [filterDifficulty, setFilterDifficulty] = useState<Difficulty | "all">(difficultyParam as Difficulty | "all");
  const [filterMaxTime, setFilterMaxTime] = useState<number | "">(maxTimeParam ? Number(maxTimeParam) : "");
  const [filterSort, setFilterSort] = useState<SortOption>(sortParam as SortOption);
  const [filterIngredient, setFilterIngredient] = useState(ingredientParam);
  const [filterProtein, setFilterProtein] = useState<Protein | "all">(proteinParam as Protein | "all");
  const [filterStatus, setFilterStatus] = useState<"all" | "must-try" | "tried" | "not-tried">("all");
  const [filterSeason, setFilterSeason] = useState<Season | "all">("all");

  // Derive unique contributors from all recipes
  const contributors = useMemo(() => {
    const names = new Set(allRecipes.map((r) => r.contributedBy));
    return Array.from(names).sort();
  }, [allRecipes]);

  const activeFilterCount = [
    filterCook !== "all",
    filterDifficulty !== "all",
    filterMaxTime !== "",
    filterSort !== "newest",
    filterIngredient.trim() !== "",
    filterProtein !== "all",
    filterStatus !== "all",
    filterSeason !== "all",
    activeCategory !== "all",
  ].filter(Boolean).length;

  const fetchRecipes = useCallback(
    async (search: string, category: string) => {
      setLoading(true);
      try {
        let results: Recipe[];

        if (search.trim() && category !== "all") {
          results = await searchRecipes(search);
          results = results.filter((r) => r.category === category);
        } else if (search.trim()) {
          results = await searchRecipes(search);
        } else if (category !== "all") {
          results = await getRecipesByCategory(category);
        } else {
          results = await getAllRecipes();
        }

        setRecipes(results);
      } catch (error) {
        console.error("Failed to fetch recipes:", error);
        setRecipes([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Fetch all recipes once for category counts and contributor list
  useEffect(() => {
    getAllRecipes().then(setAllRecipes).catch(() => {});
  }, []);

  const categoryCounts = allRecipes.reduce<Record<string, number>>((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + 1;
    return acc;
  }, {});

  // Fetch on mount and when category changes
  useEffect(() => {
    fetchRecipes(searchQuery, activeCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  // Debounced search: 300ms delay
  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchRecipes(searchQuery, activeCategory);
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Apply client-side filters and sorting on top of fetched results
  const filteredRecipes = useMemo(() => {
    let results = [...recipes];

    if (filterCook !== "all") {
      results = results.filter((r) => r.contributedBy === filterCook);
    }

    if (filterDifficulty !== "all") {
      results = results.filter((r) => r.difficulty === filterDifficulty);
    }

    if (filterMaxTime !== "") {
      results = results.filter((r) => r.prepTime + r.cookTime <= filterMaxTime);
    }

    if (filterProtein !== "all") {
      results = results.filter((r) => r.protein === filterProtein);
    }

    if (filterStatus !== "all" && user?.displayName) {
      const name = user.displayName;
      if (filterStatus === "must-try") {
        results = results.filter((r) => r.mustTry?.includes(name));
      } else if (filterStatus === "tried") {
        results = results.filter((r) => r.triedBy?.includes(name));
      } else if (filterStatus === "not-tried") {
        results = results.filter((r) => !r.triedBy?.includes(name));
      }
    }

    if (filterSeason !== "all") {
      results = results.filter((r) => r.seasons?.includes(filterSeason));
    }

    if (filterIngredient.trim()) {
      const term = filterIngredient.toLowerCase();
      results = results.filter((r) =>
        r.ingredients.some((ing) => ing.toLowerCase().includes(term))
      );
    }

    switch (filterSort) {
      case "quickest":
        results.sort((a, b) => (a.prepTime + a.cookTime) - (b.prepTime + b.cookTime));
        break;
      case "longest":
        results.sort((a, b) => (b.prepTime + b.cookTime) - (a.prepTime + a.cookTime));
        break;
      case "az":
        results.sort((a, b) => a.title.localeCompare(b.title));
        break;
      // "newest" is already the default order from Firestore
    }

    return results;
  }, [recipes, filterCook, filterDifficulty, filterMaxTime, filterSort, filterIngredient, filterProtein, filterStatus, filterSeason, user]);

  function clearAllFilters() {
    setSearchQuery("");
    setActiveCategory("all");
    setFilterCook("all");
    setFilterDifficulty("all");
    setFilterMaxTime("");
    setFilterSort("newest");
    setFilterIngredient("");
    setFilterProtein("all");
    setFilterStatus("all");
    setFilterSeason("all");
  }

  const selectClasses =
    "w-full rounded-lg border border-gold-light bg-warm-white px-3 py-2.5 font-sans text-sm text-charcoal outline-none focus:border-terracotta/50 focus:ring-2 focus:ring-terracotta/20 transition-colors appearance-none";

  return (
    <main className="min-h-screen bg-cream">
      {/* Header */}
      <section className="border-b border-cream-dark/30 bg-warm-white px-4 pb-10 pt-16 text-center sm:px-6 lg:px-8">
        <h1 className="font-serif text-4xl font-bold tracking-tight text-charcoal sm:text-5xl">
          Our Recipes
        </h1>
        <p className="mx-auto mt-3 max-w-lg font-sans text-lg text-slate">
          Every dish tells a family story
        </p>
        <a
          href="/the-kookbook.pdf"
          download
          className="group mt-5 inline-flex items-center gap-4 rounded-xl bg-terracotta/10 px-5 py-3 transition-colors hover:bg-terracotta/20"
        >
          <img
            src="/kookbook-cover.png"
            alt="The Kookbook cover"
            className="h-14 w-auto rounded shadow-sm"
          />
          <div className="text-left">
            <p className="font-sans text-sm font-semibold text-terracotta">
              The Original Kookbook
            </p>
            <p className="flex items-center gap-1.5 font-sans text-xs text-slate group-hover:text-terracotta">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
                <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
              </svg>
              Download PDF
            </p>
          </div>
        </a>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Search bar + filter toggle */}
        <div className="mx-auto max-w-xl">
          <div className="relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate/50"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
                clipRule="evenodd"
              />
            </svg>
            <input
              type="text"
              placeholder="Search recipes, ingredients, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full rounded-full border border-cream-dark/40 bg-warm-white py-3 pl-12 font-sans text-sm text-charcoal shadow-sm outline-none transition-all placeholder:text-slate/50 focus:border-terracotta/50 focus:ring-2 focus:ring-terracotta/20 ${searchQuery || activeFilterCount > 0 ? "pr-24" : "pr-14"}`}
            />
            {(searchQuery || activeFilterCount > 0) && (
              <button
                onClick={clearAllFilters}
                className="absolute right-12 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-full px-2 py-1 font-sans text-[10px] font-medium text-slate/60 hover:text-charcoal hover:bg-cream-dark/30 transition-colors cursor-pointer"
                title="Clear all"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
                Clear
              </button>
            )}
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-full px-3 py-1.5 font-sans text-xs font-medium transition-colors cursor-pointer ${
                filtersOpen || activeFilterCount > 0
                  ? "bg-terracotta text-white"
                  : "bg-cream-dark/30 text-slate hover:bg-cream-dark/50"
              }`}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" clipRule="evenodd" />
              </svg>
              {activeFilterCount > 0 ? activeFilterCount : ""}
            </button>
          </div>
        </div>

        {/* Filter panel */}
        {filtersOpen && (
          <div className="mx-auto mt-4 max-w-xl rounded-xl bg-white p-5 shadow-sm ring-1 ring-charcoal/5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Category / Type */}
              <div>
                <label className="mb-1.5 block font-sans text-xs font-medium text-charcoal">
                  Category
                </label>
                <select
                  value={activeCategory}
                  onChange={(e) => setActiveCategory(e.target.value)}
                  className={selectClasses}
                >
                  <option value="all">All categories</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat.slug} value={cat.slug}>
                      {cat.name}{categoryCounts[cat.slug] ? ` (${categoryCounts[cat.slug]})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cook / Contributor */}
              <div>
                <label className="mb-1.5 block font-sans text-xs font-medium text-charcoal">
                  Cook
                </label>
                <select
                  value={filterCook}
                  onChange={(e) => setFilterCook(e.target.value)}
                  className={selectClasses}
                >
                  <option value="all">All cooks</option>
                  {contributors.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Difficulty */}
              <div>
                <label className="mb-1.5 block font-sans text-xs font-medium text-charcoal">
                  Difficulty
                </label>
                <select
                  value={filterDifficulty}
                  onChange={(e) => setFilterDifficulty(e.target.value as Difficulty | "all")}
                  className={selectClasses}
                >
                  <option value="all">Any difficulty</option>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>

              {/* Protein */}
              <div>
                <label className="mb-1.5 block font-sans text-xs font-medium text-charcoal">
                  Protein
                </label>
                <select
                  value={filterProtein}
                  onChange={(e) => setFilterProtein(e.target.value as Protein | "all")}
                  className={selectClasses}
                >
                  <option value="all">Any protein</option>
                  <option value="beef">Beef</option>
                  <option value="poultry">Poultry</option>
                  <option value="lamb">Lamb</option>
                  <option value="pork">Pork</option>
                  <option value="seafood">Seafood</option>
                  <option value="eggs">Eggs</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="vegan">Vegan</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>

              {/* Ingredient */}
              <div>
                <label className="mb-1.5 block font-sans text-xs font-medium text-charcoal">
                  Ingredient
                </label>
                <input
                  type="text"
                  value={filterIngredient}
                  onChange={(e) => setFilterIngredient(e.target.value)}
                  placeholder="e.g. chicken, garlic, butter"
                  className={selectClasses}
                />
              </div>

              {/* Max total time */}
              <div>
                <label className="mb-1.5 block font-sans text-xs font-medium text-charcoal">
                  Max total time
                </label>
                <select
                  value={filterMaxTime}
                  onChange={(e) => setFilterMaxTime(e.target.value === "" ? "" : Number(e.target.value))}
                  className={selectClasses}
                >
                  <option value="">Any time</option>
                  <option value="15">Under 15 min</option>
                  <option value="30">Under 30 min</option>
                  <option value="45">Under 45 min</option>
                  <option value="60">Under 1 hour</option>
                  <option value="90">Under 1.5 hours</option>
                  <option value="120">Under 2 hours</option>
                </select>
              </div>

              {/* Sort */}
              <div>
                <label className="mb-1.5 block font-sans text-xs font-medium text-charcoal">
                  Sort by
                </label>
                <select
                  value={filterSort}
                  onChange={(e) => setFilterSort(e.target.value as SortOption)}
                  className={selectClasses}
                >
                  <option value="newest">Newest first</option>
                  <option value="quickest">Quickest first</option>
                  <option value="longest">Longest first</option>
                  <option value="az">A &ndash; Z</option>
                </select>
              </div>

              {/* My Status */}
              {user && (
                <div>
                  <label className="mb-1.5 block font-sans text-xs font-medium text-charcoal">
                    My status
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as "all" | "must-try" | "tried" | "not-tried")}
                    className={selectClasses}
                  >
                    <option value="all">All recipes</option>
                    <option value="must-try">My must-try list</option>
                    <option value="tried">Recipes I&apos;ve tried</option>
                    <option value="not-tried">Not tried yet</option>
                  </select>
                </div>
              )}

              {/* Season */}
              <div>
                <label className="mb-1.5 block font-sans text-xs font-medium text-charcoal">
                  Season
                </label>
                <select
                  value={filterSeason}
                  onChange={(e) => setFilterSeason(e.target.value as Season | "all")}
                  className={selectClasses}
                >
                  <option value="all">Any season</option>
                  {SEASONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="mt-4 font-sans text-xs font-medium text-terracotta hover:text-terracotta-dark transition-colors cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Category filter pills */}
        <div className="mt-8 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setActiveCategory("all")}
            className={`shrink-0 rounded-full px-4 py-2 font-sans text-sm font-medium transition-all ${
              activeCategory === "all"
                ? "bg-terracotta text-white shadow-sm"
                : "bg-warm-white text-slate ring-1 ring-cream-dark/40 hover:bg-cream-dark/20 hover:text-charcoal"
            }`}
          >
            All{allRecipes.length > 0 && (
              <span className={`ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 text-xs ${
                activeCategory === "all"
                  ? "bg-white/20 text-white"
                  : "bg-cream-dark/30 text-slate"
              }`}>
                {allRecipes.length}
              </span>
            )}
          </button>
          {CATEGORIES.map((cat) => {
            const count = categoryCounts[cat.slug] || 0;
            return (
              <button
                key={cat.slug}
                onClick={() => setActiveCategory(cat.slug)}
                className={`shrink-0 rounded-full px-4 py-2 font-sans text-sm font-medium transition-all ${
                  activeCategory === cat.slug
                    ? "bg-terracotta text-white shadow-sm"
                    : "bg-warm-white text-slate ring-1 ring-cream-dark/40 hover:bg-cream-dark/20 hover:text-charcoal"
                }`}
              >
                {cat.name}
                {count > 0 && (
                  <span className={`ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 text-xs ${
                    activeCategory === cat.slug
                      ? "bg-white/20 text-white"
                      : "bg-cream-dark/30 text-slate"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cream-dark border-t-terracotta" />
          </div>
        ) : (
          <>
            {/* Recipe count */}
            <p className="mt-6 font-sans text-sm text-slate">
              Showing {filteredRecipes.length}{" "}
              {filteredRecipes.length === 1 ? "recipe" : "recipes"}
            </p>

            {/* Recipe grid */}
            {filteredRecipes.length > 0 ? (
              <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredRecipes.map((recipe) => (
                  <RecipeCard key={recipe.id} recipe={recipe} />
                ))}
              </div>
            ) : (
              <div className="mt-16 flex flex-col items-center gap-4 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-cream-dark/20">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-10 w-10 text-slate/40"
                  >
                    <path d="m21 21-5.197-5.197M15.803 15.803A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                </div>
                <h3 className="font-serif text-xl font-semibold text-charcoal">
                  No recipes found
                </h3>
                <p className="max-w-sm font-sans text-sm text-slate">
                  We couldn&apos;t find any recipes matching your search. Try
                  different keywords or clear your filters.
                </p>
                <button
                  onClick={clearAllFilters}
                  className="mt-2 rounded-full bg-terracotta px-6 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-terracotta-dark cursor-pointer"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function RecipesPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-cream">
          <section className="border-b border-cream-dark/30 bg-warm-white px-4 pb-10 pt-16 text-center sm:px-6 lg:px-8">
            <h1 className="font-serif text-4xl font-bold tracking-tight text-charcoal sm:text-5xl">
              Our Recipes
            </h1>
            <p className="mx-auto mt-3 max-w-lg font-sans text-lg text-slate">
              Every dish tells a family story
            </p>
          </section>
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cream-dark border-t-terracotta" />
            </div>
          </div>
        </main>
      }
    >
      <RecipesContent />
    </Suspense>
  );
}
