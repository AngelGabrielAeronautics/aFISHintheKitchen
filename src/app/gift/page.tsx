import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import StoreBadges from "@/components/StoreBadges";
import { PLAN_PRICES, currencyForCountry } from "@/lib/prices";

// "Gift a cookbook" — the marketing page for gifting.
//
// ⚠ THE VERB IS GIFT, not "give", everywhere the product names the action.
// Dylan's call (2026-08-13): one word for one thing, on the web, in both apps
// and in both store listings.
//
// ⚠ THIS PAGE CANNOT SELL ANYTHING, and that is not a limitation to design
// around — it is the rule. App Review guideline 3.1.1, verbatim: "Digital gift
// cards, certificates, vouchers, and coupons which can be redeemed for digital
// goods or services can only be sold in your app using in-app purchase." So the
// job here is to explain the gift and walk the buyer into the app, where the
// purchase actually happens.
//
// (Selling here was never open to us anyway: Stripe is blocked for Jersey,
// which is the reason billing went native in the first place.)
//
// ⚠ Built to the LANDING PAGE'S visual language rather than its own — the
// alternating cream/warm-white bands, a terracotta uppercase eyebrow per
// section, serif headings, terracotta numbered circles for steps and terracotta
// ticks for lists. It was a plain single column before and read as a different
// site to the page that links to it.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gift a cookbook — A Fish in the Kitchen",
  description:
    "Gift someone a year of their own family cookbook — and add a copy of yours with it.",
};

const WHAT_THEY_GET = [
  "Their own cookbook app for their recipes — keep them, cook hands-free at the stove, plan the week, share a shopping list",
  "They can share their cookbook with five of their friends or family",
  "A full year, already paid for — and they never get access to yours",
  "Optionally, a copy of your whole cookbook: every recipe and kitchen tip",
];

const STEPS = [
  {
    step: 1,
    title: "Get the app",
    body: "Open More → Gift a year. You'll need an account, but not a subscription of your own.",
  },
  {
    step: 2,
    title: "Say who it's for",
    body: "Their name and email, a note if you'd like, and whether to add a copy of your recipes.",
  },
  {
    step: 3,
    title: "Pick the day",
    body: "Today, or the morning of the wedding — we hold it until then.",
  },
  {
    step: 4,
    title: "We send the card",
    body: "They get a card with a code. You get a copy too, so you always have it.",
  },
];

const WORTH_KNOWING = [
  "The code only works once, and it doesn't expire.",
  "If they haven't claimed it after a week we remind them, and we let you know if it's still sitting there.",
  "At the end of the year nothing is deleted — their cookbook stays theirs, and they choose whether to carry on.",
  "You need your own cookbook to add a copy of it, but not to gift the year.",
];

/** The landing's pricing tick, so the two pages mark a list the same way. */
function Tick() {
  return (
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
  );
}

export default async function GiftPage() {
  // Vercel resolves the visitor's country at the edge; currencyForCountry falls
  // back to USD. Never a bare number with no currency.
  const country = (await headers()).get("x-vercel-ip-country")?.toUpperCase() ?? "GB";
  const plan = PLAN_PRICES[currencyForCountry(country)];
  const price = `${plan.prefix}${plan.gift}`;

  return (
    <main className="min-h-screen bg-cream">
      {/* Hero */}
      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Image
            src="/gift-logo.png"
            alt=""
            width={600}
            height={575}
            priority
            className="mx-auto mb-8 h-auto w-56 max-w-full"
          />
          <p className="font-sans text-sm font-semibold uppercase tracking-widest text-terracotta">
            Gift a cookbook
          </p>
          {/* Dylan's heading, word for word with the landing section. */}
          <h1 className="mt-3 font-serif text-4xl font-bold text-charcoal sm:text-5xl">
            Give A Fish in the Kitchen, as a gift
          </h1>
          {/* ⚠ Dylan's copy, word for word with the landing and both apps. The
              cookbook clause is bold in all four places: it is the part people
              are actually buying, and the closing line says so outright. */}
          <p className="mx-auto mt-5 max-w-xl font-sans text-lg leading-relaxed text-slate">
            Buy someone a year of their own cookbook — for a wedding, a kitchen tea, a first
            flat. It&rsquo;s theirs outright, with room to invite their own family in.{" "}
            <strong className="text-charcoal">
              And you can choose to add a copy of your whole cookbook with it
            </strong>
            , so they start with a copy of your recipe book and your tips &amp; tricks. This
            arguably is the real gift!
          </p>

          <p className="mt-10 font-serif text-5xl font-bold text-charcoal">{price}</p>
          <p className="mx-auto mt-2 max-w-md font-sans text-sm text-slate">
            You pay once and are never charged again. When their year is up they decide whether
            to carry on themselves — nothing is deleted either way.
          </p>
          <div className="mt-8 flex justify-center">
            <StoreBadges />
          </div>
          <p className="mt-3 font-sans text-sm text-slate">
            Gifts are bought in the app, on iPhone or Android.
          </p>
        </div>
      </section>

      {/* What they get */}
      <section className="bg-warm-white px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl">
          <p className="text-center font-sans text-sm font-semibold uppercase tracking-widest text-terracotta">
            The gift
          </p>
          <h2 className="mt-3 text-center font-serif text-3xl font-bold text-charcoal sm:text-4xl">
            What they get
          </h2>
          <ul className="mt-10 space-y-4">
            {WHAT_THEY_GET.map((item) => (
              <li key={item} className="flex items-start gap-3 font-sans text-base text-charcoal">
                <Tick />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works — the landing's numbered circles, so the two read as one site */}
      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <p className="text-center font-sans text-sm font-semibold uppercase tracking-widest text-terracotta">
            Four steps
          </p>
          <h2 className="mt-3 text-center font-serif text-3xl font-bold text-charcoal sm:text-4xl">
            How gifting works
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.step} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-terracotta font-serif text-xl font-bold text-warm-white">
                  {s.step}
                </div>
                <h3 className="mt-4 font-serif text-lg font-bold text-charcoal">{s.title}</h3>
                <p className="mt-2 font-sans text-sm leading-relaxed text-slate">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Worth knowing */}
      <section className="bg-warm-white px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl">
          <p className="text-center font-sans text-sm font-semibold uppercase tracking-widest text-terracotta">
            Before you do
          </p>
          <h2 className="mt-3 text-center font-serif text-3xl font-bold text-charcoal sm:text-4xl">
            Worth knowing
          </h2>
          <ul className="mt-10 space-y-4">
            {WORTH_KNOWING.map((item) => (
              <li key={item} className="flex items-start gap-3 font-sans text-base text-slate">
                <Tick />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Closing CTA — mirrors the landing's final band */}
      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-3xl font-bold text-charcoal sm:text-4xl">
            Gift the recipes they grew up on
          </h2>
          <p className="mt-4 font-sans text-base text-slate">
            {price}, once. Bought in the app, on iPhone or Android.
          </p>
          <div className="mt-8 flex justify-center">
            <StoreBadges />
          </div>
        </div>
      </section>
    </main>
  );
}
