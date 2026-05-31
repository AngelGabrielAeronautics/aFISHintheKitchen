"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { RECIPES } from "@/lib/seed-data";
import { KOOKBOOK_RECIPES } from "@/lib/kookbook-all";
import { MEMBERS } from "@/lib/seed-members";
import {
  seedRecipes,
  getRecipeCount,
  seedMembers,
  getMemberCount,
} from "@/lib/firebase-recipes";
import { useAuth } from "@/context/AuthContext";

export default function SeedPage() {
  const { loading: authLoading } = useAuth();
  const [recipeCount, setRecipeCount] = useState<number | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchCounts() {
      try {
        const [rc, mc] = await Promise.all([
          getRecipeCount(),
          getMemberCount(),
        ]);
        setRecipeCount(rc);
        setMemberCount(mc);
      } catch {
        setError("Failed to fetch counts from Firestore.");
      }
    }
    if (!authLoading) {
      fetchCounts();
    }
  }, [authLoading]);

  async function handleSeed() {
    setSeeding(true);
    setError("");
    setSuccess(false);

    try {
      const allRecipes = [...RECIPES, ...KOOKBOOK_RECIPES];
      await Promise.all([seedRecipes(allRecipes), seedMembers(MEMBERS)]);
      setSuccess(true);
      const [rc, mc] = await Promise.all([
        getRecipeCount(),
        getMemberCount(),
      ]);
      setRecipeCount(rc);
      setMemberCount(mc);
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
              <span className="text-slate/50"> / {RECIPES.length + KOOKBOOK_RECIPES.length} available ({KOOKBOOK_RECIPES.length} from The Kookbook)</span>
            </p>
            <p>
              Members in Firestore:{" "}
              <span className="font-semibold text-charcoal">
                {memberCount !== null ? memberCount : "..."}
              </span>
              <span className="text-slate/50"> / {MEMBERS.length} available</span>
            </p>
          </div>

          {/* Warning */}
          {recipeCount !== null && (recipeCount > 0 || (memberCount ?? 0) > 0) && !success && (
            <div className="mb-6 rounded-lg border border-gold-light bg-gold-light/10 px-4 py-3 font-sans text-sm text-charcoal">
              There is existing data in the database. Seeding will overwrite
              any existing seed data.
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 font-sans text-sm text-amber-900">
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="mb-6 rounded-lg border border-sage/30 bg-sage/10 px-4 py-3 font-sans text-sm text-charcoal">
              <p className="font-medium">
                Seeded {RECIPES.length} recipes and {MEMBERS.length} family members.
              </p>
              <div className="mt-2 flex gap-4">
                <Link
                  href="/recipes"
                  className="font-medium text-terracotta hover:text-terracotta-dark transition-colors"
                >
                  View recipes &rarr;
                </Link>
                <Link
                  href="/members"
                  className="font-medium text-terracotta hover:text-terracotta-dark transition-colors"
                >
                  View family &rarr;
                </Link>
              </div>
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
