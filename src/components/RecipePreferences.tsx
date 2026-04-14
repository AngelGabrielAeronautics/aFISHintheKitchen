"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { toggleLoved, toggleDisliked } from "@/lib/firebase-recipes";
import Avatar from "@/components/Avatar";

interface RecipePreferencesProps {
  recipeId: string;
  initialLovedBy: string[];
  initialDislikedBy: string[];
}

export default function RecipePreferences({
  recipeId,
  initialLovedBy,
  initialDislikedBy,
}: RecipePreferencesProps) {
  const { user } = useAuth();
  const [lovedBy, setLovedBy] = useState<string[]>(initialLovedBy);
  const [dislikedBy, setDislikedBy] = useState<string[]>(initialDislikedBy);
  const [busy, setBusy] = useState(false);

  const displayName = user?.displayName || user?.email || "";
  const userLoves = displayName ? lovedBy.includes(displayName) : false;
  const userDislikes = displayName ? dislikedBy.includes(displayName) : false;

  async function handleLove() {
    if (!displayName || busy) return;
    setBusy(true);
    const adding = !userLoves;
    try {
      await toggleLoved(recipeId, displayName, adding);
      if (adding) {
        setLovedBy((prev) => [...prev, displayName]);
        setDislikedBy((prev) => prev.filter((n) => n !== displayName));
      } else {
        setLovedBy((prev) => prev.filter((n) => n !== displayName));
      }
    } catch {
      // silently fail
    }
    setBusy(false);
  }

  async function handleDislike() {
    if (!displayName || busy) return;
    setBusy(true);
    const adding = !userDislikes;
    try {
      await toggleDisliked(recipeId, displayName, adding);
      if (adding) {
        setDislikedBy((prev) => [...prev, displayName]);
        setLovedBy((prev) => prev.filter((n) => n !== displayName));
      } else {
        setDislikedBy((prev) => prev.filter((n) => n !== displayName));
      }
    } catch {
      // silently fail
    }
    setBusy(false);
  }

  return (
    <div data-component="family-verdict" className="mt-8 rounded-2xl bg-warm-white p-6 ring-1 ring-cream-dark/30">
      <h3 className="font-serif text-lg font-bold text-charcoal">
        Family Verdict
      </h3>
      <p className="mt-1 font-sans text-xs text-slate">
        Who loves this dish? Who&rsquo;d rather skip it?
      </p>

      <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Loved by */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-terracotta">
              <path d="m9.653 16.915-.005-.003-.019-.01a20.759 20.759 0 0 1-1.162-.682 22.045 22.045 0 0 1-2.582-1.9C4.045 12.733 2 10.352 2 7.5a4.5 4.5 0 0 1 8-2.828A4.5 4.5 0 0 1 18 7.5c0 2.852-2.044 5.233-3.885 6.82a22.049 22.049 0 0 1-3.744 2.582l-.019.01-.005.003h-.002a.723.723 0 0 1-.692 0h-.002Z" />
            </svg>
            <span className="font-sans text-sm font-semibold text-charcoal">
              Loved by
            </span>
            {lovedBy.length > 0 && (
              <span className="rounded-full bg-terracotta/10 px-2 py-0.5 font-sans text-xs font-medium text-terracotta">
                {lovedBy.length}
              </span>
            )}
          </div>

          {lovedBy.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {lovedBy.map((name) => (
                <div
                  key={name}
                  className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 ring-1 ring-cream-dark/30"
                >
                  <Avatar name={name} size="sm" />
                  <span className="font-sans text-xs text-charcoal">{name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-sans text-xs italic text-slate/60">
              No votes yet
            </p>
          )}
        </div>

        {/* Disliked by */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate/50">
              <path d="M18.905 12.75a1.25 1.25 0 0 1-2.5 0v-7.5a1.25 1.25 0 1 1 2.5 0v7.5ZM15.905 3h-1.862a2 2 0 0 0-1.279.46l-.774.633a.5.5 0 0 1-.64 0l-.773-.633A2 2 0 0 0 9.3 3H7.438a2 2 0 0 0-1.953 1.567L4.19 11.19A2 2 0 0 0 6.144 13.5H8.79l-.415 2.074a1.5 1.5 0 0 0 .872 1.697l.293.133a1.25 1.25 0 0 0 1.595-.524l2.27-4.13H15.905a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z" />
            </svg>
            <span className="font-sans text-sm font-semibold text-charcoal">
              Not for me
            </span>
            {dislikedBy.length > 0 && (
              <span className="rounded-full bg-slate/10 px-2 py-0.5 font-sans text-xs font-medium text-slate">
                {dislikedBy.length}
              </span>
            )}
          </div>

          {dislikedBy.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {dislikedBy.map((name) => (
                <div
                  key={name}
                  className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 ring-1 ring-cream-dark/30"
                >
                  <Avatar name={name} size="sm" />
                  <span className="font-sans text-xs text-charcoal">{name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-sans text-xs italic text-slate/60">
              No votes yet
            </p>
          )}
        </div>
      </div>

      {/* Vote buttons for signed-in users */}
      {user ? (
        <div className="mt-5 flex gap-3 border-t border-cream-dark/30 pt-5">
          <button
            onClick={handleLove}
            disabled={busy}
            className={`flex items-center gap-2 rounded-full px-4 py-2 font-sans text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 ${
              userLoves
                ? "bg-terracotta text-white"
                : "bg-white text-slate ring-1 ring-cream-dark/40 hover:ring-terracotta/40 hover:text-terracotta"
            }`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="m9.653 16.915-.005-.003-.019-.01a20.759 20.759 0 0 1-1.162-.682 22.045 22.045 0 0 1-2.582-1.9C4.045 12.733 2 10.352 2 7.5a4.5 4.5 0 0 1 8-2.828A4.5 4.5 0 0 1 18 7.5c0 2.852-2.044 5.233-3.885 6.82a22.049 22.049 0 0 1-3.744 2.582l-.019.01-.005.003h-.002a.723.723 0 0 1-.692 0h-.002Z" />
            </svg>
            {userLoves ? "Loved!" : "Love this"}
          </button>

          <button
            onClick={handleDislike}
            disabled={busy}
            className={`flex items-center gap-2 rounded-full px-4 py-2 font-sans text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 ${
              userDislikes
                ? "bg-slate text-white"
                : "bg-white text-slate ring-1 ring-cream-dark/40 hover:ring-slate/40 hover:text-charcoal"
            }`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M18.905 12.75a1.25 1.25 0 0 1-2.5 0v-7.5a1.25 1.25 0 1 1 2.5 0v7.5ZM15.905 3h-1.862a2 2 0 0 0-1.279.46l-.774.633a.5.5 0 0 1-.64 0l-.773-.633A2 2 0 0 0 9.3 3H7.438a2 2 0 0 0-1.953 1.567L4.19 11.19A2 2 0 0 0 6.144 13.5H8.79l-.415 2.074a1.5 1.5 0 0 0 .872 1.697l.293.133a1.25 1.25 0 0 0 1.595-.524l2.27-4.13H15.905a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z" />
            </svg>
            {userDislikes ? "Not for me" : "Not my thing"}
          </button>
        </div>
      ) : (
        <p className="mt-5 border-t border-cream-dark/30 pt-4 font-sans text-xs text-slate/60">
          <a href="/auth" className="text-terracotta hover:text-terracotta-dark">Sign in</a> to share your opinion
        </p>
      )}
    </div>
  );
}
