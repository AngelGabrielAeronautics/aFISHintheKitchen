"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface StepTimer {
  stepIndex: number;
  endsAt: number;
  done: boolean;
}

interface CookingSession {
  slug: string;
  recipeTitle: string;
  recipeImage: string;
  currentStep: number;
  timers?: Record<string, StepTimer>;
  savedAt: number;
}

const EXPIRY_MS = 48 * 60 * 60 * 1000;

function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function ContinueCooking() {
  const [sessions, setSessions] = useState<CookingSession[]>([]);
  const [endingSlug, setEndingSlug] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [alarming, setAlarming] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const alarmRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const pathname = usePathname();

  // Play alarm — only works after user interaction
  const startAlarm = useCallback(() => {
    if (alarmRef.current) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
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
      alarmRef.current = setInterval(beep, 600);
      if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
      setAudioUnlocked(true);
    } catch { /* ignore */ }
  }, []);

  function stopAlarm() {
    if (alarmRef.current) {
      clearInterval(alarmRef.current);
      alarmRef.current = null;
    }
  }

  // Load sessions
  useEffect(() => {
    try {
      const raw = localStorage.getItem("cookingSessions");
      if (!raw) return;
      const all: Record<string, CookingSession> = JSON.parse(raw);
      const now = Date.now();
      let changed = false;
      for (const key of Object.keys(all)) {
        if (now - all[key].savedAt > EXPIRY_MS) {
          delete all[key];
          changed = true;
        }
      }
      if (changed) localStorage.setItem("cookingSessions", JSON.stringify(all));
      setSessions(Object.values(all));
    } catch { /* ignore */ }
  }, [pathname]);

  // Tick every second to check timers
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);

      let anyExpired = false;
      try {
        const raw = localStorage.getItem("cookingSessions");
        if (raw) {
          const all: Record<string, CookingSession> = JSON.parse(raw);
          for (const session of Object.values(all)) {
            if (session.timers) {
              for (const timer of Object.values(session.timers)) {
                if (!timer.done && Date.now() >= timer.endsAt) {
                  anyExpired = true;
                }
              }
            }
          }
        }
      } catch { /* ignore */ }

      if (anyExpired && !alarming) {
        setAlarming(true);
        // Try to play — will only work if audio is unlocked
        if (audioUnlocked) {
          startAlarm();
        }
      } else if (!anyExpired && alarming) {
        setAlarming(false);
        stopAlarm();
      }
    }, 1000);
    return () => { clearInterval(interval); stopAlarm(); };
  }, [alarming, audioUnlocked, startAlarm]);

  // User taps the alarm banner to unlock audio and start sound
  function handleAlarmTap() {
    startAlarm();
  }

  function dismissAlarm() {
    stopAlarm();
    setAlarming(false);
  }

  function endSession(slug: string) {
    try {
      const raw = localStorage.getItem("cookingSessions");
      if (raw) {
        const all = JSON.parse(raw);
        delete all[slug];
        localStorage.setItem("cookingSessions", JSON.stringify(all));
      }
    } catch { /* ignore */ }
    setSessions((prev) => prev.filter((s) => s.slug !== slug));
    setEndingSlug(null);
    stopAlarm();
    setAlarming(false);
  }

  function getExpiredTimerCount(session: CookingSession): number {
    if (!session.timers) return 0;
    return Object.values(session.timers).filter((t) => !t.done && now >= t.endsAt).length;
  }

  function getFirstExpiredStep(session: CookingSession): number | null {
    if (!session.timers) return null;
    const expired = Object.values(session.timers)
      .filter((t) => !t.done && now >= t.endsAt)
      .sort((a, b) => a.endsAt - b.endsAt);
    return expired.length > 0 ? expired[0].stepIndex : null;
  }

  function getNextTimer(session: CookingSession): StepTimer | null {
    if (!session.timers) return null;
    const active = Object.values(session.timers).filter((t) => !t.done && now < t.endsAt);
    if (active.length === 0) return null;
    return active.sort((a, b) => a.endsAt - b.endsAt)[0];
  }

  const now = Date.now(); // eslint-disable-line react-hooks/purity
  const activeSessions = sessions.filter((s) => !pathname.includes(`/recipes/${s.slug}/cook`));
  if (activeSessions.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-6 right-4 z-[90] w-80 space-y-2 animate-[slideUp_0.3s_ease-out]">
        {activeSessions.map((session) => {
          const expired = getExpiredTimerCount(session);
          const expiredStep = getFirstExpiredStep(session);
          const nextTimer = getNextTimer(session);
          const nextSecondsLeft = nextTimer ? Math.max(0, Math.ceil((nextTimer.endsAt - now) / 1000)) : 0;
          const resumeHref = `/recipes/${session.slug}/cook`;

          return (
            <div key={session.slug}>
              {/* Alarm tap banner — shows when timer expired and audio not yet unlocked */}
              {expired > 0 && alarming && !audioUnlocked && (
                <button
                  onClick={handleAlarmTap}
                  className="mb-2 w-full rounded-xl bg-red-600 px-4 py-3 text-center font-sans text-sm font-bold text-white animate-pulse cursor-pointer"
                >
                  Tap to hear alarm!
                </button>
              )}

              <div
                className={`flex items-center gap-3 rounded-xl p-3 shadow-lg ring-1 ${
                  expired > 0
                    ? "bg-red-900 ring-red-500/30 animate-pulse"
                    : "bg-charcoal ring-white/10"
                }`}
              >
                {session.recipeImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={session.recipeImage} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-xs text-white/50">
                    {expired > 0 ? `${expired} timer${expired > 1 ? "s" : ""} done!` : "Continue cooking"}
                  </p>
                  <p className="font-sans text-sm font-semibold text-white truncate">
                    {session.recipeTitle}
                  </p>
                  {nextTimer && !expired && (
                    <p className="font-sans text-xs text-white/40 tabular-nums">
                      Next timer: {formatSeconds(nextSecondsLeft)}
                    </p>
                  )}
                </div>
                <Link
                  href={resumeHref}
                  onClick={() => {
                    dismissAlarm();
                    // If alarm is active, tell the cook page to jump to the expired step
                    if (expired > 0 && expiredStep !== null) {
                      localStorage.setItem("cookJumpToStep", String(expiredStep + 1));
                    }
                  }}
                  className="shrink-0 rounded-lg bg-terracotta px-3 py-2 font-sans text-xs font-semibold text-white hover:bg-terracotta-dark transition-colors"
                >
                  Resume
                </Link>
                <button
                  onClick={() => setEndingSlug(session.slug)}
                  className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-white/30 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* End session confirmation modal */}
      {endingSlug && (() => {
        const session = sessions.find((s) => s.slug === endingSlug);
        if (!session) return null;
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-charcoal/60 backdrop-blur-sm" onClick={() => setEndingSlug(null)} />
            <div className="relative w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-charcoal/10">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-gold-light/30">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-gold">
                  <circle cx="12" cy="13" r="8" />
                  <path d="M12 9v4l2 2" />
                  <path d="M5 3L2 6" />
                  <path d="M22 6l-3-3" />
                  <path d="M12 2v3" />
                </svg>
              </div>
              <h3 className="text-center font-serif text-xl font-bold text-charcoal">End Cooking Session?</h3>
              <p className="mt-2 text-center font-sans text-sm text-slate">
                Your cooking progress, checked ingredients, and any active timers for <span className="font-semibold text-charcoal">{session.recipeTitle}</span> will be lost.
              </p>
              <div className="mt-6 flex gap-3">
                <button onClick={() => setEndingSlug(null)} className="flex-1 rounded-lg bg-terracotta px-4 py-3 font-sans text-sm font-medium text-white transition-colors hover:bg-terracotta-dark cursor-pointer">
                  Keep Cooking
                </button>
                <button onClick={() => endSession(endingSlug)} className="flex-1 rounded-lg border border-cream-dark px-4 py-3 font-sans text-sm font-medium text-slate transition-colors hover:bg-cream-dark/20 cursor-pointer">
                  End Session
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
