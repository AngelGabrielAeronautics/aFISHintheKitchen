"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { getAllRecipes } from "@/lib/firebase-recipes";
import type { Recipe } from "@/lib/types";
import Avatar from "@/components/Avatar";

type ViewMode = "by-recipe" | "combined";

function ShoppingListContent() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const preselectedIds = searchParams.get("recipes")?.split(",").filter(Boolean) ?? [];

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("shoppingListIds");
      const savedSet = saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
      // Merge with any URL params
      for (const id of preselectedIds) savedSet.add(id);
      return savedSet;
    } catch { return new Set<string>(preselectedIds); }
  });
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("shoppingListChecked");
      return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
    } catch { return new Set<string>(); }
  });
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return (localStorage.getItem("shoppingListView") as ViewMode) || "by-recipe";
    } catch { return "by-recipe"; }
  });
  const [listGenerated, setListGenerated] = useState(() => {
    try {
      return localStorage.getItem("shoppingListGenerated") === "true" || preselectedIds.length > 0;
    } catch { return preselectedIds.length > 0; }
  });
  const [copied, setCopied] = useState(false);

  // Persist state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("shoppingListIds", JSON.stringify([...selectedIds]));
      localStorage.setItem("shoppingListChecked", JSON.stringify([...checkedIngredients]));
      localStorage.setItem("shoppingListView", viewMode);
      localStorage.setItem("shoppingListGenerated", String(listGenerated));
    } catch { /* ignore */ }
  }, [selectedIds, checkedIngredients, viewMode, listGenerated]);

  useEffect(() => {
    if (!user) return;
    getAllRecipes()
      .then((all) => {
        setRecipes(all);
        // Auto-generate list if recipes were pre-selected from URL
        if (preselectedIds.length > 0) {
          setListGenerated(true);
        }
      })
      .finally(() => setLoadingRecipes(false));
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredRecipes = useMemo(() => {
    if (!search.trim()) return recipes;
    const lower = search.toLowerCase();
    return recipes.filter(
      (r) =>
        r.title.toLowerCase().includes(lower) ||
        r.contributedBy.toLowerCase().includes(lower) ||
        r.tags.some((t) => t.toLowerCase().includes(lower))
    );
  }, [recipes, search]);

  const selectedRecipes = useMemo(
    () => recipes.filter((r) => selectedIds.has(r.id)),
    [recipes, selectedIds]
  );

  // Combine ingredients across recipes, merging exact duplicates (case-insensitive)
  const combinedIngredients = useMemo(() => {
    const map = new Map<string, { display: string; recipes: string[] }>();
    for (const recipe of selectedRecipes) {
      for (const ing of recipe.ingredients) {
        const key = ing.toLowerCase().trim();
        const existing = map.get(key);
        if (existing) {
          existing.recipes.push(recipe.title);
        } else {
          map.set(key, { display: ing, recipes: [recipe.title] });
        }
      }
    }
    return Array.from(map.values());
  }, [selectedRecipes]);

  function toggleRecipe(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleIngredient(key: string) {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function handleGenerate() {
    if (selectedIds.size === 0) return;
    setCheckedIngredients(new Set());
    setListGenerated(true);
  }

  function handleClear() {
    if (!confirm("Clear all selections and start over?")) return;
    setSelectedIds(new Set());
    setCheckedIngredients(new Set());
    setListGenerated(false);
    setViewMode("by-recipe");
    try {
      localStorage.removeItem("shoppingListIds");
      localStorage.removeItem("shoppingListChecked");
      localStorage.removeItem("shoppingListView");
      localStorage.removeItem("shoppingListGenerated");
    } catch { /* ignore */ }
  }

  function handleCopyList() {
    let text = "";
    if (viewMode === "by-recipe") {
      for (const recipe of selectedRecipes) {
        text += `${recipe.title}\n`;
        for (const ing of recipe.ingredients) {
          const key = `${recipe.id}::${ing}`;
          const checked = checkedIngredients.has(key);
          text += `  ${checked ? "[x]" : "[ ]"} ${ing}\n`;
        }
        text += "\n";
      }
    } else {
      text += "Combined Shopping List\n\n";
      for (const item of combinedIngredients) {
        const checked = checkedIngredients.has(`combined::${item.display}`);
        text += `${checked ? "[x]" : "[ ]"} ${item.display}`;
        if (item.recipes.length > 1) {
          text += ` (${item.recipes.join(", ")})`;
        }
        text += "\n";
      }
    }
    navigator.clipboard.writeText(text.trim()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // --- Auth loading state ---
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
              Sign in to use the shopping list
            </h2>
            <p className="text-slate mb-8">
              You need to be signed in to create a shopping list.
            </p>
            <Link
              href="/auth"
              className="inline-block w-full bg-terracotta text-white font-medium py-3 rounded-lg hover:bg-terracotta-dark transition-colors text-center"
            >
              Sign in or create an account
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream py-8 sm:py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="font-serif text-3xl sm:text-4xl text-charcoal font-semibold">
            Shopping List
          </h1>
          <p className="text-slate mt-2">
            Select recipes you want to cook, then generate a combined shopping
            list.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Left column: recipe selector */}
          <div className="lg:w-[400px] shrink-0">
            <div className="bg-warm-white rounded-2xl border border-gold-light/50 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-lg text-charcoal font-semibold">
                  Choose Recipes
                </h2>
                <span className="text-sm text-slate">
                  {selectedIds.size} recipe{selectedIds.size !== 1 ? "s" : ""}{" "}
                  selected
                </span>
              </div>

              {/* Search */}
              <div className="relative mb-4">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate/50"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Search recipes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gold-light bg-cream text-charcoal placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-terracotta focus:border-terracotta text-sm transition-colors"
                />
              </div>

              {/* Recipe list */}
              {loadingRecipes ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-cream-dark border-t-terracotta" />
                </div>
              ) : filteredRecipes.length === 0 ? (
                <p className="text-sm text-slate text-center py-8">
                  {search
                    ? "No recipes match your search."
                    : "No recipes found."}
                </p>
              ) : (
                <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1 -mr-1">
                  {filteredRecipes.map((recipe) => {
                    const isSelected = selectedIds.has(recipe.id);
                    return (
                      <button
                        key={recipe.id}
                        type="button"
                        onClick={() => toggleRecipe(recipe.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-terracotta/10 border border-terracotta/30"
                            : "hover:bg-cream-dark/40 border border-transparent"
                        }`}
                      >
                        {/* Checkbox */}
                        <span
                          className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? "bg-terracotta border-terracotta"
                              : "border-slate/30 bg-white"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              className="w-3 h-3 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={3}
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M4.5 12.75l6 6 9-13.5"
                              />
                            </svg>
                          )}
                        </span>

                        {/* Avatar */}
                        <Avatar name={recipe.contributedBy} size="sm" ring />

                        {/* Title & contributor */}
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm font-medium truncate ${
                              isSelected ? "text-charcoal" : "text-charcoal/80"
                            }`}
                          >
                            {recipe.title}
                          </p>
                          <p className="text-xs text-slate truncate">
                            {recipe.contributedBy}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Generate button */}
              <div className="mt-5 pt-4 border-t border-gold-light/50">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={selectedIds.size === 0}
                  className="w-full bg-terracotta text-white font-medium py-3 rounded-lg hover:bg-terracotta-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Generate Shopping List
                </button>
              </div>
            </div>
          </div>

          {/* Right column: shopping list */}
          <div className="flex-1 min-w-0">
            {!listGenerated ? (
              <div className="bg-warm-white rounded-2xl border border-gold-light/50 shadow-sm p-8 sm:p-12 text-center">
                <div className="w-16 h-16 bg-cream-dark/40 rounded-full flex items-center justify-center mx-auto mb-5">
                  <svg
                    className="w-8 h-8 text-slate/50"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
                    />
                  </svg>
                </div>
                <h3 className="font-serif text-xl text-charcoal mb-2">
                  No list yet
                </h3>
                <p className="text-slate text-sm max-w-sm mx-auto">
                  Select the recipes you plan to cook, then click &quot;Generate
                  Shopping List&quot; to combine all the ingredients.
                </p>
              </div>
            ) : (
              <div className="bg-warm-white rounded-2xl border border-gold-light/50 shadow-sm">
                {/* List header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-gold-light/50">
                  <h2 className="font-serif text-lg text-charcoal font-semibold">
                    Shopping List
                    <span className="text-sm font-sans font-normal text-slate ml-2">
                      ({selectedRecipes.length} recipe
                      {selectedRecipes.length !== 1 ? "s" : ""})
                    </span>
                  </h2>
                  <div className="flex items-center gap-2">
                    {/* View toggle */}
                    <div className="flex rounded-lg border border-gold-light overflow-hidden text-sm">
                      <button
                        type="button"
                        onClick={() => setViewMode("by-recipe")}
                        className={`px-3 py-1.5 transition-colors cursor-pointer ${
                          viewMode === "by-recipe"
                            ? "bg-terracotta text-white"
                            : "bg-cream text-slate hover:text-charcoal"
                        }`}
                      >
                        By Recipe
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("combined")}
                        className={`px-3 py-1.5 transition-colors cursor-pointer ${
                          viewMode === "combined"
                            ? "bg-terracotta text-white"
                            : "bg-cream text-slate hover:text-charcoal"
                        }`}
                      >
                        Combined
                      </button>
                    </div>
                  </div>
                </div>

                {/* List content */}
                <div className="p-5">
                  {viewMode === "by-recipe" ? (
                    <div className="space-y-6">
                      {selectedRecipes.map((recipe) => (
                        <div key={recipe.id}>
                          <div className="flex items-center gap-2 mb-3">
                            <Avatar
                              name={recipe.contributedBy}
                              size="sm"
                              ring
                            />
                            <h3 className="font-serif text-base text-charcoal font-semibold">
                              {recipe.title}
                            </h3>
                          </div>
                          <ul className="space-y-1.5 ml-1">
                            {recipe.ingredients.map((ing, idx) => {
                              const key = `${recipe.id}::${ing}`;
                              const isChecked =
                                checkedIngredients.has(key);
                              return (
                                <li key={idx}>
                                  <button
                                    type="button"
                                    onClick={() => toggleIngredient(key)}
                                    className="flex items-start gap-2.5 w-full text-left group cursor-pointer"
                                  >
                                    <span
                                      className={`shrink-0 mt-0.5 w-4.5 h-4.5 rounded border-2 flex items-center justify-center transition-colors ${
                                        isChecked
                                          ? "bg-sage border-sage"
                                          : "border-slate/25 bg-white group-hover:border-slate/40"
                                      }`}
                                    >
                                      {isChecked && (
                                        <svg
                                          className="w-2.5 h-2.5 text-white"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          strokeWidth={3}
                                          stroke="currentColor"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M4.5 12.75l6 6 9-13.5"
                                          />
                                        </svg>
                                      )}
                                    </span>
                                    <span
                                      className={`text-sm transition-colors ${
                                        isChecked
                                          ? "text-slate line-through"
                                          : "text-charcoal"
                                      }`}
                                    >
                                      {ing}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <ul className="space-y-1.5">
                      {combinedIngredients.map((item, idx) => {
                        const key = `combined::${item.display}`;
                        const isChecked = checkedIngredients.has(key);
                        return (
                          <li key={idx}>
                            <button
                              type="button"
                              onClick={() => toggleIngredient(key)}
                              className="flex items-start gap-2.5 w-full text-left group cursor-pointer"
                            >
                              <span
                                className={`shrink-0 mt-0.5 w-4.5 h-4.5 rounded border-2 flex items-center justify-center transition-colors ${
                                  isChecked
                                    ? "bg-sage border-sage"
                                    : "border-slate/25 bg-white group-hover:border-slate/40"
                                }`}
                              >
                                {isChecked && (
                                  <svg
                                    className="w-2.5 h-2.5 text-white"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={3}
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M4.5 12.75l6 6 9-13.5"
                                    />
                                  </svg>
                                )}
                              </span>
                              <span className="flex-1 min-w-0">
                                <span
                                  className={`text-sm transition-colors ${
                                    isChecked
                                      ? "text-slate line-through"
                                      : "text-charcoal"
                                  }`}
                                >
                                  {item.display}
                                </span>
                                {item.recipes.length > 1 && (
                                  <span className="block text-xs text-slate/70 mt-0.5">
                                    Used in: {item.recipes.join(", ")}
                                  </span>
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* List footer */}
                <div className="flex flex-wrap items-center gap-3 p-5 border-t border-gold-light/50">
                  <button
                    type="button"
                    onClick={handleCopyList}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-charcoal text-white text-sm font-medium hover:bg-charcoal/85 transition-colors cursor-pointer"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                      />
                    </svg>
                    {copied ? "Copied!" : "Copy list"}
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-4 py-2 rounded-lg border border-gold-light text-slate text-sm font-medium hover:text-charcoal hover:bg-cream-dark/40 transition-colors cursor-pointer"
                  >
                    Clear all
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ShoppingListPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-cream">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cream-dark border-t-terracotta" />
      </main>
    }>
      <ShoppingListContent />
    </Suspense>
  );
}
