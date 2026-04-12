"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getRecipeBySlug } from "@/lib/firebase-recipes";
import { getCategoryBySlug, formatTime } from "@/lib/types";
import type { Recipe } from "@/lib/types";
import Avatar from "@/components/Avatar";
import RecipePreferences from "@/components/RecipePreferences";

export default function RecipePage() {
  const { slug } = useParams<{ slug: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;

    setLoading(true);
    getRecipeBySlug(slug)
      .then((r) => {
        if (r) {
          setRecipe(r);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => {
        setNotFound(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  useEffect(() => {
    if (recipe) {
      document.title = `${recipe.title} | A Fish in the Kitchen`;
    } else if (notFound) {
      document.title = "Recipe Not Found | A Fish in the Kitchen";
    }
  }, [recipe, notFound]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-cream-dark border-t-terracotta" />
          <p className="font-sans text-sm text-slate">Loading recipe...</p>
        </div>
      </main>
    );
  }

  if (notFound || !recipe) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="font-serif text-2xl font-bold text-charcoal">
            Recipe not found
          </h1>
          <p className="font-sans text-sm text-slate">
            The recipe you are looking for does not exist or has been removed.
          </p>
          <Link
            href="/recipes"
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-terracotta px-5 py-2.5 font-sans text-sm font-medium text-white transition-colors hover:bg-terracotta-dark"
          >
            Back to recipes
          </Link>
        </div>
      </main>
    );
  }

  const category = getCategoryBySlug(recipe.category);
  const totalTime = recipe.prepTime + recipe.cookTime;

  return (
    <main className="min-h-screen bg-cream">
      {/* Back link */}
      <div className="border-b border-cream-dark/30 bg-warm-white px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/recipes"
            className="inline-flex items-center gap-2 font-sans text-sm font-medium text-slate transition-colors hover:text-terracotta"
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
            Back to recipes
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Hero image placeholder */}
        <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-gradient-to-br from-terracotta-light/30 via-gold-light/20 to-sage-light/30 shadow-md">
          <div className="absolute inset-0 flex items-center justify-center opacity-15">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 64 64"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-32 w-32 text-terracotta sm:h-40 sm:w-40"
            >
              {/* Fork */}
              <path d="M20 8v10M16 8v6a4 4 0 0 0 4 4 4 4 0 0 0 4-4V8M20 22v34" />
              {/* Knife */}
              <path d="M44 8c0 0-4 4-4 14s4 10 4 10v24M44 8v24" />
            </svg>
          </div>

          {/* Difficulty badge */}
          <span
            className={`absolute right-4 top-4 rounded-full px-3 py-1 font-sans text-xs font-semibold shadow-sm ${
              recipe.difficulty === "Easy"
                ? "bg-sage-light text-sage-dark"
                : recipe.difficulty === "Medium"
                  ? "bg-gold-light text-charcoal"
                  : "bg-terracotta-light text-terracotta-dark"
            }`}
          >
            {recipe.difficulty}
          </span>
        </div>

        {/* Title & category */}
        <div className="mt-8">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-charcoal sm:text-4xl">
            {recipe.title}
          </h1>

          {category && (
            <Link
              href={`/recipes?category=${category.slug}`}
              className="mt-3 inline-block rounded-full bg-terracotta/10 px-4 py-1.5 font-sans text-xs font-semibold text-terracotta transition-colors hover:bg-terracotta/20"
            >
              {category.name}
            </Link>
          )}

          <p className="mt-4 font-sans text-base leading-relaxed text-slate">
            {recipe.description}
          </p>
        </div>

        {/* Contributed by & story */}
        <div className="mt-6">
          <div className="flex items-center gap-3">
            <Avatar name={recipe.contributedBy} size="lg" />
            <div>
              <p className="font-sans text-xs text-slate">Contributed by</p>
              <p className="font-sans text-base font-semibold text-charcoal">
                {recipe.contributedBy}
              </p>
            </div>
          </div>

          {recipe.story && (
            <blockquote className="mt-4 border-l-4 border-terracotta/30 bg-warm-white/60 py-4 pl-5 pr-4 rounded-r-lg">
              <p className="font-sans text-sm italic leading-relaxed text-slate/80">
                {recipe.story}
              </p>
            </blockquote>
          )}
        </div>

        {/* Family verdict */}
        <RecipePreferences
          recipeId={recipe.id}
          initialLovedBy={recipe.lovedBy ?? []}
          initialDislikedBy={recipe.dislikedBy ?? []}
        />

        {/* Info bar */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="flex flex-col items-center gap-1.5 rounded-xl bg-warm-white p-4 ring-1 ring-cream-dark/30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5 text-terracotta/70"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-sans text-xs text-slate">Prep Time</span>
            <span className="font-sans text-sm font-semibold text-charcoal">
              {formatTime(recipe.prepTime)}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1.5 rounded-xl bg-warm-white p-4 ring-1 ring-cream-dark/30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5 text-terracotta/70"
            >
              <path d="M12.556 4.43a.75.75 0 0 1 .114 1.054L8.672 10.57h5.078a.75.75 0 0 1 .6 1.2l-5.263 7.014a.75.75 0 1 1-1.2-.9L11.885 12H6.75a.75.75 0 0 1-.593-1.213l5.34-7.411a.75.75 0 0 1 1.059-.146Z" />
            </svg>
            <span className="font-sans text-xs text-slate">Cook Time</span>
            <span className="font-sans text-sm font-semibold text-charcoal">
              {formatTime(recipe.cookTime)}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1.5 rounded-xl bg-warm-white p-4 ring-1 ring-cream-dark/30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5 text-terracotta/70"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-sans text-xs text-slate">Total Time</span>
            <span className="font-sans text-sm font-semibold text-charcoal">
              {formatTime(totalTime)}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1.5 rounded-xl bg-warm-white p-4 ring-1 ring-cream-dark/30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5 text-terracotta/70"
            >
              <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 18a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.636.818.818 0 0 1-.36.98A7.465 7.465 0 0 1 14.5 16Z" />
            </svg>
            <span className="font-sans text-xs text-slate">Servings</span>
            <span className="font-sans text-sm font-semibold text-charcoal">
              {recipe.servings}
            </span>
          </div>

          <div className="col-span-2 flex flex-col items-center gap-1.5 rounded-xl bg-warm-white p-4 ring-1 ring-cream-dark/30 sm:col-span-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5 text-terracotta/70"
            >
              <path
                fillRule="evenodd"
                d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-sans text-xs text-slate">Difficulty</span>
            <span className="font-sans text-sm font-semibold text-charcoal">
              {recipe.difficulty}
            </span>
          </div>
        </div>

        {/* Two-column layout: Instructions & Ingredients */}
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Instructions (left, wider) */}
          <div className="lg:col-span-2">
            <h2 className="font-serif text-2xl font-bold text-charcoal">
              Instructions
            </h2>
            <ol className="recipe-instructions mt-6 space-y-6">
              {recipe.instructions.map((step, index) => (
                <li key={index} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-terracotta font-sans text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <p className="pt-1 font-sans text-sm leading-relaxed text-slate">
                    {step}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          {/* Ingredients (right, sidebar) */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl bg-warm-white p-6 ring-1 ring-cream-dark/30 lg:sticky lg:top-8">
              <h2 className="font-serif text-2xl font-bold text-charcoal">
                Ingredients
              </h2>
              <p className="mt-1 font-sans text-xs text-slate">
                {recipe.servings}{" "}
                {recipe.servings === 1 ? "serving" : "servings"}
              </p>
              <ul className="mt-5 space-y-3">
                {recipe.ingredients.map((ingredient, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-cream-dark/50 bg-cream/50 transition-colors hover:border-terracotta/50 hover:bg-terracotta/5">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-3 w-3 text-transparent"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                    <span className="font-sans text-sm leading-snug text-charcoal">
                      {ingredient}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Tags */}
        {recipe.tags.length > 0 && (
          <div className="mt-12 border-t border-cream-dark/30 pt-8">
            <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-slate/60">
              Tags
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {recipe.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-cream-dark/20 px-3 py-1 font-sans text-xs text-slate transition-colors hover:bg-cream-dark/40"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
