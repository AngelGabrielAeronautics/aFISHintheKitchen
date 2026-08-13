"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import Reveal from "@/components/Reveal";
import StoreBadges from "@/components/StoreBadges";
import ScanToDownload from "@/components/ScanToDownload";

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
    description: "Add recipes, plan meals, assign dishes for gatherings, and follow along in step-by-step cooking mode.",
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

// The actual prices Apple charges, read off each storefront's own product page
// (id6780944935) on 29 July 2026 — not converted, not estimated.
//
// ⚠ These must match StoreKit, because this page is where someone decides to
// trust us and the App Store is where they're charged. The previous values were
// pre-billing guesses ("refine when payment provider is wired") and were never
// refined: the site advertised R99 while South Africans were charged R119.99,
// and £4.99 while the UK was charged £5.99 — both about a fifth under, in the
// two markets this app actually has.
//
// Apple sets these from its own price tiers, so they don't track FX and they
// change when Apple adjusts a tier. If you change the tier in App Store
// Connect, change it here in the same sitting.
// ⚠ `gift` is a ONE-OFF purchase of a year, priced to match the annual
// subscription — and quoted at APPLE's tier, which is what the rest of this
// table already uses.
//
// ⚠ The two stores do NOT charge the same. Play's own regional table puts the
// GB annual at £53.99 where Apple's tier is £59.99. Quoting the HIGHER of the
// two is deliberate: the documented failure of this table was under-quoting
// (the site said £4.99 while the UK was charged £5.99), and a Play buyer
// pleasantly surprised is a far better outcome than an Apple buyer who feels
// misled at checkout.
export type CurrencyCode = "ZAR" | "USD" | "GBP" | "EUR" | "AUD";
export const PLAN_PRICES: Record<
  CurrencyCode,
  { prefix: string; monthly: string; annual: string; gift: string }
> = {
  ZAR: { prefix: "R", monthly: "119.99", annual: "1,199.99", gift: "1,199.99" },
  USD: { prefix: "$", monthly: "5.99", annual: "59.99", gift: "59.99" },
  GBP: { prefix: "£", monthly: "5.99", annual: "59.99", gift: "59.99" },
  EUR: { prefix: "€", monthly: "6.99", annual: "69.99", gift: "69.99" },
  AUD: { prefix: "A$", monthly: "9.99", annual: "99.99", gift: "99.99" },
};

