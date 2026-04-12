"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { RECIPES } from "@/lib/seed-data";
import { seedRecipes, getRecipeCount } from "@/lib/firebase-recipes";
import { useAuth } from "@/context/AuthContext";

export default function SeedPage() {
  const { user, loading: authLoading } = useAuth();
  const [recipeCount, setRecipeCount] = useState<number | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchCount() {
      try {
        const count = await getRecipeCount();
        setRecipeCount(count);
      } catch {
        setError("Failed to fetch recipe count from Firestore.");
      }
    }
    if (!authLoading) {
      fetchCount();
    }
  }, [authLoading]);

  async function handleSeed() {
    setSeeding(true);
    setError("");
    setSuccess(false);

    try {
      await seedRecipes(RECIPES);
      setSuccess(true);
      const count = await getRecipeCount();
      setRecipeCount(count);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unknown error occurred.";
      setError(`Seeding failed: ${message}`);
    } finally {
      setSeeding(false);
    }
  }

  if (authLoading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-cream px-4 py-12">
      <div className="mx-auto max-w-lg">
        <Link
          href="/"
          className="mb-8 inline-block font-sans text-sm font-medium text-terracotta hover:text-terracotta-dark transition-colors"
        >
          &larr; Back to home
        </Link>

        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="mb-6 font-serif text-3xl font-bold text-charcoal">
            Seed Database
          </h1>

          {/* Stats */}
          <div className="mb-6 space-y-2 font-sans text-sm text-slate">
            <p>
              Recipes in Firestore:{" "}
              <span className="font-semibold text-charcoal">
                {recipeCount !== null ? recipeCount : "..."}
              </span>
            </p>
            <p>
              Seed recipes available:{" "}
              <span className="font-semibold text-charcoal">
                {RECIPES.length}
              </span>
            </p>
          </div>

          {/* Warning */}
          {recipeCount !== null && recipeCount > 0 && !success && (
            <div className="mb-6 rounded-lg border border-gold-light bg-gold-light/10 px-4 py-3 font-sans text-sm text-charcoal">
              There are already {recipeCount} recipes in the database. Seeding
              will overwrite any existing seed recipes.
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-lg border border-terracotta-light/30 bg-terracotta-light/10 px-4 py-3 font-sans text-sm text-terracotta-dark">
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="mb-6 rounded-lg border border-sage/30 bg-sage/10 px-4 py-3 font-sans text-sm text-charcoal">
              <p className="font-medium">
                Successfully seeded {RECIPES.length} recipes.
              </p>
              <Link
                href="/recipes"
                className="mt-2 inline-block font-medium text-terracotta hover:text-terracotta-dark transition-colors"
              >
                View recipes &rarr;
              </Link>
            </div>
          )}

          {/* Seed button */}
          <button
            type="button"
            onClick={handleSeed}
            disabled={seeding}
            className="w-full rounded-lg bg-terracotta px-4 py-3 font-sans text-sm font-semibold text-white transition-colors hover:bg-terracotta-dark focus:outline-none focus:ring-2 focus:ring-terracotta/50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {seeding ? "Seeding..." : "Seed Database"}
          </button>
        </div>
      </div>
    </div>
  );
}
