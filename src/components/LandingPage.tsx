"use client";

import Link from "next/link";
import Image from "next/image";
import Reveal from "@/components/Reveal";

const FEATURES = [
  {
    title: "Family Recipes",
    description: "Collect and organise your family's best recipes in one beautiful place. Add photos, videos, ingredients, and step-by-step instructions.",
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

export default function LandingPage() {
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
            Collect your family&rsquo;s best recipes, plan meals together, assign dishes for gatherings, and cook with step-by-step guidance. A private cookbook built for families who love food.
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
          <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, i) => (
              <Reveal key={feature.title} delay={i * 0.08}>
                <div className="group h-full rounded-2xl bg-cream/60 p-6 ring-1 ring-cream-dark/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:ring-terracotta/20">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-terracotta/10 text-terracotta transition-transform duration-300 group-hover:scale-110">
                    {feature.icon}
                  </div>
                  <h3 className="mt-4 font-serif text-lg font-bold text-charcoal">
                    {feature.title}
                  </h3>
                  <p className="mt-2 font-sans text-sm leading-relaxed text-slate">
                    {feature.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-24">
        <Reveal className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="font-serif text-3xl font-bold text-charcoal sm:text-4xl">
            Start your family cookbook today
          </h2>
          <p className="mt-4 font-sans text-sm text-slate">
            Free to start. No credit card required. Invite your whole family.
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
