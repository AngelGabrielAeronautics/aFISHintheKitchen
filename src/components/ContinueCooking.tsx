"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface CookingState {
  slug: string;
  recipeTitle: string;
  recipeImage: string;
  currentStep: number;
  savedAt: number;
}

export default function ContinueCooking() {
  const [state, setState] = useState<CookingState | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    try {
      const raw = localStorage.getItem("cookingState");
      if (raw) {
        const parsed = JSON.parse(raw) as CookingState;
        // Only show if saved within last 4 hours
        if (Date.now() - parsed.savedAt < 4 * 60 * 60 * 1000) {
          setState(parsed);
        } else {
          localStorage.removeItem("cookingState");
        }
      }
    } catch {
      // ignore
    }
  }, [pathname]);

  // Don't show on the cooking page itself
  if (!state || pathname.includes("/cook")) return null;

  return (
    <div className="fixed bottom-6 left-4 right-4 z-[90] mx-auto max-w-lg animate-[slideUp_0.3s_ease-out]">
      <div className="flex items-center gap-3 rounded-xl bg-charcoal p-3 shadow-lg ring-1 ring-white/10">
        {state.recipeImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={state.recipeImage}
            alt=""
            className="h-12 w-12 shrink-0 rounded-lg object-cover"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-sans text-xs text-white/50">Continue cooking</p>
          <p className="font-sans text-sm font-semibold text-white truncate">
            {state.recipeTitle}
          </p>
        </div>
        <Link
          href={`/recipes/${state.slug}/cook`}
          className="shrink-0 rounded-lg bg-terracotta px-4 py-2 font-sans text-xs font-semibold text-white hover:bg-terracotta-dark transition-colors"
        >
          Resume
        </Link>
        <button
          onClick={() => {
            localStorage.removeItem("cookingState");
            setState(null);
          }}
          className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-white/30 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