/** What a gift buys, in place of the subscription perks. */
const GIFT_PERKS = [
  "A full year of their own private cookbook",
  "Theirs outright — they invite their own 5 people",
  "Optionally send a copy of your whole cookbook",
  "A card emailed on the day you choose",
  "One payment — it never renews",
];

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
    q: "What if my family is bigger than 5?",
    a: "Your plan covers you plus 5 members. Need more? Tap “Notify me” in the app and we'll let you know as soon as extra seats are available.",
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
    // A real customer asked this before buying (2026-08-09). The honest answer
    // is the whole ladder in lib/access.ts — full access to period end, a
    // week's grace, then read-only, locked at 30 days, kept for a year. "Your
    // recipes are safe" alone is the reassuring half of a true answer, and
    // they'd meet the rest at the worst possible moment.
    q: "What happens to my recipes if I cancel?",
    // "Paused", not "locked" — that is the word on the screen they'd actually
    // hit, and one vocabulary beats two. It also says what paused MEANS,
    // because "locked" left people imagining anything from a nag screen to
    // deletion.
    a: "Nothing is deleted. You keep full access to the end of the period you've paid for, and for a week after that. Your cookbook then becomes read-only — every recipe, photo and meal plan is still there to read and cook from, you just can't add or change anything.\n\nA month later it's paused: you can still sign in, but the recipes are hidden until you subscribe again. Paused, not deleted — we keep everything for a year, and subscribing puts it all back instantly, exactly as you left it. Anyone you invited sees the same, since it's one shared cookbook.",
  },
  {
    q: "What happens after the free trial?",
    a: "The 14-day trial is completely free — we won't charge you during it, and we'll email you a reminder before it ends. When it ends, your trial rolls into a paid subscription automatically, so your cookbook keeps working without a break. Not for you? Cancel any time before the trial ends and you won't be charged a cent.",
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
    description: "Collect your family's best recipes in one beautiful place — photos, videos, and step-by-step instructions. Share one with a link when someone asks for it.",
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
    description: "Full-screen steps, each with its own photo and just the ingredients that step needs. Timers keep running when you put the phone down, and the screen stays awake while you cook.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
        <path d="M15 11h.01M11 15h.01M16 16h.01M2 16l20 6-6-20A20 20 0 0 0 2 16" />
      </svg>
    ),
  },
  {
    title: "Meal Planning",
    description: "Plan the week's meals. Each member has their own plan, and you can see what everyone else is cooking.",
    frontImage: "/card-meal-planning.jpg",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
        <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
  {
    title: "Shopping Lists",
    description: "Pick the recipes you're cooking and instantly generate a combined shopping list. Check items off as you shop.",
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
  // The People tab — a whole fifth of the app the pitch had never mentioned,
  // and the most on-brand thing in it: a cookbook that knows who in the family
  // will actually eat the dish.
  {
    title: "Who Loves What",
    description: "Everyone gets a page — what they're good at, what they love, what they won't touch. Mark a recipe loved or tried, and the ones your family asks for most rise to the top.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
        <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
      </svg>
    ),
  },
  // The AI suite, which this section didn't mention at all — seven features
  // and the clearest reason to pick this over a notes app. Deliberately LAST:
  // the pitch is a family cookbook, not an AI product, and leading with it
  // would argue against the "phones at the table" thesis the page closes on.
  {
    title: "Add a Recipe in Seconds",
    description: "Photograph a page from a cookbook or a handwritten card, paste one you were sent, or just say what you fancy — AI reads it and fills in the form. You check it before it saves.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
        <path d="M3 8V5.25A2.25 2.25 0 0 1 5.25 3H8M16 3h2.75A2.25 2.25 0 0 1 21 5.25V8M21 16v2.75A2.25 2.25 0 0 1 18.75 21H16M8 21H5.25A2.25 2.25 0 0 1 3 18.75V16M7.5 9h9M7.5 12h9M7.5 15h5.25" />
      </svg>
    ),
  },
  {
    title: "A Hand in the Kitchen",
    description: "AI can restyle a dish photo, spot a step that uses something missing from the ingredients, and suggest tags. Suggestions only — nothing changes until you say so.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
        <path d="m15 4 1.2 2.8L19 8l-2.8 1.2L15 12l-1.2-2.8L11 8l2.8-1.2L15 4ZM6.5 12.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7L4 15l1.7-.8.8-1.7ZM13.5 10.5 4 20" />
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
  const [billing, setBilling] = useState<"monthly" | "annual" | "gift">("monthly");
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
          <div id="download" className="reveal mt-10 scroll-mt-24" style={{ animationDelay: "1.7s" }}>
            <StoreBadges />
            <p className="mt-4 text-center font-sans text-sm text-cream/90">
              Download the app to start your 14-day free trial.
            </p>
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
              More than a recipe book
            </h2>
            <p className="mt-4 text-center font-sans text-sm text-slate max-w-2xl mx-auto">
              Plan, shop, cook, and share your family&rsquo;s food — together.
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
              {billing === "gift"
                ? "Buy someone a year of their own cookbook. One payment, no renewal — and you can send a copy of your recipes with it."
                : "Start with a 14-day free trial. One subscription covers you plus up to 5 family members."}
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
                {/* ⚠ Third position, not a fourth card elsewhere on the page.
                    Somebody weighing up the price is exactly the person who
                    might be buying it for a wedding rather than themselves, and
                    this is the only place on the page where that thought is
                    already in their head. */}
                <button
                  type="button"
                  onClick={() => setBilling("gift")}
                  className={`rounded-full px-5 py-1.5 font-sans text-sm font-medium transition-colors cursor-pointer ${
                    billing === "gift" ? "bg-white text-charcoal shadow-sm" : "text-slate"
                  }`}
                >
                  Gift
                </button>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1} className="mt-10">
            <div className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow-xl ring-1 ring-cream-dark/30">
              <p className="font-serif text-xl font-bold text-charcoal">
                {billing === "gift" ? "Give a Year" : "Family Plan"}
              </p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-serif text-5xl font-bold text-charcoal">
                  {price.prefix}
                  {billing === "monthly"
                    ? price.monthly
                    : billing === "annual"
                      ? price.annual
                      : price.gift}
                </span>
                <span className="font-sans text-sm text-slate">
                  {billing === "monthly" ? "/month" : billing === "annual" ? "/year" : "one-off"}
                </span>
              </div>
              <p className="mt-1 font-sans text-xs text-slate/60">
                {billing === "gift"
                  ? `A single payment in ${currency}. It never renews, and it's separate from any subscription of your own.`
                  : `14-day free trial, then billed ${billing} in ${currency}. Cancel anytime.`}
              </p>
              <ul className="mt-6 space-y-3">
                {(billing === "gift" ? GIFT_PERKS : PLAN_PERKS).map((perk) => (
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
              {billing === "gift" && (
                <Link
                  href="/gift"
                  className="mt-8 block rounded-lg bg-terracotta px-6 py-3 text-center font-sans text-sm font-semibold text-white transition-colors hover:bg-terracotta-dark"
                >
                  How gifting works
                </Link>
              )}
              {/* ⚠ Badges either way: gifts are bought IN THE APP. Guideline
                  3.1.1 — digital vouchers redeemable for digital goods can only
                  be sold via in-app purchase, so this page can never check out. */}
              <StoreBadges className="mt-4" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Give it as a gift.
          ⚠ AFTER Pricing and before the FAQ. Gifting is a purchase decision, so
          it only makes sense once the reader knows what the thing costs — and
          putting it among the features would read as an upsell before they know
          what the app even is. Same ordering on both app landing screens. */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-6">
          <div className="flex flex-col items-center gap-10 md:flex-row md:gap-14">
            <Image
              src="/gift-logo.png"
              alt=""
              width={600}
              height={575}
              className="h-auto w-48 max-w-full shrink-0 md:w-64"
            />
            <div className="text-center md:text-left">
              <p className="font-sans text-sm font-semibold uppercase tracking-widest text-terracotta">
                Give a cookbook
              </p>
              <h2 className="mt-3 font-serif text-3xl font-bold text-charcoal md:text-4xl">
                The recipes they grew up on, as a gift
              </h2>
              <p className="mt-4 font-sans text-base leading-relaxed text-slate md:text-lg">
                Buy someone a year of their own cookbook — for a wedding, a kitchen tea, a first
                flat. It&rsquo;s theirs outright, with room to invite their own family in. And you
                can send a copy of your whole cookbook with it, so they start with every recipe
                they were raised on rather than an empty shelf.
              </p>
              <Link
                href="/gift"
                className="mt-6 inline-block rounded-lg bg-terracotta px-6 py-3 font-sans text-sm font-semibold text-white transition-colors hover:bg-terracotta-dark"
              >
                How gifting works
              </Link>
            </div>
          </div>
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
                  {/* whitespace-pre-line so a two-paragraph answer stays two
                      paragraphs — JSX collapses the newlines otherwise. */}
                  {openFaq === i && (
                    <p className="whitespace-pre-line px-6 pb-4 font-sans text-sm leading-relaxed text-slate">
                      {faq.a}
                    </p>
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
            A few years ago I moved away from my parents. My daughter asked her grandfather to write his recipes down for her &mdash; and that became this app.
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
            Bring your family together today
          </h2>
          <p className="mt-4 font-sans text-sm text-slate">
            Start with a 14-day free trial. Cancel anytime. Invite family members and friends.
          </p>
          <StoreBadges className="mt-8" />
          <ScanToDownload className="mt-8" />
        </Reveal>
      </section>
    </div>
  );
}
