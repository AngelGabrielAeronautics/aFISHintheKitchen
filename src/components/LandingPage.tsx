"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import Reveal from "@/components/Reveal";

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Create your cookbook",
    description: "Sign up and set up your family's private cookbook in minutes — name it, make it yours.",
  },
  {
    step: "2",
    title: "Invite your family",
    description: "Add up to 5 family members or friends. It's completely free for them to join and contribute.",
  },
  {
    step: "3",
    title: "Cook together",
    description: "Add recipes, plan meals, assign dishes for gatherings, and cook hands-free with step-by-step mode.",
  },
];

const PLAN_PERKS = [
  "You + up to 5 family members",
  "Unlimited recipes, photos & videos",
  "Meal planning & shopping lists",
  "Step-by-step cooking mode",
  "Event menus & kitchen tips",
  "Private & ad-free, always",
];

// Locked prices per currency (no live FX — Stripe/Paddle let you set the real
// charged amount per market at the billing milestone). Pricing rationale: R99
// anchors against Netflix/Showmax in SA; international tiers approximate that
// per local conventions. Refine when payment provider is wired.
type CurrencyCode = "ZAR" | "USD" | "GBP" | "EUR" | "AUD";
const PLAN_PRICES: Record<CurrencyCode, { prefix: string; monthly: string; annual: string }> = {
  ZAR: { prefix: "R", monthly: "99", annual: "990" },
  USD: { prefix: "$", monthly: "5.99", annual: "59" },
  GBP: { prefix: "£", monthly: "4.99", annual: "49" },
  EUR: { prefix: "€", monthly: "5.99", annual: "59" },
  AUD: { prefix: "A$", monthly: "9.99", annual: "99" },
};

const FAQS = [
  {
    q: "Is my cookbook private?",
    a: "Completely. Only you and the family members you invite can see your recipes — it's never public or searchable.",
  },
  {
    q: "How many people can I invite?",
    a: "Up to 5 family members or friends, free for them. They can add recipes, plan meals, and cook right alongside you.",
  },
  {
    q: "Do my family members pay?",
    a: "No. Only you, the cookbook owner, subscribe. Everyone you invite uses the app for free.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel whenever you like and you'll keep full access until the end of your billing period.",
  },
  {
    q: "What happens after the free trial?",
    a: "Your plan starts automatically at the end of the 14-day trial. Cancel before it ends if it's not for you.",
  },
  {
    q: "Can I join more than one cookbook?",
    a: "Yes — you can be a free member of up to 3 other families' cookbooks, on top of your own.",
  },
];

type Feature = {
  title: string;
  description: string;
  frontImage?: string;
  backImage?: string;
  backVideo?: string;
  icon: ReactNode;
};

const FEATURES: Feature[] = [
  {
    title: "Family Recipes",
    description: "Collect and organise your family's best recipes in one beautiful place. Add photos, videos, ingredients, and step-by-step instructions.",
    frontImage: "/card-family-recipes.jpg",
    backVideo: "/card-family-recipes.mp4",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
        <path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    title: "Cooking Mode",
    description: "Full-screen step-by-step instructions with built-in timers, swipe navigation, and wake lock so your screen stays on while you cook.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
        <path d="M15 11h.01M11 15h.01M16 16h.01M2 16l20 6-6-20A20 20 0 0 0 2 16" />
      </svg>
    ),
  },
  {
    title: "Meal Planning",
    description: "Plan your family's meals for the week. Each member has their own plan, and you can see what everyone else is cooking.",
    frontImage: "/card-meal-planning.jpg",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
        <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
  {
    title: "Shopping Lists",
    description: "Select the recipes you're cooking and instantly generate a combined shopping list. Check items off as you shop.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
        <path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
      </svg>
    ),
  },
  {
    title: "Event Menus",
    description: "Planning a birthday braai or holiday dinner? Create an event menu, assign dishes to family members, and track who's accepted.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
        <path d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
  },
  {
    title: "Tips & Tricks",
    description: "Share kitchen wisdom with your family. Pin tips to specific recipes so they appear right when they're needed.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
        <path d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
      </svg>
    ),
  },
];

