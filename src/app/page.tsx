"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CATEGORIES, type Recipe } from "@/lib/types";
import { getFeaturedRecipes } from "@/lib/firebase-recipes";
import RecipeCard from "@/components/RecipeCard";
import CategoryIcon from "@/components/CategoryIcon";

export default function HomePage() {
  const [featuredRecipes, setFeaturedRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFeaturedRecipes()
      .then(setFeaturedRecipes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      {/* Hero Section */}
      <section className="relative isolate overflow-hidden -mt-[72px] pt-[72px] py-32 md:py-48">
        {/* Background image */}
        <Image
          src="/hero.jpg"
          alt=""
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

      {/* Featured Recipes */}
      <section className="bg-cream py-20 md:py-28">
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
      <section className="bg-warm-white py-20 md:py-28">
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
      <section className="bg-cream-dark py-20 md:py-28">
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
