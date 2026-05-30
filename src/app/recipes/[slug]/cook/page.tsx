"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getRecipeBySlug } from "@/lib/firebase-recipes";
import { useHousehold } from "@/context/HouseholdContext";
import type { Recipe } from "@/lib/types";

// ---------------------------------------------------------------------------
// Alarm sound using Web Audio API
// ---------------------------------------------------------------------------
let alarmInterval: ReturnType<typeof setInterval> | null = null;

function playAlarm() {
  if (alarmInterval) return; // already playing
  try {
    const ctx = new AudioContext();
    function beep() {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "square";
      gain.gain.value = 0.15;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.stop(ctx.currentTime + 0.3);
    }
    beep();
    alarmInterval = setInterval(beep, 600);
    // Vibrate on mobile
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }
  } catch {
    // Web Audio not supported
  }
}

function stopAlarm() {
  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }
}

// ---------------------------------------------------------------------------
// Timer types
// ---------------------------------------------------------------------------
interface StepTimer {
  stepIndex: number;
  endsAt: number; // absolute timestamp (Date.now() + seconds * 1000)
  done: boolean;
}

function getSecondsLeft(timer: StepTimer): number {
  if (timer.done) return 0;
  return Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
}

function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Timer setup overlay
// ---------------------------------------------------------------------------
function TimerSetup({ stepIndex, onStart, onClose }: { stepIndex: number; onStart: (stepIndex: number, seconds: number) => void; onClose: () => void }) {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);

  const totalSeconds = hours * 3600 + minutes * 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl bg-[#1e2d1e] px-6 sm:px-10 py-8 sm:py-10 text-center shadow-2xl">
        <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#F0EBD8]">
          Step {stepIndex + 1} Timer
        </h3>
        <div className="mt-6 sm:mt-8 flex items-center justify-center gap-3 sm:gap-8">
          {/* Hours */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => setHours((h) => Math.max(0, h - 1))}
                className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-[#3D5A3E] text-lg font-bold text-white active:bg-[#2D4A2E] cursor-pointer"
              >
                -
              </button>
              <span className="w-10 sm:w-14 font-sans text-4xl sm:text-5xl font-bold text-[#F0EBD8] tabular-nums text-center">
                {hours}
              </span>
              <button
                onClick={() => setHours((h) => Math.min(12, h + 1))}
                className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-[#3D5A3E] text-lg font-bold text-white active:bg-[#2D4A2E] cursor-pointer"
              >
                +
              </button>
            </div>
            <p className="font-sans text-xs text-[#F0EBD8]/50">hours</p>
          </div>

          <span className="text-3xl sm:text-4xl font-bold text-[#F0EBD8]/30 mt-[-1.5rem]">:</span>

          {/* Minutes */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => setMinutes((m) => {
                  if (m <= 5) return Math.max(0, m - 1);
                  return m - 5;
                })}
                className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-[#3D5A3E] text-lg font-bold text-white active:bg-[#2D4A2E] cursor-pointer"
              >
                -
              </button>
              <span className="w-10 sm:w-14 font-sans text-4xl sm:text-5xl font-bold text-[#F0EBD8] tabular-nums text-center">
                {String(minutes).padStart(2, "0")}
              </span>
              <button
                onClick={() => setMinutes((m) => {
                  if (m < 5) return m + 1;
                  return Math.min(55, m + 5);
                })}
                className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-[#3D5A3E] text-lg font-bold text-white active:bg-[#2D4A2E] cursor-pointer"
              >
                +
              </button>
            </div>
            <p className="font-sans text-xs text-[#F0EBD8]/50">minutes</p>
          </div>
        </div>
        <button
          onClick={() => { if (totalSeconds > 0) { onStart(stepIndex, totalSeconds); onClose(); } }}
          disabled={totalSeconds === 0}
          className="mt-6 w-full rounded-xl bg-[#3D5A3E] px-6 py-4 font-sans text-lg font-semibold text-white active:bg-[#2D4A2E] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Start
        </button>
        <button
          onClick={onClose}
          className="mt-3 w-full rounded-xl px-6 py-3 font-sans text-sm font-medium text-[#F0EBD8]/60 hover:text-[#F0EBD8] cursor-pointer"
        >
          Cancel
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
  const [fetchError, setFetchError] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [timers, setTimers] = useState<Record<number, StepTimer>>({});
  const { householdId, loading: householdLoading } = useHousehold();
  const [restoredState, setRestoredState] = useState(false);

  // Restore saved state from localStorage on mount (multi-session)
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const raw = localStorage.getItem("cookingSessions");
        if (raw) {
          const sessions = JSON.parse(raw);
          const saved = sessions[slug];
          if (saved) {
            setCurrentStep(saved.currentStep ?? 0);
            setCheckedIngredients(new Set(saved.checkedIngredients ?? []));
            setTimers(saved.timers ?? {});
          }
        }
      } catch { /* ignore */ }
      setRestoredState(true);
    }, 0);
    return () => clearTimeout(t);
  }, [slug]);

  // Check for jump-to-step request (from alarm banner) — polls frequently
  useEffect(() => {
    const interval = setInterval(() => {
      const jumpTo = localStorage.getItem("cookJumpToStep");
      if (jumpTo) {
        localStorage.removeItem("cookJumpToStep");
        setCurrentStep(Number(jumpTo));
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);
  const [settingTimerFor, setSettingTimerFor] = useState<number | null>(null);
  // Save state to localStorage on changes (multi-session)
  useEffect(() => {
    if (!slug || !recipe || !restoredState) return;
    const state = {
      slug,
      recipeTitle: recipe.title,
      recipeImage: recipe.images?.[0] || recipe.image || "",
      currentStep,
      checkedIngredients: Array.from(checkedIngredients),
      timers,
      savedAt: Date.now(),
    };
    try {
      const raw = localStorage.getItem("cookingSessions");
      const sessions: Record<string, typeof state> = raw ? JSON.parse(raw) : {};
      sessions[slug] = state;
      localStorage.setItem("cookingSessions", JSON.stringify(sessions));
    } catch { /* ignore */ }
  }, [slug, recipe, currentStep, checkedIngredients, timers, restoredState]);

  // Touch / swipe refs
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Timer tick — checks absolute end times every second
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1); // force re-render to update display
      setTimers((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const key of Object.keys(next)) {
          const k = Number(key);
          if (!next[k].done && Date.now() >= next[k].endsAt) {
            next[k] = { ...next[k], done: true };
            playAlarm();
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  function startStepTimer(stepIndex: number, seconds: number) {
    setTimers((prev) => ({
      ...prev,
      [stepIndex]: { stepIndex, endsAt: Date.now() + seconds * 1000, done: false },
    }));
  }

  function clearStepTimer(stepIndex: number) {
    stopAlarm();
    setTimers((prev) => {
      const next = { ...prev };
      delete next[stepIndex];
      return next;
    });
  }

  // Check if any timer is done (for visual flash)
  const anyTimerDone = Object.values(timers).some((t) => t.done);

  const activeTimers = Object.values(timers);

  // Wake lock
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Fetch recipe — wait for the household so we scope to it and don't briefly
  // load a same-slug recipe from another household.
  useEffect(() => {
    if (!slug || householdLoading) return;
    getRecipeBySlug(slug, householdId)
      .then((r) => setRecipe(r))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [slug, householdId, householdLoading]);

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
      stopAlarm();
    };
  }, []);

  // Total steps: ingredients (0) + instruction steps + done screen
  const totalSteps = recipe ? recipe.instructions.length + 2 : 0;

  const goNext = useCallback(() => {
    setCurrentStep((s: number) => Math.min(s + 1, totalSteps - 1));
  }, [totalSteps]);

  const goPrev = useCallback(() => {
    setCurrentStep((s: number) => Math.max(s - 1, 0));
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

  // Clear this session when done
  const isDoneCheck = totalSteps > 0 && currentStep === totalSteps - 1;
  useEffect(() => {
    if (isDoneCheck && slug) {
      try {
        const raw = localStorage.getItem("cookingSessions");
        if (raw) {
          const sessions = JSON.parse(raw);
          delete sessions[slug];
          localStorage.setItem("cookingSessions", JSON.stringify(sessions));
        }
      } catch { /* ignore */ }
    }
  }, [isDoneCheck, slug]);

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
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#1A2E1A]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#1A2E1A] border-t-[#3D5A3E]" />
          <p className="font-sans text-sm text-[#F0EBD8]/60">
            Loading recipe...
          </p>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#1A2E1A]">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <h1 className="font-serif text-2xl font-bold text-[#F0EBD8]">
            Something went wrong
          </h1>
          <p className="font-sans text-sm text-[#F0EBD8]/60">Could not load the recipe. Check your connection and try again.</p>
          <button
            type="button"
            onClick={() => { setFetchError(false); setLoading(true); getRecipeBySlug(slug, householdId).then((r) => setRecipe(r)).catch(() => setFetchError(true)).finally(() => setLoading(false)); }}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#3D5A3E] px-5 py-2.5 font-sans text-sm font-medium text-white hover:bg-[#2D4A2E] cursor-pointer"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#1A2E1A]">
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

  const isIngredients = currentStep === 0;
  const isDone = currentStep === totalSteps - 1;
  const instructionIndex = currentStep - 1; // 0-based instruction index

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col bg-[#1A2E1A] select-none overflow-hidden ${anyTimerDone ? "ring-4 ring-inset ring-red-500 animate-pulse" : ""}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar: exit */}
      <div className="flex shrink-0 items-center justify-end px-4 py-3 sm:px-6">
        <div className="flex shrink-0 items-center gap-2">
          {/* Exit button */}
          <Link
            href={`/recipes/${recipe.slug}`}
            onClick={() => { /* keep state — user can resume later */ }}
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
      <div className={`flex flex-1 flex-col items-center overflow-y-auto px-6 py-8 sm:px-10 ${isIngredients || isDone ? "" : "justify-center"}`}>
        {isIngredients && (
          <div className="w-full max-w-lg">
            {/* Recipe image or icon */}
            {(recipe.images?.[0] || recipe.image) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={recipe.images?.[0] || recipe.image}
                alt={recipe.title}
                className="mx-auto h-32 w-32 rounded-full object-cover ring-4 ring-[#3D5A3E] sm:h-40 sm:w-40"
              />
            ) : (
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
            )}

            <h2 className="mt-6 text-center font-serif text-2xl font-bold text-[#F0EBD8] sm:text-3xl">
              {recipe.title}
            </h2>
            <p className="mt-2 text-center font-sans text-sm text-[#F0EBD8]/50">
              Check you have everything before you start
            </p>
            {checkedIngredients.size > 0 && (
              <p className="mt-1 text-center font-sans text-xs text-[#3D5A3E]">
                {checkedIngredients.size} of {recipe.ingredients.length} ready
              </p>
            )}

            <ul className="mt-8 space-y-3">
              {recipe.ingredients.map((ingredient, i) => (
                <li
                  key={i}
                  onClick={() => setCheckedIngredients((prev) => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i); else next.add(i);
                    return next;
                  })}
                  className={`flex items-start gap-3 rounded-lg px-4 py-3 cursor-pointer transition-colors ${
                    checkedIngredients.has(i) ? "bg-[#3D5A3E]/30" : "bg-[#F0EBD8]/5"
                  }`}
                >
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                    checkedIngredients.has(i) ? "border-[#3D5A3E] bg-[#3D5A3E] text-white" : "border-[#F0EBD8]/20 text-transparent"
                  }`}>
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
                  <span className={`font-sans text-base leading-snug transition-colors ${
                    checkedIngredients.has(i) ? "text-[#F0EBD8]/60" : "text-[#F0EBD8]/90"
                  }`}>
                    {ingredient}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!isIngredients && !isDone && (
          <div className="flex w-full max-w-lg flex-col items-center text-center">
            {/* Step indicators */}
            <div className="flex items-center gap-2 mb-6">
              {recipe.instructions.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentStep(i + 1)}
                  className={`flex items-center justify-center rounded-full font-sans font-bold transition-all cursor-pointer ${
                    i === instructionIndex
                      ? "h-14 w-14 bg-[#3D5A3E] text-white text-xl ring-2 ring-[#F0EBD8]/40 sm:h-16 sm:w-16 sm:text-2xl"
                      : currentStep > i + 1
                      ? "h-9 w-9 bg-[#3D5A3E]/60 text-white/80 text-sm sm:h-10 sm:w-10"
                      : "h-9 w-9 bg-[#F0EBD8]/10 text-[#F0EBD8]/30 text-sm sm:h-10 sm:w-10"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
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

            {/* Timer for this step */}
            {timers[instructionIndex] ? (
              <button
                onClick={() => clearStepTimer(instructionIndex)}
                className={`relative z-10 mt-8 flex w-full items-center gap-4 rounded-xl px-6 py-4 cursor-pointer transition-colors ${
                  timers[instructionIndex].done
                    ? "bg-red-600 shadow-lg shadow-red-500/30"
                    : "bg-[#3D5A3E]/30 hover:bg-[#3D5A3E]/50"
                }`}
              >
                <span className={`font-sans text-3xl font-bold tabular-nums ${timers[instructionIndex].done ? "text-white" : "text-[#F0EBD8]"}`}>
                  {formatSeconds(getSecondsLeft(timers[instructionIndex]))}
                </span>
                {timers[instructionIndex].done ? (
                  <span className="font-sans text-sm font-bold text-white">Tap to dismiss</span>
                ) : (
                  <span className="font-sans text-xs text-[#F0EBD8]/40">Tap to cancel</span>
                )}
                <svg className={`ml-auto h-5 w-5 ${timers[instructionIndex].done ? "text-white" : "text-[#F0EBD8]/40"}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : (
              <button
                onClick={() => setSettingTimerFor(instructionIndex)}
                className="mt-8 flex items-center gap-2.5 rounded-full bg-[#F0EBD8]/10 px-6 py-3 font-sans text-sm font-medium text-[#F0EBD8]/70 transition-colors hover:bg-[#F0EBD8]/20 active:bg-[#F0EBD8]/25 cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <circle cx="12" cy="13" r="8" />
                  <path d="M12 9v4l2 2" />
                  <path d="M5 3L2 6" />
                  <path d="M22 6l-3-3" />
                  <path d="M12 2v3" />
                </svg>
                Set Timer
              </button>
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
        <div className="flex shrink-0 gap-3 px-4 pb-6 pt-2 sm:px-6">
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
        <p className="shrink-0 pb-4 text-center font-sans text-xs text-[#F0EBD8]/30">
          Swipe or use arrow keys to navigate
        </p>
      )}

      {/* Timer overlay */}
      {/* Timer setup overlay */}
      {settingTimerFor !== null && (
        <TimerSetup
          stepIndex={settingTimerFor}
          onStart={startStepTimer}
          onClose={() => setSettingTimerFor(null)}
        />
      )}

      {/* Active timers bar — shows all running/done timers */}
      {activeTimers.length > 0 && !isIngredients && (
        <div className="shrink-0 flex gap-2 overflow-x-auto px-4 py-2 border-t border-[#F0EBD8]/10">
          {activeTimers.map((t) => (
            <button
              key={t.stepIndex}
              onClick={() => setCurrentStep(t.stepIndex + 1)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 font-sans text-xs font-medium cursor-pointer transition-colors ${
                t.done
                  ? "bg-red-500/20 text-red-400 animate-pulse"
                  : "bg-[#3D5A3E]/40 text-[#F0EBD8]/80"
              }`}
            >
              <span>Step {t.stepIndex + 1}</span>
              <span className="tabular-nums font-bold">{formatSeconds(getSecondsLeft(t))}</span>
              {t.done && <span className="text-red-400">!!!</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
