import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import StoreBadges from "@/components/StoreBadges";
import { PLAN_PRICES, type CurrencyCode } from "@/components/LandingPage";

// "Gift a cookbook" — the marketing page for gifting.
//
// ⚠ The verb is GIFT, not "give", everywhere the product names the action.
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

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gift a cookbook — A Fish in the Kitchen",
  description:
    "Give someone a year of their own private family cookbook — and send a copy of yours with it.",
};

/**
 * ⚠ ONE price table for the whole site — the landing page's. A second copy
 * here quoted Play's GB price (£53.99) while the landing quoted Apple's
 * (£59.99), so the same visitor could read two different numbers two clicks
 * apart. That file already carries the warning about this table being wrong
 * once before; duplicating it was asking for the same failure twice.
 */
const COUNTRY_CURRENCY: Record<string, CurrencyCode> = {
  GB: "GBP", IE: "EUR", DE: "EUR", FR: "EUR", NL: "EUR", ES: "EUR", IT: "EUR",
  US: "USD", CA: "USD", ZA: "ZAR", AU: "AUD", NZ: "AUD",
};

export default async function GiftPage() {
  // Vercel resolves the visitor's country at the edge. Falls back to GB, the
  // home storefront — never to a bare number with no currency.
  const country = (await headers()).get("x-vercel-ip-country")?.toUpperCase() ?? "GB";
  const currency = COUNTRY_CURRENCY[country] ?? "GBP";
  const plan = PLAN_PRICES[currency];
  const price = `${plan.prefix}${plan.gift}`;

  return (
    <main className="min-h-screen bg-cream">
      <div className="mx-auto max-w-2xl px-6 py-14">
        <div className="text-center">
          <Image
            src="/gift-logo.png"
            alt=""
            width={600}
            height={575}
            priority
            className="mx-auto mb-6 h-auto w-56 max-w-full"
          />
          <p className="font-sans text-sm font-semibold uppercase tracking-widest text-terracotta">
            Gift a cookbook
          </p>
          <h1 className="mt-3 font-serif text-4xl font-bold text-charcoal">
            A year of their own family cookbook
          </h1>
          <p className="mx-auto mt-4 max-w-lg font-sans text-lg text-slate">
            For a wedding, a kitchen tea, a first flat — somewhere to keep the recipes they
            grew up on, before anyone forgets them.
          </p>
          <p className="mt-6 font-serif text-3xl font-bold text-charcoal">{price}</p>
          <p className="mt-1 font-sans text-sm text-slate">
            One payment. It doesn&rsquo;t renew, and it&rsquo;s separate from any subscription
            of your own. Your store shows the exact price before you pay.
          </p>
        </div>

        <section className="mt-12">
          <h2 className="font-serif text-2xl font-bold text-charcoal">What they get</h2>
          <ul className="mt-4 space-y-3 font-sans text-base text-slate">
            <li>
              <strong className="text-charcoal">Their own cookbook</strong> — private, theirs
              outright, with room to invite five people of their own into it. They never get
              access to yours, and you never get access to theirs.
            </li>
            <li>
              <strong className="text-charcoal">A full year</strong> — hands-free Cook Mode with
              step timers, the weekly meal planner, and a shared shopping list.
            </li>
            <li>
              {/* The part most people are actually buying. */}
              <strong className="text-charcoal">Your recipes, if you want</strong> — send a copy
              of your whole cookbook with it. Every recipe and kitchen tip, with who contributed
              each one kept intact. Yours stays exactly as it is.
            </li>
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-2xl font-bold text-charcoal">How it works</h2>
          <ol className="mt-4 space-y-3 font-sans text-base text-slate">
            <li>
              <strong className="text-charcoal">1.</strong> Get the app and open{" "}
              <strong className="text-charcoal">More → Gift a year</strong>.
            </li>
            <li>
              <strong className="text-charcoal">2.</strong> Enter their name and email, add a
              note, and choose whether to include your recipes.
            </li>
            <li>
              <strong className="text-charcoal">3.</strong> Pick the day it should arrive — today,
              or the morning of the wedding.
            </li>
            <li>
              <strong className="text-charcoal">4.</strong> We email them a card with a code. You
              get a copy too, so you always have it.
            </li>
          </ol>
          {/* ⚠ The only call to action on this page. The purchase happens in the
              app; sending them anywhere else to pay would breach 3.1.1. */}
          <div className="mt-8 flex justify-center">
            <StoreBadges />
          </div>
          <p className="mt-4 text-center font-sans text-sm text-slate">
            Gifts are bought in the app, on iPhone or Android.
          </p>
        </section>

        <section className="mt-12 rounded-xl bg-warm-white p-6">
          <h2 className="font-serif text-xl font-bold text-charcoal">Worth knowing</h2>
          <ul className="mt-3 space-y-2 font-sans text-sm text-slate">
            <li>The code only works once, and it doesn&rsquo;t expire.</li>
            <li>
              If they haven&rsquo;t claimed it after a week we remind them, and we let you know
              if it&rsquo;s still sitting there.
            </li>
            <li>
              At the end of the year nothing is deleted — their cookbook stays theirs, and they
              choose whether to carry on.
            </li>
            <li>
              You need your own cookbook to send a copy of it, but not to give the year.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
