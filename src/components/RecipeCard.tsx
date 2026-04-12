import Link from "next/link";
import { Recipe, formatTime, getCategoryBySlug } from "@/lib/types";

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

  return (
    <Link
      href={`/recipes/${recipe.slug}`}
      className="group block rounded-xl bg-white shadow-sm ring-1 ring-charcoal/5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
    >
      {/* Image placeholder */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-t-xl bg-gradient-to-br from-terracotta-light/30 via-gold-light/20 to-sage-light/30">
        {/* Decorative utensils icon */}
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
            {/* Fork */}
            <path d="M20 8v10M16 8v6a4 4 0 0 0 4 4 4 4 0 0 0 4-4V8M20 22v34" />
            {/* Knife */}
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

          {/* Divider */}
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

          {/* Divider */}
          <span className="text-cream-dark">|</span>

          {/* Difficulty */}
          <span
            className={`rounded-full px-2 py-0.5 font-semibold ${difficultyColor[recipe.difficulty]}`}
          >
            {recipe.difficulty}
          </span>
        </div>

        {/* Contributor */}
        <p className="font-sans text-xs italic text-slate/70">
          Contributed by {recipe.contributedBy}
        </p>
      </div>
    </Link>
  );
}
