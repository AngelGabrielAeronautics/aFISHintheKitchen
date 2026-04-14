"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getRecipeBySlug } from "@/lib/firebase-recipes";
import type { Recipe } from "@/lib/types";

// ---------------------------------------------------------------------------
// Timer overlay component
// ---------------------------------------------------------------------------
function TimerOverlay({ onClose }: { onClose: () => void }) {
  const [minutes, setMinutes] = useState(5);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function startTimer() {
    setSecondsLeft(minutes * 60);
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function resetTimer() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSecondsLeft(null);
  }

  const displayMins = secondsLeft !== null ? Math.floor(secondsLeft / 60) : 0;
  const displaySecs = secondsLeft !== null ? secondsLeft % 60 : 0;
  const done = secondsLeft === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-[#1e2d1e] p-8 text-center shadow-2xl">
        <h3 className="font-serif text-2xl font-bold text-[#F0EBD8]">Timer</h3>

        {secondsLeft === null ? (
          <>
            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                onClick={() => setMinutes((m) => Math.max(1, m - 1))}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-[#3D5A3E] text-2xl font-bold text-white active:bg-[#2D4A2E] cursor-pointer"
              >
                -
              </button>
              <span className="font-sans text-5xl font-bold text-[#F0EBD8] tabular-nums">
                {minutes}
              </span>
              <button
                onClick={() => setMinutes((m) => Math.min(180, m + 1))}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-[#3D5A3E] text-2xl font-bold text-white active:bg-[#2D4A2E] cursor-pointer"
              >
                +
              </button>
            </div>
            <p className="mt-2 font-sans text-sm text-[#F0EBD8]/60">minutes</p>
            <button
              onClick={startTimer}
              className="mt-6 w-full rounded-xl bg-[#3D5A3E] px-6 py-4 font-sans text-lg font-semibold text-white active:bg-[#2D4A2E] cursor-pointer"
            >
              Start
            </button>
          </>
        ) : (
          <>
            <div className="mt-6">
              <span
                className={`font-sans text-6xl font-bold tabular-nums ${
                  done ? "text-[#C4B88A] animate-pulse" : "text-[#F0EBD8]"
                }`}
              >
                {String(displayMins).padStart(2, "0")}:
                {String(displaySecs).padStart(2, "0")}
              </span>
            </div>
            {done && (
              <p className="mt-4 font-sans text-lg font-semibold text-[#C4B88A]">
                Time is up!
              </p>
            )}
            <button
              onClick={resetTimer}
              className="mt-6 w-full rounded-xl bg-[#3D5A3E] px-6 py-4 font-sans text-lg font-semibold text-white active:bg-[#2D4A2E] cursor-pointer"
            >
              Reset
            </button>
          </>
        )}

        <button
          onClick={onClose}
          className="mt-3 w-full rounded-xl px-6 py-3 font-sans text-sm font-medium text-[#F0EBD8]/60 hover:text-[#F0EBD8] cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main cooking mode page
// ---------------------------------------------------------------------------
export default function CookModePage() {
  const { slug } = useParams<{ slug: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [showTimer, setShowTimer] = useState(false);

  // Touch / swipe refs
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Wake lock
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Fetch recipe
  useEffect(() => {
    if (!slug) return;
    getRecipeBySlug(slug)
      .then((r) => setRecipe(r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  // Set page title
  useEffect(() => {
    if (recipe) {
      document.title = `Cooking: ${recipe.title} | A Fish in the Kitchen`;
    }
  }, [recipe]);

  // Request wake lock
  useEffect(() => {
    async function requestWakeLock() {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        }
      } catch {
        // Wake lock not supported or denied — that's fine
      }
    }
    requestWakeLock();

    // Re-acquire on visibility change
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  // Total steps: ingredients (0) + instruction steps + done screen
  const totalSteps = recipe ? recipe.instructions.length + 2 : 0;

  const goNext = useCallback(() => {
    setCurrentStep((s) => Math.min(s + 1, totalSteps - 1));
  }, [totalSteps]);

  const goPrev = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev]);

  // Touch swipe handlers
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Only register horizontal swipes (with enough distance and mostly horizontal)
    if (absDx > 50 && absDx > absDy * 1.5) {
      if (dx < 0) goNext();
      else goPrev();
    }

    touchStartX.current = null;
    touchStartY.current = null;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#1A2E1A]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#1A2E1A] border-t-[#3D5A3E]" />
          <p className="font-sans text-sm text-[#F0EBD8]/60">
            Loading recipe...
          </p>
        </div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#1A2E1A]">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <h1 className="font-serif text-2xl font-bold text-[#F0EBD8]">
            Recipe not found
          </h1>
          <Link
            href={`/recipes/${slug}`}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#3D5A3E] px-5 py-2.5 font-sans text-sm font-medium text-white hover:bg-[#2D4A2E]"
          >
            Back to recipe
          </Link>
        </div>
      </div>
    );
  }

  const progress = ((currentStep + 1) / totalSteps) * 100;
  const isIngredients = currentStep === 0;
  const isDone = currentStep === totalSteps - 1;
  const instructionIndex = currentStep - 1; // 0-based instruction index

  return (
    <div
      className="flex min-h-dvh flex-col bg-[#1A2E1A] select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Progress bar */}
      <div className="h-1.5 w-full bg-[#0d1a0d]">
        <div
          className="h-full bg-[#3D5A3E] transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Top bar: step counter + exit */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <p className="font-sans text-sm text-[#F0EBD8]/50">
          {isIngredients
            ? "Ingredients"
            : isDone
            ? "Done"
            : `Step ${instructionIndex + 1} of ${recipe.instructions.length}`}
        </p>
        <div className="flex items-center gap-2">
          {/* Timer button */}
          {!isIngredients && !isDone && (
            <button
              onClick={() => setShowTimer(true)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F0EBD8]/10 text-[#F0EBD8]/70 hover:bg-[#F0EBD8]/20 active:bg-[#F0EBD8]/25 cursor-pointer"
              title="Set a timer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <circle cx="12" cy="13" r="8" />
                <path d="M12 9v4l2 2" />
                <path d="M5 3L2 6" />
                <path d="M22 6l-3-3" />
                <path d="M12 2v3" />
              </svg>
            </button>
          )}
          {/* Exit button */}
          <Link
            href={`/recipes/${recipe.slug}`}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F0EBD8]/10 text-[#F0EBD8]/70 hover:bg-[#F0EBD8]/20"
            title="Exit cooking mode"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 sm:px-10">
        {isIngredients && (
          <div className="w-full max-w-lg">
            {/* Step circle */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#3D5A3E] sm:h-20 sm:w-20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-8 w-8 text-white sm:h-10 sm:w-10"
              >
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="2" />
                <path d="M9 14l2 2 4-4" />
              </svg>
            </div>

            <h2 className="mt-6 text-center font-serif text-2xl font-bold text-[#F0EBD8] sm:text-3xl">
              {recipe.title}
            </h2>
            <p className="mt-2 text-center font-sans text-sm text-[#F0EBD8]/50">
              Check you have everything before you start
            </p>

            <ul className="mt-8 space-y-3">
              {recipe.ingredients.map((ingredient, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-lg bg-[#F0EBD8]/5 px-4 py-3"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[#F0EBD8]/20 text-transparent">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-3 w-3"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                  <span className="font-sans text-base leading-snug text-[#F0EBD8]/90">
                    {ingredient}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!isIngredients && !isDone && (
          <div className="flex w-full max-w-lg flex-col items-center text-center">
            {/* Step number circle */}
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#3D5A3E] sm:h-20 sm:w-20">
              <span className="font-sans text-2xl font-bold text-white sm:text-3xl">
                {instructionIndex + 1}
              </span>
            </div>

            {/* Step text */}
            <p className="mt-8 font-sans text-xl leading-relaxed text-[#F0EBD8] sm:text-2xl">
              {recipe.instructions[instructionIndex]}
            </p>

            {/* Step image */}
            {recipe.instructionImages?.[String(instructionIndex)] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={recipe.instructionImages[String(instructionIndex)]}
                alt={`Step ${instructionIndex + 1}`}
                className="mt-6 max-h-64 rounded-xl object-cover shadow-lg sm:max-h-80"
              />
            )}
          </div>
        )}

        {isDone && (
          <div className="flex w-full max-w-lg flex-col items-center text-center">
            {/* Checkmark circle */}
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#3D5A3E] sm:h-24 sm:w-24">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-10 w-10 text-white sm:h-12 sm:w-12"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h2 className="mt-6 font-serif text-3xl font-bold text-[#F0EBD8] sm:text-4xl">
              Done!
            </h2>
            <p className="mt-3 font-sans text-lg text-[#F0EBD8]/60">
              Enjoy your meal.
            </p>

            <Link
              href={`/recipes/${recipe.slug}`}
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#3D5A3E] px-8 py-4 font-sans text-base font-semibold text-white hover:bg-[#2D4A2E] active:bg-[#2D4A2E]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path
                  fillRule="evenodd"
                  d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
                  clipRule="evenodd"
                />
              </svg>
              Back to recipe
            </Link>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      {!isDone && (
        <div className="flex gap-3 px-4 pb-6 pt-2 sm:px-6">
          <button
            onClick={goPrev}
            disabled={currentStep === 0}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-[#F0EBD8]/10 font-sans text-base font-semibold text-[#F0EBD8] disabled:opacity-25 active:bg-[#F0EBD8]/20 cursor-pointer disabled:cursor-default"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path
                fillRule="evenodd"
                d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z"
                clipRule="evenodd"
              />
            </svg>
            Previous
          </button>
          <button
            onClick={goNext}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-[#3D5A3E] font-sans text-base font-semibold text-white active:bg-[#2D4A2E] cursor-pointer"
          >
            {currentStep === totalSteps - 2 ? "Finish" : "Next"}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path
                fillRule="evenodd"
                d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Swipe hint on first step */}
      {currentStep === 0 && (
        <p className="pb-4 text-center font-sans text-xs text-[#F0EBD8]/30">
          Swipe or use arrow keys to navigate
        </p>
      )}

      {/* Timer overlay */}
      {showTimer && <TimerOverlay onClose={() => setShowTimer(false)} />}
    </div>
  );
}
