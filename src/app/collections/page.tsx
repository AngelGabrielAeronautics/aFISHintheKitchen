"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getAllCollections, getAllRecipes, addCollection } from "@/lib/firebase-recipes";
import type { RecipeCollection, Recipe } from "@/lib/types";

export default function CollectionsPage() {
  const { user } = useAuth();
  const [collections, setCollections] = useState<RecipeCollection[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>([]);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const [cols, recs] = await Promise.all([getAllCollections(), getAllRecipes()]);
      setCollections(cols);
      setRecipes(recs);
      setLoading(false);
    }
    load();
  }, []);

  const recipeMap = useMemo(() => {
    const map = new Map<string, Recipe>();
    recipes.forEach((r) => map.set(r.id, r));
    return map;
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    const sorted = [...recipes].sort((a, b) => a.title.localeCompare(b.title));
    if (!recipeSearch.trim()) return sorted;
    const lower = recipeSearch.toLowerCase();
    return sorted.filter(
      (r) =>
        r.title.toLowerCase().includes(lower) ||
        r.tags.some((t) => t.toLowerCase().includes(lower))
    );
  }, [recipes, recipeSearch]);

  function toggleRecipe(id: string) {
    setSelectedRecipeIds((prev) =>
      prev.includes(id) ? prev.filter((rid) => rid !== id) : [...prev, id]
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setSubmitting(true);
    try {
      const newCol = await addCollection({
        name: name.trim(),
        description: description.trim(),
        createdBy: user.displayName || user.email || "Unknown",
        recipeIds: selectedRecipeIds,
      });
      setCollections((prev) => [newCol, ...prev]);
      setName("");
      setDescription("");
      setSelectedRecipeIds([]);
      setRecipeSearch("");
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  }

  function getCollectionThumbnails(col: RecipeCollection): string[] {
    const images: string[] = [];
    for (const rid of col.recipeIds) {
      if (images.length >= 4) break;
      const r = recipeMap.get(rid);
      const img = r?.images?.[0] || r?.image;
      if (img) images.push(img);
    }
    return images;
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-terracotta/30 border-t-terracotta rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-charcoal">
            Collections
          </h1>
          <p className="mt-2 font-sans text-sm text-slate">
            Curated groups of recipes for any occasion.
          </p>
        </div>
        {user && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="self-start sm:self-auto px-5 py-2.5 rounded-lg bg-terracotta text-white text-sm font-medium hover:bg-terracotta-dark transition-colors cursor-pointer"
          >
            {showForm ? "Cancel" : "Create Collection"}
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && user && (
        <form
          onSubmit={handleCreate}
          className="mb-10 rounded-xl bg-white p-6 shadow-sm ring-1 ring-charcoal/5"
        >
          <h2 className="font-serif text-xl font-bold text-charcoal mb-4">
            New Collection
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 mb-4">
            <div>
              <label className="block font-sans text-sm font-medium text-charcoal mb-1">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Weeknight Dinners"
                className="w-full rounded-lg border border-cream-dark/60 bg-cream/40 px-3 py-2 text-sm text-charcoal placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              />
            </div>
            <div>
              <label className="block font-sans text-sm font-medium text-charcoal mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A short description"
                className="w-full rounded-lg border border-cream-dark/60 bg-cream/40 px-3 py-2 text-sm text-charcoal placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              />
            </div>
          </div>

          {/* Recipe picker */}
          <div className="mb-4">
            <label className="block font-sans text-sm font-medium text-charcoal mb-1">
              Add Recipes ({selectedRecipeIds.length} selected)
            </label>
            <input
              type="text"
              value={recipeSearch}
              onChange={(e) => setRecipeSearch(e.target.value)}
              placeholder="Search recipes..."
              className="w-full rounded-lg border border-cream-dark/60 bg-cream/40 px-3 py-2 text-sm text-charcoal placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-terracotta/30 mb-2"
            />
            <div className="max-h-52 overflow-y-auto rounded-lg border border-cream-dark/40 bg-cream/20">
              {filteredRecipes.length === 0 && (
                <p className="px-3 py-4 text-center text-sm text-slate">
                  No recipes found.
                </p>
              )}
              {filteredRecipes.map((r) => (
                <label
                  key={r.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-cream-dark/20 transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedRecipeIds.includes(r.id)}
                    onChange={() => toggleRecipe(r.id)}
                    className="h-4 w-4 rounded border-cream-dark text-terracotta focus:ring-terracotta/30 cursor-pointer"
                  />
                  <span className="font-sans text-sm text-charcoal flex-1 truncate">
                    {r.title}
                  </span>
                  <span className="font-sans text-xs text-slate">
                    {r.contributedBy}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="px-5 py-2.5 rounded-lg bg-terracotta text-white text-sm font-medium hover:bg-terracotta-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? "Creating..." : "Create Collection"}
          </button>
        </form>
      )}

      {/* Collections grid */}
      {collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-16 w-16 text-cream-dark mb-4"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M2 8h20" />
            <path d="M9 4v4" />
            <path d="M15 4v4" />
          </svg>
          <h2 className="font-serif text-xl font-bold text-charcoal mb-2">
            No collections yet
          </h2>
          <p className="font-sans text-sm text-slate max-w-sm">
            Collections let you group recipes together for meal planning, holidays,
            or just your favourites. Sign in to create the first one.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((col) => {
            const thumbs = getCollectionThumbnails(col);
            return (
              <Link
                key={col.id}
                href={`/collections/${col.id}`}
                className="group block rounded-xl bg-white shadow-sm ring-1 ring-charcoal/5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              >
                {/* Image mosaic */}
                <div className="relative aspect-[16/9] overflow-hidden rounded-t-xl bg-gradient-to-br from-terracotta-light/30 via-gold-light/20 to-sage-light/30">
                  {thumbs.length >= 4 ? (
                    <div className="grid grid-cols-2 grid-rows-2 h-full w-full">
                      {thumbs.slice(0, 4).map((src, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={src}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ))}
                    </div>
                  ) : thumbs.length >= 2 ? (
                    <div className="grid grid-cols-2 h-full w-full">
                      {thumbs.slice(0, 2).map((src, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={src}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ))}
                    </div>
                  ) : thumbs.length === 1 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbs[0]}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full w-full">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-12 w-12 text-terracotta/20"
                      >
                        <rect x="2" y="4" width="20" height="16" rx="2" />
                        <path d="M2 8h20" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="p-5">
                  <h3 className="font-serif text-lg font-bold text-charcoal transition-colors group-hover:text-terracotta">
                    {col.name}
                  </h3>
                  {col.description && (
                    <p className="mt-1 font-sans text-sm text-slate line-clamp-2">
                      {col.description}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-3 font-sans text-xs text-slate border-t border-cream-dark/40 pt-3">
                    <span>
                      {col.recipeIds.length}{" "}
                      {col.recipeIds.length === 1 ? "recipe" : "recipes"}
                    </span>
                    <span className="text-cream-dark">|</span>
                    <span>by {col.createdBy}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
