"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { toggleLoved, toggleDisliked, toggleMustTry, toggleTried } from "@/lib/firebase-recipes";
import Avatar from "@/components/Avatar";

interface RecipePreferencesProps {
  recipeId: string;
  initialLovedBy: string[];
  initialDislikedBy: string[];
  initialMustTry: string[];
  initialTriedBy: string[];
}

export default function RecipePreferences({
  recipeId,
  initialLovedBy,
  initialDislikedBy,
  initialMustTry,
  initialTriedBy,
}: RecipePreferencesProps) {
  const { user } = useAuth();
  const [lovedBy, setLovedBy] = useState<string[]>(initialLovedBy);
  const [dislikedBy, setDislikedBy] = useState<string[]>(initialDislikedBy);
  const [mustTry, setMustTry] = useState<string[]>(initialMustTry);
  const [triedBy, setTriedBy] = useState<string[]>(initialTriedBy);
  const [busy, setBusy] = useState(false);

  const displayName = user?.displayName || user?.email || "";
  const userLoves = displayName ? lovedBy.includes(displayName) : false;
  const userDislikes = displayName ? dislikedBy.includes(displayName) : false;
  const userMustTry = displayName ? mustTry.includes(displayName) : false;
  const userTried = displayName ? triedBy.includes(displayName) : false;

  async function handleLove() {
    if (!displayName || busy) return;
    setBusy(true);
    const adding = !userLoves;
    try {
      await toggleLoved(recipeId, displayName, adding);
      if (adding) {
        setLovedBy((prev) => [...prev, displayName]);
        setDislikedBy((prev) => prev.filter((n) => n !== displayName));
        // If you love it, you've tried it
        if (!triedBy.includes(displayName)) {
          await toggleTried(recipeId, displayName, true);
          setTriedBy((prev) => [...prev, displayName]);
          setMustTry((prev) => prev.filter((n) => n !== displayName));
        }
      } else {
        setLovedBy((prev) => prev.filter((n) => n !== displayName));
      }
    } catch { /* silently fail */ }
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
    } catch { /* silently fail */ }
    setBusy(false);
  }

  async function handleMustTry() {
    if (!displayName || busy) return;
    setBusy(true);
    const adding = !userMustTry;
    try {
      await toggleMustTry(recipeId, displayName, adding);
      if (adding) {
        setMustTry((prev) => [...prev, displayName]);
      } else {
        setMustTry((prev) => prev.filter((n) => n !== displayName));
      }
    } catch { /* silently fail */ }
    setBusy(false);
  }

  async function handleTried() {
    if (!displayName || busy) return;
    setBusy(true);
    const adding = !userTried;
    try {
      await toggleTried(recipeId, displayName, adding);
      if (adding) {
        setTriedBy((prev) => [...prev, displayName]);
        setMustTry((prev) => prev.filter((n) => n !== displayName));
      } else {
        setTriedBy((prev) => prev.filter((n) => n !== displayName));
      }
    } catch { /* silently fail */ }
    setBusy(false);
  }

  return (
    <div data-component="family-verdict" className="mt-8 rounded-2xl bg-warm-white p-6 ring-1 ring-cream-dark/30">
      <h3 className="font-serif text-lg font-bold text-charcoal">
        Family Verdict
      </h3>
      <p className="mt-1 font-sans text-xs text-slate">
        Who loves this dish? Who&rsquo;s tried it? Who wants to?
      </p>

      <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Loved by */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-terracotta">
              <path d="m9.653 16.915-.005-.003-.019-.01a20.759 20.759 0 0 1-1.162-.682 22.045 22.045 0 0 1-2.582-1.9C4.045 12.733 2 10.352 2 7.5a4.5 4.5 0 0 1 8-2.828A4.5 4.5 0 0 1 18 7.5c0 2.852-2.044 5.233-3.885 6.82a22.049 22.049 0 0 1-3.744 2.582l-.019.01-.005.003h-.002a.723.723 0 0 1-.692 0h-.002Z" />
            </svg>
            <span className="font-sans text-sm font-semibold text-charcoal">Loved by</span>
            {lovedBy.length > 0 && (
              <span className="rounded-full bg-terracotta/10 px-2 py-0.5 font-sans text-xs font-medium text-terracotta">{lovedBy.length}</span>
            )}
          </div>
          {lovedBy.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {lovedBy.map((name) => (
                <div key={name} className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 ring-1 ring-cream-dark/30">
                  <Avatar name={name} size="sm" ring />
                  <span className="font-sans text-xs text-charcoal">{name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-sans text-xs italic text-slate/60">No votes yet</p>
          )}
        </div>

        {/* Must Try */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-gold">
              <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" clipRule="evenodd" />
            </svg>
            <span className="font-sans text-sm font-semibold text-charcoal">Must Try</span>
            {mustTry.length > 0 && (
              <span className="rounded-full bg-gold/10 px-2 py-0.5 font-sans text-xs font-medium text-gold">{mustTry.length}</span>
            )}
          </div>
          {mustTry.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {mustTry.map((name) => (
                <div key={name} className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 ring-1 ring-cream-dark/30">
                  <Avatar name={name} size="sm" ring />
                  <span className="font-sans text-xs text-charcoal">{name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-sans text-xs italic text-slate/60">No one yet</p>
          )}
        </div>

        {/* Tried it */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-sage">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
            </svg>
            <span className="font-sans text-sm font-semibold text-charcoal">Tried it</span>
            {triedBy.length > 0 && (
              <span className="rounded-full bg-sage/10 px-2 py-0.5 font-sans text-xs font-medium text-sage">{triedBy.length}</span>
            )}
          </div>
          {triedBy.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {triedBy.map((name) => (
                <div key={name} className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 ring-1 ring-cream-dark/30">
                  <Avatar name={name} size="sm" ring />
                  <span className="font-sans text-xs text-charcoal">{name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-sans text-xs italic text-slate/60">No one yet</p>
          )}
        </div>

        {/* Not for me */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate/50">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
            <span className="font-sans text-sm font-semibold text-charcoal">Not for me</span>
            {dislikedBy.length > 0 && (
              <span className="rounded-full bg-slate/10 px-2 py-0.5 font-sans text-xs font-medium text-slate">{dislikedBy.length}</span>
            )}
          </div>
          {dislikedBy.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {dislikedBy.map((name) => (
                <div key={name} className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 ring-1 ring-cream-dark/30">
                  <Avatar name={name} size="sm" ring />
                  <span className="font-sans text-xs text-charcoal">{name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-sans text-xs italic text-slate/60">No votes yet</p>
          )}
        </div>
      </div>

      {/* Vote buttons for signed-in users */}
      {user ? (
        <div className="mt-5 flex flex-wrap gap-3 border-t border-cream-dark/30 pt-5">
          <button
            onClick={handleLove}
            disabled={busy}
            className={`flex items-center gap-2 rounded-full px-4 py-2 font-sans text-sm font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
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
            onClick={handleMustTry}
            disabled={busy}
            className={`flex items-center gap-2 rounded-full px-4 py-2 font-sans text-sm font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              userMustTry
                ? "bg-gold text-white"
                : "bg-white text-slate ring-1 ring-cream-dark/40 hover:ring-gold/40 hover:text-gold"
            }`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" clipRule="evenodd" />
            </svg>
            {userMustTry ? "On my list!" : "Must try"}
          </button>

          <button
            onClick={handleTried}
            disabled={busy}
            className={`flex items-center gap-2 rounded-full px-4 py-2 font-sans text-sm font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              userTried
                ? "bg-sage text-white"
                : "bg-white text-slate ring-1 ring-cream-dark/40 hover:ring-sage/40 hover:text-sage"
            }`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
            </svg>
            {userTried ? "Tried it!" : "I've tried this"}
          </button>

          <button
            onClick={handleDislike}
            disabled={busy}
            className={`flex items-center gap-2 rounded-full px-4 py-2 font-sans text-sm font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              userDislikes
                ? "bg-slate text-white"
                : "bg-white text-slate ring-1 ring-cream-dark/40 hover:ring-slate/40 hover:text-charcoal"
            }`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
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
