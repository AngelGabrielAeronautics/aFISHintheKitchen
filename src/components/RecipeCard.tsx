"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Recipe, formatTime, getCategoryBySlug, HEAT_ICONS, HEAT_LABELS, DIFFICULTY_ICONS } from "@/lib/types";
import Avatar from "@/components/Avatar";

interface RecipeCardProps {
  recipe: Recipe;
}

const difficultyColor: Record<Recipe["difficulty"], string> = {
  Easy: "bg-sage-light text-sage-dark",
  Medium: "bg-gold-light text-charcoal",
  Hard: "bg-terracotta-light text-terracotta-dark",
};

export default function RecipeCard({ recipe }: RecipeCardProps) {
  const category = getCategoryBySlug(recipe.category);
  const totalTime = recipe.prepTime + recipe.cookTime;
  const [iconError, setIconError] = useState(false);

  return (
    <Link
      href={`/recipes/${recipe.slug}`}
      className="group block rounded-xl bg-white shadow-sm ring-1 ring-charcoal/5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
    >
      {/* Image placeholder */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-t-xl bg-gradient-to-br from-terracotta-light/30 via-gold-light/20 to-sage-light/30">
        <div className="absolute inset-0 flex items-center justify-center opacity-20 transition-opacity duration-300 group-hover:opacity-30">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 64 64"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-20 w-20 text-terracotta"
          >
            <path d="M20 8v10M16 8v6a4 4 0 0 0 4 4 4 4 0 0 0 4-4V8M20 22v34" />
            <path d="M44 8c0 0-4 4-4 14s4 10 4 10v24M44 8v24" />
          </svg>
        </div>

        {/* Category badge */}
        {category && (
          <span className="absolute left-3 top-3 rounded-full bg-terracotta px-3 py-1 font-sans text-xs font-semibold tracking-wide text-white shadow-sm">
            {category.name}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-3 p-5">
        <h3 className="font-serif text-xl font-bold leading-snug text-charcoal transition-colors duration-200 group-hover:text-terracotta">
          {recipe.title}
        </h3>

        <p className="line-clamp-2 font-sans text-sm leading-relaxed text-slate">
          {recipe.description}
        </p>

        {/* Meta row */}
        <div className="flex items-center gap-3 border-t border-cream-dark/40 pt-3 font-sans text-xs text-slate">
          {/* Time */}
          <div className="flex items-center gap-1.5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5 text-terracotta/70"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z"
                clipRule="evenodd"
              />
            </svg>
            <span>{formatTime(totalTime)}</span>
          </div>

          <span className="text-cream-dark">|</span>

          {/* Servings */}
          <div className="flex items-center gap-1.5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5 text-terracotta/70"
            >
              <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 18a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.636.818.818 0 0 1-.36.98A7.465 7.465 0 0 1 14.5 16Z" />
            </svg>
            <span>
              {recipe.servings} {recipe.servings === 1 ? "serving" : "servings"}
            </span>
          </div>

          {(recipe.lovedBy?.length ?? 0) > 0 && (
            <>
              <span className="text-cream-dark">|</span>
              <div className="flex items-center gap-1 text-terracotta/70">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="m9.653 16.915-.005-.003-.019-.01a20.759 20.759 0 0 1-1.162-.682 22.045 22.045 0 0 1-2.582-1.9C4.045 12.733 2 10.352 2 7.5a4.5 4.5 0 0 1 8-2.828A4.5 4.5 0 0 1 18 7.5c0 2.852-2.044 5.233-3.885 6.82a22.049 22.049 0 0 1-3.744 2.582l-.019.01-.005.003h-.002a.723.723 0 0 1-.692 0h-.002Z" />
                </svg>
                <span>{recipe.lovedBy!.length}</span>
              </div>
            </>
          )}
        </div>

        {/* Bottom row: contributor + icons */}
        <div className="flex items-center justify-between border-t border-cream-dark/40 pt-3">
          <div className="flex items-center gap-2">
            <Avatar name={recipe.contributedBy} size="lg" ring />
            <p className="font-sans text-xs text-slate/70">
              {recipe.contributedBy}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Image
              src={DIFFICULTY_ICONS[recipe.difficulty]}
              alt={recipe.difficulty}
              width={44}
              height={44}
              className="h-11 w-11 object-contain"
              title={recipe.difficulty}
            />
            {!iconError && (
              <Image
                src={`/icons/${recipe.category}.png`}
                alt={category?.name || ""}
                width={44}
                height={44}
                className="h-11 w-11 object-contain"
                onError={() => setIconError(true)}
              />
            )}
            {recipe.protein && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/icons/${recipe.protein}.png`}
                alt={recipe.protein}
                className="h-11 w-11 object-contain"
                title={recipe.protein}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            )}
            {recipe.heat && (
              <Image
                src={HEAT_ICONS[recipe.heat]}
                alt={HEAT_LABELS[recipe.heat]}
                width={44}
                height={44}
                className="h-11 w-11 object-contain"
                title={HEAT_LABELS[recipe.heat]}
              />
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