// Branded "title card" — the dark green back design. Reused as the standalone
// fallback when a card has no preview, and as the intro overlay over a video.
function BackPlaceholder({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-terracotta via-charcoal to-sage p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cream text-terracotta">
        {icon}
      </div>
      <p className="mt-5 font-serif text-xl text-cream">{title}</p>
    </div>
  );
}

// Video back with a clean title-card sequence: placeholder shows alone, then
// disappears, then the video plays. On loop (video ends), pause and replay
// the same sequence. No fade-overlay — a hard handoff between the two states.
function VideoBack({
  src,
  placeholder,
  flipped,
}: {
  src: string;
  placeholder: ReactNode;
  flipped: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showIntro, setShowIntro] = useState(true);

  // On flip-to-back: reset, hold placeholder for ~600ms, then start the video.
  // On flip-to-front: pause and reset (next flip starts the sequence over).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!flipped) {
      video.pause();
      return;
    }
    video.pause();
    video.currentTime = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: show intro on each flip-to-back
    setShowIntro(true);
    const t = setTimeout(() => {
      setShowIntro(false);
      void video.play().catch(() => {});
    }, 700);
    return () => clearTimeout(t);
  }, [flipped]);

  // No `loop` attribute on the video — handle the loop ourselves so each cycle
  // shows the title card again before the video restarts.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    function onEnded() {
      if (!video) return;
      video.currentTime = 0;
      setShowIntro(true);
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        setShowIntro(false);
        void video.play().catch(() => {});
      }, 1500);
    }
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("ended", onEnded);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        muted
        playsInline
        aria-hidden="true"
        className="h-full w-full object-cover"
      />
      {showIntro && <div className="intro-fade absolute inset-0 z-10">{placeholder}</div>}
    </>
  );
}

function FeatureCard({
  feature,
  flipped,
  onToggle,
}: {
  feature: (typeof FEATURES)[number];
  flipped: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      aria-label={`${feature.title} — tap to flip for a preview`}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className={`flip-card group cursor-pointer ${flipped ? "aspect-[9/16] is-flipped" : "aspect-square"}`}
    >
      <div className="flip-card-inner">
          {/* Front — always wears the dark green treatment so the cards read as a
              uniform set; backImage / frontImage simply sandwich underneath the gradient. */}
          <div className="flip-card-face isolate overflow-hidden rounded-2xl bg-terracotta-dark p-6 ring-1 ring-terracotta/30 transition-shadow duration-300 group-hover:shadow-lg group-hover:ring-terracotta/50">
            {feature.frontImage && (
              <Image
                src={feature.frontImage}
                alt=""
                aria-hidden="true"
                fill
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="-z-10 object-cover"
              />
            )}
            {/* Green fade — readable text up top, image (where present) shows through below. */}
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-charcoal/80 via-terracotta-dark/85 to-terracotta/55" />
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cream text-terracotta transition-transform duration-300 group-hover:scale-110">
              {feature.icon}
            </div>
            <h3 className="mt-4 font-serif text-lg font-bold text-cream">{feature.title}</h3>
            <p className="mt-2 font-sans text-sm leading-relaxed text-cream/85">
              {feature.description}
            </p>
            <span className="absolute bottom-4 right-4 font-sans text-[10px] uppercase tracking-wider text-cream/60">
              Tap to preview
            </span>
          </div>
          {/* Back */}
          <div className="flip-card-face flip-card-back overflow-hidden rounded-2xl bg-charcoal ring-1 ring-cream-dark/20">
            {feature.backVideo ? (
              <VideoBack
                src={feature.backVideo}
                flipped={flipped}
                placeholder={<BackPlaceholder icon={feature.icon} title={feature.title} />}
              />
            ) : feature.backImage ? (
              <div className="relative h-full w-full">
                <Image
                  src={feature.backImage}
                  alt={`${feature.title} preview`}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
            ) : (
              <BackPlaceholder icon={feature.icon} title={feature.title} />
            )}
            <span className="absolute bottom-3 right-3 rounded-md bg-charcoal/60 px-2 py-1 font-sans text-[10px] uppercase tracking-wider text-cream/80">
              Tap to flip back
            </span>
          </div>
        </div>
      </div>
  );
}

