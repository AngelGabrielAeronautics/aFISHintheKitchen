"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CATEGORIES, DIFFICULTY_ICONS, type Recipe, formatTime, getCategoryBySlug } from "@/lib/types";
import { getAllRecipes } from "@/lib/firebase-recipes";
import RecipeCard from "@/components/RecipeCard";
import CategoryIcon from "@/components/CategoryIcon";
import Avatar from "@/components/Avatar";

export default function HomePage() {
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterCook, setFilterCook] = useState("all");
  const [filterDifficulty, setFilterDifficulty] = useState("all");
  const [filterProtein, setFilterProtein] = useState("all");
  const [filterIngredient, setFilterIngredient] = useState("");
  const [filterMaxTime, setFilterMaxTime] = useState("");
  const [filterSort, setFilterSort] = useState("newest");
  const [rotwIconError, setRotwIconError] = useState(false);
  const router = useRouter();

  const contributors = [...new Set(allRecipes.map(r => r.contributedBy))].sort();

  const featuredRecipes = useMemo(() => {
    const sorted = [...allRecipes].sort((a, b) => {
      const aLoves = a.lovedBy?.length ?? 0;
      const bLoves = b.lovedBy?.length ?? 0;
      if (bLoves !== aLoves) return bLoves - aLoves;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return sorted.slice(0, 6);
  }, [allRecipes]);

  const [weekNumber] = useState(() => Math.floor(
    (Date.now() - new Date("2026-01-01").getTime()) / (7 * 24 * 60 * 60 * 1000)
  ));
  const recipeOfTheWeek = useMemo(() => {
    if (allRecipes.length === 0) return null;
    const stable = [...allRecipes].sort((a, b) => a.id.localeCompare(b.id));
    const withImages = stable.filter(
      (r) => (r.images && r.images.length > 0) || r.image
    );
    const pool = withImages.length > 0 ? withImages : stable;
    return pool[Math.abs(weekNumber) % pool.length];
  }, [allRecipes, weekNumber]);

  function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    if (filterCategory !== "all") params.set("category", filterCategory);
    if (filterCook !== "all") params.set("cook", filterCook);
    if (filterDifficulty !== "all") params.set("difficulty", filterDifficulty);
    if (filterProtein !== "all") params.set("protein", filterProtein);
    if (filterIngredient.trim()) params.set("ingredient", filterIngredient.trim());
    if (filterMaxTime) params.set("maxTime", filterMaxTime);
    if (filterSort !== "newest") params.set("sort", filterSort);
    router.push(`/recipes${params.toString() ? `?${params.toString()}` : ""}`);
  }

  const activeFilterCount = [filterCategory !== "all", filterCook !== "all", filterDifficulty !== "all", filterProtein !== "all", filterIngredient.trim() !== "", filterMaxTime !== "", filterSort !== "newest"].filter(Boolean).length;

  useEffect(() => {
    getAllRecipes()
      .then((all) => setAllRecipes(all))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      {/* Hero Section */}
      <section className="relative isolate overflow-hidden -mt-[72px] pt-[150px] py-44 md:pt-[150px] md:py-56">
        {/* Background image */}
        <Image
          src="/hero.jpg"
          alt="A Fish in the Kitchen — family cookbook"
          fill
          className="object-cover"
          priority
        />
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-navy/80 via-navy/60 to-navy/30" />

        <div className="relative mx-auto max-w-6xl px-6 text-left">
          <Image
            src="/logo.png"
            alt="A Fish in the Kitchen"
            width={300}
            height={300}
            className="mb-4 w-[200px] h-[200px] md:w-[300px] md:h-[300px] object-contain"
            priority
          />

          <p className="mt-4 font-serif text-xl italic text-gold-light md:text-2xl">
            Family Recipes Worth Catching
          </p>

          <p className="mt-6 max-w-xl font-sans text-base leading-relaxed text-cream md:text-lg">
            Our family&rsquo;s favourite recipes, gathered from kitchen tables
            across generations. Passed down, written up, and now shared with you.
          </p>

          <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row">
            <Link
              href="/recipes"
              className="inline-flex items-center rounded-lg bg-terracotta px-8 py-3.5 font-sans text-sm font-semibold tracking-wide text-white shadow-md transition-colors duration-200 hover:bg-terracotta-dark"
            >
              Browse Recipes
            </Link>
            <Link
              href="/submit"
              className="inline-flex items-center rounded-lg border-2 border-cream px-8 py-3.5 font-sans text-sm font-semibold tracking-wide text-cream transition-colors duration-200 hover:bg-cream/10"
            >
              Submit a Recipe
            </Link>
          </div>
        </div>
      </section>

      {/* Search & Filter */}
      <section className="bg-cream py-8">
        <div className="mx-auto max-w-xl px-6">
          <form onSubmit={handleSearch}>
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate/50">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
              </svg>
              <input
                type="text"
                placeholder="Search recipes, ingredients, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-full border border-cream-dark/40 bg-warm-white py-3 pl-12 pr-24 font-sans text-sm text-charcoal shadow-sm outline-none transition-all placeholder:text-slate/50 focus:border-terracotta/50 focus:ring-2 focus:ring-terracotta/20"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFiltersOpen(!filtersOpen)}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 font-sans text-xs font-medium transition-colors cursor-pointer ${
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
                <button
                  type="submit"
                  className="rounded-full bg-terracotta px-3 py-1.5 font-sans text-xs font-medium text-white hover:bg-terracotta-dark transition-colors cursor-pointer"
                >
                  Go
                </button>
              </div>
            </div>
          </form>

          {filtersOpen && (
            <div className="mt-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-charcoal/5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1.5 block font-sans text-xs font-medium text-charcoal">Category</label>
                  <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full rounded-lg border border-gold-light bg-warm-white px-3 py-2.5 font-sans text-sm text-charcoal outline-none focus:border-terracotta/50 focus:ring-2 focus:ring-terracotta/20 appearance-none">
                    <option value="all">All categories</option>
                    {CATEGORIES.map((cat) => (<option key={cat.slug} value={cat.slug}>{cat.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block font-sans text-xs font-medium text-charcoal">Cook</label>
                  <select value={filterCook} onChange={(e) => setFilterCook(e.target.value)} className="w-full rounded-lg border border-gold-light bg-warm-white px-3 py-2.5 font-sans text-sm text-charcoal outline-none focus:border-terracotta/50 focus:ring-2 focus:ring-terracotta/20 appearance-none">
                    <option value="all">All cooks</option>
                    {contributors.map((name) => (<option key={name} value={name}>{name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block font-sans text-xs font-medium text-charcoal">Difficulty</label>
                  <select value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)} className="w-full rounded-lg border border-gold-light bg-warm-white px-3 py-2.5 font-sans text-sm text-charcoal outline-none focus:border-terracotta/50 focus:ring-2 focus:ring-terracotta/20 appearance-none">
                    <option value="all">Any difficulty</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block font-sans text-xs font-medium text-charcoal">Protein</label>
                  <select value={filterProtein} onChange={(e) => setFilterProtein(e.target.value)} className="w-full rounded-lg border border-gold-light bg-warm-white px-3 py-2.5 font-sans text-sm text-charcoal outline-none focus:border-terracotta/50 focus:ring-2 focus:ring-terracotta/20 appearance-none">
                    <option value="all">Any protein</option>
                    <option value="beef">Beef</option>
                    <option value="eggs">Eggs</option>
                    <option value="lamb">Lamb</option>
                    <option value="mixed">Mixed</option>
                    <option value="pork">Pork</option>
                    <option value="poultry">Poultry</option>
                    <option value="seafood">Seafood</option>
                    <option value="vegan">Vegan</option>
                    <option value="vegetarian">Vegetarian</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block font-sans text-xs font-medium text-charcoal">Ingredient</label>
                  <input type="text" value={filterIngredient} onChange={(e) => setFilterIngredient(e.target.value)} placeholder="e.g. chicken, garlic, butter" className="w-full rounded-lg border border-gold-light bg-warm-white px-3 py-2.5 font-sans text-sm text-charcoal outline-none focus:border-terracotta/50 focus:ring-2 focus:ring-terracotta/20" />
                </div>
                <div>
                  <label className="mb-1.5 block font-sans text-xs font-medium text-charcoal">Max total time</label>
                  <select value={filterMaxTime} onChange={(e) => setFilterMaxTime(e.target.value)} className="w-full rounded-lg border border-gold-light bg-warm-white px-3 py-2.5 font-sans text-sm text-charcoal outline-none focus:border-terracotta/50 focus:ring-2 focus:ring-terracotta/20 appearance-none">
                    <option value="">Any time</option>
                    <option value="15">Under 15 min</option>
                    <option value="30">Under 30 min</option>
                    <option value="45">Under 45 min</option>
                    <option value="60">Under 1 hour</option>
                    <option value="90">Under 1.5 hours</option>
                    <option value="120">Under 2 hours</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <label className="mb-1.5 block font-sans text-xs font-medium text-charcoal">Sort by</label>
                  <select value={filterSort} onChange={(e) => setFilterSort(e.target.value)} className="rounded-lg border border-gold-light bg-warm-white px-3 py-2.5 font-sans text-sm text-charcoal outline-none focus:border-terracotta/50 focus:ring-2 focus:ring-terracotta/20 appearance-none">
                    <option value="newest">Newest first</option>
                    <option value="quickest">Quickest first</option>
                    <option value="longest">Longest first</option>
                    <option value="az">A - Z</option>
                  </select>
                </div>
                <button type="button" onClick={handleSearch} className="rounded-full bg-terracotta px-6 py-2.5 font-sans text-sm font-medium text-white hover:bg-terracotta-dark transition-colors cursor-pointer">
                  Search
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Recipe of the Week */}
      {recipeOfTheWeek && (
        <section className="bg-warm-white py-10 sm:py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center mb-10">
              <h2 className="font-serif text-3xl font-bold text-charcoal md:text-4xl inline-flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 text-gold-light">
                  <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
                </svg>
                Recipe of the Week
              </h2>
              <p className="mt-3 font-sans text-base text-slate md:text-lg">
                A fresh pick every Monday
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-charcoal/5">
              <div className="flex flex-col md:flex-row">
                {/* Image */}
                {(recipeOfTheWeek.images?.[0] || recipeOfTheWeek.image) ? (
                  <div className="relative aspect-[4/3] md:aspect-auto md:w-1/2 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={recipeOfTheWeek.images?.[0] || recipeOfTheWeek.image}
                      alt={recipeOfTheWeek.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="relative aspect-[4/3] md:aspect-auto md:w-1/2 shrink-0 bg-gradient-to-br from-terracotta-light/30 via-gold-light/20 to-sage-light/30 flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 64 64"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-24 w-24 text-terracotta opacity-20"
                    >
                      <path d="M20 8v10M16 8v6a4 4 0 0 0 4 4 4 4 0 0 0 4-4V8M20 22v34" />
                      <path d="M44 8c0 0-4 4-4 14s4 10 4 10v24M44 8v24" />
                    </svg>
                  </div>
                )}

                {/* Details */}
                <div className="flex flex-col justify-center gap-4 p-6 md:p-10 md:w-1/2">
                  <h3 className="font-serif text-2xl font-bold text-charcoal md:text-3xl">
                    {recipeOfTheWeek.title}
                  </h3>

                  <p className="font-sans text-sm leading-relaxed text-slate md:text-base line-clamp-3">
                    {recipeOfTheWeek.description}
                  </p>

                  {/* Contributor */}
                  <div className="flex items-center gap-3">
                    <Avatar name={recipeOfTheWeek.contributedBy} size="md" ring />
                    <span className="font-sans text-sm font-semibold text-charcoal">
                      {recipeOfTheWeek.contributedBy}
                    </span>
                  </div>

                  {/* Icons row: difficulty, category, protein */}
                  <div className="flex items-center gap-2">
                    <Image
                      src={DIFFICULTY_ICONS[recipeOfTheWeek.difficulty]}
                      alt={recipeOfTheWeek.difficulty}
                      width={40}
                      height={40}
                      className="h-10 w-10 object-contain"
                      title={recipeOfTheWeek.difficulty}
                    />
                    {!rotwIconError && (
                      <Image
                        src={`/icons/${recipeOfTheWeek.category}.png`}
                        alt={getCategoryBySlug(recipeOfTheWeek.category)?.name || ""}
                        width={40}
                        height={40}
                        className="h-10 w-10 object-contain"
                        onError={() => setRotwIconError(true)}
                      />
                    )}
                    {recipeOfTheWeek.protein && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/icons/${recipeOfTheWeek.protein}.png`}
                        alt={recipeOfTheWeek.protein}
                        className="h-10 w-10 object-contain"
                        title={recipeOfTheWeek.protein}
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    )}
                  </div>

                  {/* Prep + Cook time */}
                  <div className="flex items-center gap-4 font-sans text-xs text-slate">
                    <div className="flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-terracotta/70">
                        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
                      </svg>
                      <span>Prep: {formatTime(recipeOfTheWeek.prepTime)}</span>
                    </div>
                    <span className="text-cream-dark">|</span>
                    <div className="flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-terracotta/70">
                        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
                      </svg>
                      <span>Cook: {formatTime(recipeOfTheWeek.cookTime)}</span>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="mt-2">
                    <Link
                      href={`/recipes/${recipeOfTheWeek.slug}`}
                      className="inline-flex items-center rounded-lg bg-terracotta px-6 py-3 font-sans text-sm font-semibold tracking-wide text-white shadow-md transition-colors duration-200 hover:bg-terracotta-dark"
                    >
                      View Recipe
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Featured Recipes */}
      <section className="bg-cream py-12 sm:py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <h2 className="font-serif text-3xl font-bold text-charcoal md:text-4xl">
              Family Favourites
            </h2>
            <p className="mt-3 font-sans text-base text-slate md:text-lg">
              The recipes everyone asks for
            </p>
          </div>

          {loading ? (
            <div className="mt-12 flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cream-dark border-t-terracotta" />
            </div>
          ) : error ? (
            <div className="mt-12 flex flex-col items-center gap-3 py-12 text-center">
              <p className="font-sans text-sm text-slate">Something went wrong loading recipes.</p>
              <button type="button" onClick={() => { setError(false); setLoading(true); getAllRecipes().then(setAllRecipes).catch(() => setError(true)).finally(() => setLoading(false)); }} className="font-sans text-sm font-medium text-terracotta hover:text-terracotta-dark transition-colors cursor-pointer">Try again</button>
            </div>
          ) : featuredRecipes.length > 0 ? (
            <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {featuredRecipes.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          ) : (
            <p className="mt-12 text-center font-sans text-slate">
              No featured recipes yet. Check back soon!
            </p>
          )}

          <div className="mt-14 text-center">
            <Link
              href="/recipes"
              className="inline-flex items-center gap-2 font-sans text-sm font-semibold text-terracotta transition-colors duration-200 hover:text-terracotta-dark"
            >
              See All Recipes
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path
                  fillRule="evenodd"
                  d="M3 10a.75.75 0 0 1 .75-.75h10.638l-3.96-3.96a.75.75 0 1 1 1.06-1.06l5.25 5.25a.75.75 0 0 1 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06l3.96-3.96H3.75A.75.75 0 0 1 3 10Z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Browse by Category */}
      <section className="bg-warm-white py-12 sm:py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <h2 className="font-serif text-3xl font-bold text-charcoal md:text-4xl">
              Browse by Category
            </h2>
            <p className="mt-3 font-sans text-base text-slate md:text-lg">
              Find exactly what you&rsquo;re in the mood for
            </p>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {CATEGORIES.map((category) => (
              <Link
                key={category.slug}
                href={`/recipes?category=${category.slug}`}
                className="group flex flex-col items-center gap-3 rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-charcoal/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:ring-terracotta/20"
              >
                <CategoryIcon slug={category.slug} emoji={category.icon} name={category.name} description={category.description} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* About / Family Story */}
      <section className="bg-cream-dark py-12 sm:py-20 md:py-28">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-serif text-3xl font-bold text-charcoal md:text-4xl">
            About This Cookbook
          </h2>

          <div className="mt-8 space-y-6 font-sans text-base leading-relaxed text-slate md:text-lg">
            <p>
              Every family has its own recipes &mdash; the ones scribbled on
              stained notecards, passed between generations, or shouted across a
              noisy kitchen. A Fish in the Kitchen is our attempt to keep them all in
              one place, so the next generation can cook them too.
            </p>
            <p>
              Started from a well-worn paper cookbook, this is now a living
              collection. Family members can add their own recipes anytime. If
              you&rsquo;ve got one worth sharing, we want it.
            </p>
          </div>

          <div className="mt-10">
            <Link
              href="/submit"
              className="inline-flex items-center rounded-lg bg-terracotta px-8 py-3.5 font-sans text-sm font-semibold tracking-wide text-white shadow-md transition-colors duration-200 hover:bg-terracotta-dark"
            >
              Submit Your Recipe
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
