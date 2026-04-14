"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  getAllCollections,
  getAllRecipes,
  updateCollection,
  deleteCollection,
} from "@/lib/firebase-recipes";
import type { RecipeCollection, Recipe } from "@/lib/types";
import RecipeCard from "@/components/RecipeCard";

export default function CollectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [collection, setCollection] = useState<RecipeCollection | null>(null);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editRecipeIds, setEditRecipeIds] = useState<string[]>([]);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const collectionId = params.id as string;

  useEffect(() => {
    async function load() {
      const [cols, recs] = await Promise.all([
        getAllCollections(),
        getAllRecipes(),
      ]);
      const found = cols.find((c) => c.id === collectionId);
      if (!found) {
        setNotFound(true);
      } else {
        setCollection(found);
      }
      setAllRecipes(recs);
      setLoading(false);
    }
    load();
  }, [collectionId]);

  const recipeMap = useMemo(() => {
    const map = new Map<string, Recipe>();
    allRecipes.forEach((r) => map.set(r.id, r));
    return map;
  }, [allRecipes]);

  const collectionRecipes = useMemo(() => {
    if (!collection) return [];
    return collection.recipeIds
      .map((id) => recipeMap.get(id))
      .filter(Boolean) as Recipe[];
  }, [collection, recipeMap]);

  const filteredRecipes = useMemo(() => {
    if (!recipeSearch.trim()) return allRecipes;
    const lower = recipeSearch.toLowerCase();
    return allRecipes.filter(
      (r) =>
        r.title.toLowerCase().includes(lower) ||
        r.tags.some((t) => t.toLowerCase().includes(lower))
    );
  }, [allRecipes, recipeSearch]);

  const startEdit = useCallback(() => {
    if (!collection) return;
    setEditName(collection.name);
    setEditDesc(collection.description);
    setEditRecipeIds([...collection.recipeIds]);
    setRecipeSearch("");
    setEditing(true);
  }, [collection]);

  function toggleEditRecipe(id: string) {
    setEditRecipeIds((prev) =>
      prev.includes(id) ? prev.filter((rid) => rid !== id) : [...prev, id]
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!collection || !editName.trim()) return;
    setSaving(true);
    try {
      await updateCollection(collection.id, {
        name: editName.trim(),
        description: editDesc.trim(),
        recipeIds: editRecipeIds,
      });
      setCollection({
        ...collection,
        name: editName.trim(),
        description: editDesc.trim(),
        recipeIds: editRecipeIds,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!collection) return;
    setDeleting(true);
    try {
      await deleteCollection(collection.id);
      router.push("/collections");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-terracotta/30 border-t-terracotta rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-center">
        <h1 className="font-serif text-2xl font-bold text-charcoal mb-2">
          Collection not found
        </h1>
        <p className="font-sans text-sm text-slate mb-6">
          This collection may have been deleted.
        </p>
        <Link
          href="/collections"
          className="text-sm font-medium text-terracotta hover:text-terracotta-dark transition-colors"
        >
          Back to Collections
        </Link>
      </main>
    );
  }

  if (!collection) return null;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Back link */}
      <Link
        href="/collections"
        className="inline-flex items-center gap-1.5 font-sans text-sm text-slate hover:text-terracotta transition-colors mb-6"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
        >
          <path
            fillRule="evenodd"
            d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
            clipRule="evenodd"
          />
        </svg>
        All Collections
      </Link>

      {/* Editing mode */}
      {editing ? (
        <form
          onSubmit={handleSave}
          className="mb-10 rounded-xl bg-white p-6 shadow-sm ring-1 ring-charcoal/5"
        >
          <h2 className="font-serif text-xl font-bold text-charcoal mb-4">
            Edit Collection
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 mb-4">
            <div>
              <label className="block font-sans text-sm font-medium text-charcoal mb-1">
                Name
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="w-full rounded-lg border border-cream-dark/60 bg-cream/40 px-3 py-2 text-sm text-charcoal placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              />
            </div>
            <div>
              <label className="block font-sans text-sm font-medium text-charcoal mb-1">
                Description
              </label>
              <input
                type="text"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full rounded-lg border border-cream-dark/60 bg-cream/40 px-3 py-2 text-sm text-charcoal placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              />
            </div>
          </div>

          {/* Recipe picker */}
          <div className="mb-4">
            <label className="block font-sans text-sm font-medium text-charcoal mb-1">
              Recipes ({editRecipeIds.length} selected)
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
                    checked={editRecipeIds.includes(r.id)}
                    onChange={() => toggleEditRecipe(r.id)}
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

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving || !editName.trim()}
              className="px-5 py-2.5 rounded-lg bg-terracotta text-white text-sm font-medium hover:bg-terracotta-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-5 py-2.5 rounded-lg bg-cream-dark/40 text-charcoal text-sm font-medium hover:bg-cream-dark/60 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          {/* Collection header */}
          <div className="mb-8">
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-charcoal">
              {collection.name}
            </h1>
            {collection.description && (
              <p className="mt-2 font-sans text-sm text-slate">
                {collection.description}
              </p>
            )}
            <div className="mt-3 flex items-center gap-3 font-sans text-xs text-slate">
              <span>
                {collection.recipeIds.length}{" "}
                {collection.recipeIds.length === 1 ? "recipe" : "recipes"}
              </span>
              <span className="text-cream-dark">|</span>
              <span>by {collection.createdBy}</span>
            </div>

            {user && (
              <div className="mt-4 flex gap-3">
                <button
                  onClick={startEdit}
                  className="px-4 py-2 rounded-lg bg-cream-dark/40 text-charcoal text-sm font-medium hover:bg-cream-dark/60 transition-colors cursor-pointer"
                >
                  Edit Collection
                </button>
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate">Are you sure?</span>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {deleting ? "Deleting..." : "Yes, delete"}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="px-4 py-2 rounded-lg bg-cream-dark/40 text-charcoal text-sm font-medium hover:bg-cream-dark/60 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition-colors cursor-pointer"
                  >
                    Delete Collection
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Recipe grid */}
      {!editing && (
        <>
          {collectionRecipes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="font-sans text-sm text-slate">
                This collection has no recipes yet.
              </p>
              {user && (
                <button
                  onClick={startEdit}
                  className="mt-4 px-5 py-2.5 rounded-lg bg-terracotta text-white text-sm font-medium hover:bg-terracotta-dark transition-colors cursor-pointer"
                >
                  Add Recipes
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {collectionRecipes.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
