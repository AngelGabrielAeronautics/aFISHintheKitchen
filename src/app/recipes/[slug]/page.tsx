"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getRecipeBySlug } from "@/lib/firebase-recipes";
import Toast from "@/components/Toast";
import { getCategoryBySlug, formatTime, HEAT_ICONS, HEAT_LABELS, DIFFICULTY_ICONS } from "@/lib/types";
import type { Recipe } from "@/lib/types";
import Image from "next/image";
import Avatar from "@/components/Avatar";
import RecipePreferences from "@/components/RecipePreferences";
import RecipeNotes from "@/components/RecipeNotes";
import EditHistory from "@/components/EditHistory";
import { useAuth } from "@/context/AuthContext";

export default function RecipePage() {
  const { slug } = useParams<{ slug: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const savedParam = searchParams.get("saved");
  useEffect(() => {
    if (savedParam === "1") {
      window.history.replaceState({}, "", window.location.pathname);
      const t = setTimeout(() => setShowSavedToast(true), 0);
      return () => clearTimeout(t);
    }
  }, [savedParam]);

  useEffect(() => {
    if (!slug) return;

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

  function copyIngredients() {
    const r = recipe!;
    const text = `${r.title} — Ingredients\n\n${r.ingredients.map((i) => `- ${i}`).join("\n")}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadIngredients() {
    const r = recipe!;
    const text = `${r.title} — Ingredients\n\n${r.ingredients.map((i) => `- ${i}`).join("\n")}\n\nServings: ${r.servings}`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${r.slug}-ingredients.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-cream">
      {/* Recipe images — full width */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {recipe.images && recipe.images.length > 0 ? (
          <div className="relative">
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {recipe.images.map((url, index) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={index}
                  src={url}
                  alt={`${recipe.title} — photo ${index + 1}`}
                  className="w-full shrink-0 snap-center object-cover rounded-2xl shadow-md aspect-[16/9]"
                />
              ))}
            </div>
            {recipe.images.length > 1 && (
              <div className="mt-2 flex justify-center gap-1.5">
                {recipe.images.map((_, index) => (
                  <span key={index} className="h-1.5 w-1.5 rounded-full bg-slate/30" />
                ))}
              </div>
            )}
          </div>
        ) : recipe.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.image}
            alt={recipe.title}
            className="w-full aspect-[16/9] object-cover rounded-2xl shadow-md"
          />
        ) : (
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
                <path d="M20 8v10M16 8v6a4 4 0 0 0 4 4 4 4 0 0 0 4-4V8M20 22v34" />
                <path d="M44 8c0 0-4 4-4 14s4 10 4 10v24M44 8v24" />
              </svg>
            </div>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Back + Print/Share/Edit buttons */}
        <div className="print-hide flex items-center justify-between py-4">
          <Link
            href="/recipes"
            className="inline-flex items-center gap-2 font-sans text-sm font-medium text-slate transition-colors hover:text-terracotta"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
            </svg>
            Back to recipes
          </Link>
          <div className="flex items-center gap-2">
            {/* Print */}
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate/10 px-4 py-2 font-sans text-sm font-medium text-slate transition-colors hover:bg-slate/20 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M5 2.75C5 1.784 5.784 1 6.75 1h6.5c.966 0 1.75.784 1.75 1.75v3.552c.377.046.752.097 1.126.153A2.212 2.212 0 0 1 18 8.653v4.097A2.25 2.25 0 0 1 15.75 15h-.241l.305 1.984A1.75 1.75 0 0 1 14.084 19H5.916a1.75 1.75 0 0 1-1.73-2.016L4.492 15H4.25A2.25 2.25 0 0 1 2 12.75V8.653c0-1.082.775-2.034 1.874-2.198.374-.056.75-.107 1.126-.153V2.75ZM13.5 4V2.75a.25.25 0 0 0-.25-.25h-6.5a.25.25 0 0 0-.25.25V4c1.152-.076 2.318-.115 3.5-.115s2.348.039 3.5.115ZM6.427 15l-.394 2.562a.25.25 0 0 0 .247.288h7.44a.25.25 0 0 0 .247-.288L13.573 15H6.427Zm7.406-1.5a.75.75 0 0 0 .167-.019h1.75a.75.75 0 0 0 .75-.75V8.653a.712.712 0 0 0-.603-.706c-1.36-.204-2.74-.347-4.136-.427a.75.75 0 0 0-.028-.002 67.77 67.77 0 0 0-3.466 0 .75.75 0 0 0-.028.002 62.142 62.142 0 0 0-4.136.427.712.712 0 0 0-.603.706v4.078c0 .414.336.75.75.75H6a.75.75 0 0 0 .167.019h7.666Z" clipRule="evenodd" />
              </svg>
              Print
            </button>
            {/* Share */}
            <div className="relative">
              <button
                onClick={async () => {
                  const url = window.location.href;
                  const title = recipe.title;
                  if (navigator.share) {
                    try {
                      await navigator.share({ title, url });
                    } catch {
                      // User cancelled or share failed — ignore
                    }
                  } else {
                    await navigator.clipboard.writeText(url);
                    setShareCopied(true);
                    setTimeout(() => setShareCopied(false), 2000);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-terracotta/10 px-4 py-2 font-sans text-sm font-medium text-terracotta transition-colors hover:bg-terracotta/20 cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M13 4.5a2.5 2.5 0 1 1 .702 1.737L6.97 9.604a2.518 2.518 0 0 1 0 .799l6.733 3.366a2.5 2.5 0 1 1-.671 1.341l-6.733-3.366a2.5 2.5 0 1 1 0-3.482l6.733-3.366A2.52 2.52 0 0 1 13 4.5Z" />
                </svg>
                Share
              </button>
              {shareCopied && (
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-charcoal px-2 py-1 font-sans text-xs text-white shadow-md">
                  Link copied!
                </span>
              )}
            </div>
            {/* Edit */}
            {user && (
              <Link
                href={`/recipes/${recipe.slug}/edit`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-terracotta/10 px-4 py-2 font-sans text-sm font-medium text-terracotta transition-colors hover:bg-terracotta/20"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                  <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
                </svg>
                Edit
              </Link>
            )}
          </div>
        </div>

        {/* Title & icons */}
        <div className="mt-8">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-charcoal sm:text-4xl">
            {recipe.title}
          </h1>

          {/* Icon row: Difficulty, Category, Protein, Heat */}
          <div className="mt-4 flex items-center gap-3">
            <Image
              src={DIFFICULTY_ICONS[recipe.difficulty]}
              alt={recipe.difficulty}
              width={56}
              height={56}
              className="h-14 w-14 object-contain"
              title={recipe.difficulty}
            />
            {category && (
              <Link
                href={`/recipes?category=${category.slug}`}
                className="transition-transform hover:scale-105"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/icons/${category.slug}.png`}
                  alt={category.name}
                  className="h-14 w-14 object-contain"
                  onError={(e) => {
                    const el = e.currentTarget;
                    el.style.display = "none";
                    el.parentElement!.innerHTML = `<span class="inline-block rounded-full bg-terracotta/10 px-4 py-1.5 font-sans text-xs font-semibold text-terracotta">${category.name}</span>`;
                  }}
                />
              </Link>
            )}
            {recipe.protein && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/icons/${recipe.protein}.png`}
                alt={recipe.protein}
                className="h-14 w-14 object-contain"
                title={recipe.protein}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            )}
            {recipe.heat && (
              <Image
                src={HEAT_ICONS[recipe.heat]}
                alt={HEAT_LABELS[recipe.heat]}
                width={56}
                height={56}
                className="h-14 w-14 object-contain"
                title={HEAT_LABELS[recipe.heat]}
              />
            )}
          </div>

          <p className="mt-4 font-sans text-base leading-relaxed text-slate">
            {recipe.description}
          </p>
        </div>

        {/* Contributed by & story */}
        <div className="mt-6">
          <div className="flex items-center gap-3">
            <Avatar name={recipe.contributedBy} size="xl" ring />
            <div>
              <p className="font-sans text-xs text-slate">Contributed by</p>
              <p className="font-sans text-base font-semibold text-charcoal">
                {recipe.contributedBy}
              </p>
              {recipe.versionOf && recipe.versionAuthor && (
                <p className="font-sans text-xs text-terracotta">
                  {recipe.versionAuthor}&rsquo;s version of{" "}
                  <Link href={`/recipes`} className="underline hover:text-terracotta-dark">
                    {recipe.versionOf}
                  </Link>
                </p>
              )}
              {recipe.originalSource && (
                <p className="font-sans text-xs text-slate">
                  Original recipe by <span className="font-medium text-charcoal">{recipe.originalSource}</span>
                </p>
              )}
              <p className="font-sans text-[10px] text-slate/50">
                Added {new Date(recipe.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
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

        {/* Info bar */}
        <div className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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

          {/* Seasons */}
          <div className="flex flex-col items-center gap-1.5 rounded-xl bg-warm-white p-4 ring-1 ring-cream-dark/30">
            <div className="flex flex-wrap justify-center gap-1.5">
              {[
                { value: "spring", label: "🌱", name: "Spring" },
                { value: "summer", label: "☀️", name: "Summer" },
                { value: "autumn", label: "🍂", name: "Autumn" },
                { value: "winter", label: "❄️", name: "Winter" },
              ].map((s) => (
                <span
                  key={s.value}
                  title={s.name}
                  className={`text-base ${
                    recipe.seasons?.includes(s.value as "spring" | "summer" | "autumn" | "winter")
                      ? "opacity-100"
                      : "opacity-20"
                  }`}
                >
                  {s.label}
                </span>
              ))}
            </div>
            <span className="font-sans text-xs text-slate">Season</span>
            {recipe.seasons?.includes("all-year") && (
              <span className="font-sans text-[10px] font-medium text-sage">All Year</span>
            )}
          </div>

          <div className="flex flex-col items-center gap-1.5 rounded-xl bg-warm-white p-4 ring-1 ring-cream-dark/30">
            <Image
              src={DIFFICULTY_ICONS[recipe.difficulty]}
              alt={recipe.difficulty}
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
            />
            <span className="font-sans text-xs text-slate">Difficulty</span>
            <span className="font-sans text-sm font-semibold text-charcoal">
              {recipe.difficulty}
            </span>
          </div>

          {recipe.heat && (
            <div className="flex flex-col items-center gap-1.5 rounded-xl bg-warm-white p-4 ring-1 ring-cream-dark/30">
              <Image
                src={HEAT_ICONS[recipe.heat]}
                alt={HEAT_LABELS[recipe.heat]}
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
              />
              <span className="font-sans text-xs text-slate">Heat</span>
              <span className="font-sans text-sm font-semibold text-charcoal">
                {HEAT_LABELS[recipe.heat]}
              </span>
            </div>
          )}
        </div>

        {/* Two-column layout: Instructions & Ingredients */}
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Instructions (left, wider) */}
          <div className="order-2 lg:order-1 lg:col-span-2">
            <h2 className="font-serif text-2xl font-bold text-charcoal">
              Instructions
            </h2>
            <ol className="recipe-instructions mt-6 space-y-6">
              {recipe.instructions.map((step, index) => (
                <li key={index} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-terracotta font-sans text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <div className="pt-1 flex-1">
                    <p className="font-sans text-sm leading-relaxed text-slate">
                      {step}
                    </p>
                    {recipe.instructionImages?.[String(index)] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={recipe.instructionImages[String(index)]}
                        alt={`Step ${index + 1}`}
                        className="mt-3 rounded-xl shadow-sm max-h-64 object-cover"
                      />
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Ingredients (right, sidebar) */}
          <div className="order-1 lg:order-2 lg:col-span-1">
            <div className="rounded-2xl bg-warm-white p-6 ring-1 ring-cream-dark/30 lg:sticky lg:top-8">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-serif text-2xl font-bold text-charcoal">
                    Ingredients
                  </h2>
                  <p className="mt-1 font-sans text-xs text-slate">
                    {recipe.servings}{" "}
                    {recipe.servings === 1 ? "serving" : "servings"}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={copyIngredients}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate/50 hover:bg-cream-dark/30 hover:text-charcoal transition-colors cursor-pointer"
                    title="Copy ingredients"
                  >
                    {copied ? (
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-sage">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 17 6.622V12.5a1.5 1.5 0 0 1-1.5 1.5h-1v-3.379a3 3 0 0 0-.879-2.121L10.5 5.379A3 3 0 0 0 8.379 4.5H7v-1Z" />
                        <path d="M4.5 6A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h7a1.5 1.5 0 0 0 1.5-1.5v-5.879a1.5 1.5 0 0 0-.44-1.06L9.44 6.439A1.5 1.5 0 0 0 8.378 6H4.5Z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={downloadIngredients}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate/50 hover:bg-cream-dark/30 hover:text-charcoal transition-colors cursor-pointer"
                    title="Download ingredients"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
                      <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                    </svg>
                  </button>
                </div>
              </div>
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

        {/* Video */}
        {recipe.video && (
          <div className="mt-10 print-hide">
            <h2 className="font-serif text-2xl font-bold text-charcoal mb-4">Video</h2>
            {recipe.video.includes("youtube.com") || recipe.video.includes("youtu.be") ? (
              <div className="aspect-video rounded-xl overflow-hidden shadow-md">
                <iframe
                  src={recipe.video.includes("youtu.be")
                    ? `https://www.youtube.com/embed/${recipe.video.split("/").pop()?.split("?")[0]}`
                    : `https://www.youtube.com/embed/${new URL(recipe.video).searchParams.get("v")}`
                  }
                  title={`${recipe.title} video`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
            ) : (
              <video
                src={recipe.video}
                controls
                className="w-full rounded-xl shadow-md"
                preload="metadata"
              >
                Your browser does not support video playback.
              </video>
            )}
          </div>
        )}

        {/* Family verdict */}
        <RecipePreferences
          recipeId={recipe.id}
          initialLovedBy={recipe.lovedBy ?? []}
          initialDislikedBy={recipe.dislikedBy ?? []}
          initialMustTry={recipe.mustTry ?? []}
          initialTriedBy={recipe.triedBy ?? []}
        />

        {/* Family Notes */}
        <RecipeNotes
          recipeId={recipe.id}
          initialNotes={recipe.notes ?? []}
          contributedBy={recipe.contributedBy}
        />

        {/* Start Cooking button */}
        <Link
          href={`/recipes/${recipe.slug}/cook`}
          className="print-hide mt-10 flex w-full items-center justify-center gap-2.5 rounded-xl bg-terracotta px-6 py-3.5 font-sans text-base font-semibold text-white shadow-sm transition-colors hover:bg-terracotta-dark active:bg-terracotta-dark sm:w-auto sm:px-8"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M15 11h.01" /><path d="M11 15h.01" /><path d="M16 16h.01" />
            <path d="M2 16l20 6-6-20A20 20 0 0 0 2 16" />
            <path d="M5.71 17.11a17.04 17.04 0 0 1 11.4-11.4" />
          </svg>
          Start Cooking
        </Link>

        {/* Edit History */}
        <EditHistory
          entries={recipe.editHistory ?? []}
          contributedBy={recipe.contributedBy}
        />

        {/* Tags */}
        {recipe.tags.length > 0 && (
          <div className="print-hide mt-8 border-t border-cream-dark/30 pt-6">
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

      {/* Bottom spacing */}
      <div className="h-16" />

      {showSavedToast && (
        <Toast message="Recipe saved successfully!" onClose={() => setShowSavedToast(false)} />
      )}
    </main>
  );
}