export default function LandingPage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  // Only one feature card can be flipped open at a time, to avoid visual chaos
  // (multiple videos playing, multiple title cards) when the grid is busy.
  const [flippedFeature, setFlippedFeature] = useState<string | null>(null);

  // Detect the visitor's country (Vercel edge header) and swap to their currency.
  // Default USD holds until the fetch resolves; SA visitors swap to ZAR moments later.
  useEffect(() => {
    fetch("/api/geo")
      .then((r) => r.json())
      .then((d: { currency?: string }) => {
        if (d.currency && d.currency in PLAN_PRICES) {
          setCurrency(d.currency as CurrencyCode);
        }
      })
      .catch(() => {
        /* keep default */
      });
  }, []);

  const price = PLAN_PRICES[currency];

  return (
    <div className="min-h-screen bg-cream">
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-charcoal py-24 sm:py-32 md:py-40">
        {/* Background video */}
        <video
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        >
          <source src="/landing-hero.mp4" type="video/mp4" />
        </video>
        {/* Dark scrim so the headline stays readable over the video */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-charcoal/75 via-charcoal/55 to-charcoal/75" />
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <Image
            src="/logo.png"
            alt="Logo"
            width={160}
            height={160}
            className="reveal-pop mx-auto h-40 w-40 rounded-full shadow-md"
            style={{ animationDelay: "1.1s" }}
          />
          <h1 className="mt-6 font-serif text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
            <span className="block">
              {["Your", "family’s", "recipes,"].map((word, i) => (
                <span
                  key={word}
                  className="reveal-word"
                  style={{ animationDelay: `${0.1 + i * 0.08}s`, marginRight: "0.25em" }}
                >
                  {word}
                </span>
              ))}
            </span>
            <span className="block">
              {["all", "in", "one", "place"].map((word, i) => (
                <span
                  key={word}
                  className="reveal-word"
                  style={{ animationDelay: `${0.4 + i * 0.08}s`, marginRight: "0.25em" }}
                >
                  {word}
                </span>
              ))}
            </span>
          </h1>
          <p
            className="reveal mt-6 mx-auto max-w-2xl font-sans text-lg leading-relaxed text-cream/90"
            style={{ animationDelay: "0.85s" }}
          >
            Cooking together is one of the most human things we do. A private family cookbook to keep your recipes alive, cook them together even when you&rsquo;re apart, and gather everyone around the table again.
          </p>
          <div
            className="reveal mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            style={{ animationDelay: "1.7s" }}
          >
            <Link
              href="/auth"
              className="rounded-xl bg-terracotta px-8 py-3.5 font-sans text-base font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-terracotta-dark hover:shadow-lg"
            >
              Get Started Free
            </Link>
            <Link
              href="/auth"
              className="rounded-xl bg-white px-8 py-3.5 font-sans text-base font-semibold text-charcoal shadow-sm ring-1 ring-cream-dark/40 transition-all duration-200 hover:-translate-y-0.5 hover:bg-cream-dark/20 hover:shadow-md"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-center font-serif text-3xl font-bold text-charcoal sm:text-4xl">
              How it works
            </h2>
            <p className="mt-4 text-center font-sans text-sm text-slate max-w-2xl mx-auto">
              From empty kitchen to family cookbook in three steps.
            </p>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {HOW_IT_WORKS.map((s, i) => (
              <Reveal key={s.step} delay={i * 0.1}>
                <div className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-terracotta font-serif text-xl font-bold text-white">
                    {s.step}
                  </div>
                  <h3 className="mt-4 font-serif text-lg font-bold text-charcoal">{s.title}</h3>
                  <p className="mt-2 font-sans text-sm leading-relaxed text-slate">{s.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-warm-white py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-center font-serif text-3xl font-bold text-charcoal sm:text-4xl">
              Everything your family kitchen needs
            </h2>
            <p className="mt-4 text-center font-sans text-sm text-slate max-w-2xl mx-auto">
              More than just a recipe book. Plan, shop, cook, and share — together.
            </p>
          </Reveal>
          <div className="mt-14 grid grid-cols-1 items-start gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <FeatureCard
                key={feature.title}
                feature={feature}
                flipped={flippedFeature === feature.title}
                onToggle={() =>
                  setFlippedFeature((current) => (current === feature.title ? null : feature.title))
                }
              />
            ))}
          </div>
        </div>
      </section>

      {/* App showcase */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-center font-serif text-3xl font-bold text-charcoal sm:text-4xl">
              Beautiful, and built for the kitchen
            </h2>
            <p className="mt-4 text-center font-sans text-sm text-slate max-w-2xl mx-auto">
              Big photos, clear steps, and a layout that works whether you&rsquo;re planning on the couch or cooking at the stove.
            </p>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2">
            <Reveal>
              <figure>
                <div className="relative h-[480px] overflow-hidden rounded-2xl shadow-xl ring-1 ring-cream-dark/30 sm:h-[560px]">
                  <div className="h-full overflow-y-auto overflow-x-hidden bg-cream-dark/10">
                    <Image
                      src="/showcase-home-page.png"
                      alt="The home page of A Fish in the Kitchen"
                      width={1436}
                      height={1881}
                      className="h-auto w-full"
                    />
                  </div>
                  {/* Soft bottom fade hints "more to scroll." */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-cream/90 to-transparent" />
                </div>
                <figcaption className="mt-3 text-center font-sans text-xs uppercase tracking-wider text-slate/60">
                  Home
                </figcaption>
              </figure>
            </Reveal>
            <Reveal delay={0.1}>
              <figure>
                <div className="relative h-[480px] overflow-hidden rounded-2xl shadow-xl ring-1 ring-cream-dark/30 sm:h-[560px]">
                  <div className="h-full overflow-y-auto overflow-x-hidden bg-cream-dark/10">
                    <Image
                      src="/showcase-recipe-page.png"
                      alt="A recipe page in A Fish in the Kitchen"
                      width={863}
                      height={1680}
                      className="h-auto w-full"
                    />
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-cream/90 to-transparent" />
                </div>
                <figcaption className="mt-3 text-center font-sans text-xs uppercase tracking-wider text-slate/60">
                  Recipe page
                </figcaption>
              </figure>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-warm-white py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-center font-serif text-3xl font-bold text-charcoal sm:text-4xl">
              One simple plan
            </h2>
            <p className="mt-4 text-center font-sans text-sm text-slate max-w-2xl mx-auto">
              Start with a 14-day free trial. One subscription covers your whole family.
            </p>
            <div className="mt-8 flex items-center justify-center">
              <div className="inline-flex rounded-full bg-cream-dark/30 p-1">
                <button
                  type="button"
                  onClick={() => setBilling("monthly")}
                  className={`rounded-full px-5 py-1.5 font-sans text-sm font-medium transition-colors cursor-pointer ${
                    billing === "monthly" ? "bg-white text-charcoal shadow-sm" : "text-slate"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBilling("annual")}
                  className={`rounded-full px-5 py-1.5 font-sans text-sm font-medium transition-colors cursor-pointer ${
                    billing === "annual" ? "bg-white text-charcoal shadow-sm" : "text-slate"
                  }`}
                >
                  Annual <span className="text-terracotta">· 2 months free</span>
                </button>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1} className="mt-10">
            <div className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow-xl ring-1 ring-cream-dark/30">
              <p className="font-serif text-xl font-bold text-charcoal">Family Plan</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-serif text-5xl font-bold text-charcoal">
                  {price.prefix}
                  {billing === "monthly" ? price.monthly : price.annual}
                </span>
                <span className="font-sans text-sm text-slate">
                  /{billing === "monthly" ? "month" : "year"}
                </span>
              </div>
              <p className="mt-1 font-sans text-xs text-slate/60">
                14-day free trial, then billed {billing} in {currency}. Cancel anytime.
              </p>
              <ul className="mt-6 space-y-3">
                {PLAN_PERKS.map((perk) => (
                  <li key={perk} className="flex items-start gap-2.5 font-sans text-sm text-charcoal">
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="mt-0.5 h-5 w-5 flex-shrink-0 text-terracotta"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 5.29a.75.75 0 0 1 .006 1.06l-7.5 7.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 1 1 1.06-1.06l2.97 2.97 6.97-6.97a.75.75 0 0 1 1.054 0Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {perk}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth"
                className="mt-8 block rounded-xl bg-terracotta px-8 py-3.5 text-center font-sans text-base font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-terracotta-dark hover:shadow-lg"
              >
                Start your free trial
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-center font-serif text-3xl font-bold text-charcoal sm:text-4xl">
              Questions, answered
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="mt-10 overflow-hidden rounded-2xl bg-white ring-1 ring-cream-dark/30">
            <div className="divide-y divide-cream-dark/40">
              {FAQS.map((faq, i) => (
                <div key={faq.q}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left cursor-pointer"
                    aria-expanded={openFaq === i}
                  >
                    <span className="font-sans text-sm font-semibold text-charcoal">{faq.q}</span>
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className={`h-5 w-5 flex-shrink-0 text-slate transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                  {openFaq === i && (
                    <p className="px-6 pb-4 font-sans text-sm leading-relaxed text-slate">{faq.a}</p>
                  )}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Mission — the thesis, then the personal origin; link out to /our-story. */}
      <section className="bg-warm-white py-16 sm:py-20">
        <Reveal className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <p className="font-sans text-xs uppercase tracking-[0.2em] text-terracotta">Why this exists</p>
          <p className="mt-5 font-serif text-2xl italic leading-snug text-charcoal sm:text-3xl">
            Sharing food is one of the most human things we do &mdash; and phones at the table are quietly pulling us away from it.
          </p>
          <p className="mx-auto mt-6 max-w-xl font-sans text-base leading-relaxed text-charcoal/80">
            The flavours and smells of your childhood stay with you for life. This is a small way back to the table: keep your family&rsquo;s recipes alive, cook them together &mdash; even from far apart &mdash; and gather around them again.
          </p>
          <p className="mt-6 font-sans text-sm italic text-slate">
            Six years ago I moved 8,000 km from my parents. My daughter asked her grandfather to write his recipes down for her &mdash; and that became this app.
          </p>
          <Link
            href="/our-story"
            className="mt-7 inline-flex items-center gap-1 font-sans text-sm font-semibold text-terracotta transition-colors hover:text-terracotta-dark"
          >
            Read our story &rarr;
          </Link>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-24">
        <Reveal className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="font-serif text-3xl font-bold text-charcoal sm:text-4xl">
            Start your family cookbook today
          </h2>
          <p className="mt-4 font-sans text-sm text-slate">
            Start with a 14-day free trial. Cancel anytime. Invite your whole family.
          </p>
          <Link
            href="/auth"
            className="mt-8 inline-block rounded-xl bg-terracotta px-8 py-3.5 font-sans text-base font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-terracotta-dark hover:shadow-lg"
          >
            Create Your Cookbook
          </Link>
        </Reveal>
      </section>
    </div>
  );
}
