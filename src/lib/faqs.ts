/**
 * The FAQ, once — used by the landing page AND the full /faq page.
 *
 * ⚠ THIS LIST EXISTS FOUR TIMES: here, in the iOS LandingView, and in the
 * Android LandingScreen. It has drifted before by being edited in one place,
 * so `scripts/check-faq-parity.mjs` diffs them and CI-style fails if they
 * disagree. Change the wording here, then mirror it in both apps and re-run
 * that script.
 *
 * `landing` marks the questions worth showing on the marketing page. The rest
 * still live on /faq — the landing page had grown to thirteen accordion rows,
 * which is a wall, not an answer.
 */
export interface Faq {
  q: string;
  a: string;
  /** Shown on the landing page / app landing screen as well as /faq. */
  landing?: true;
}

export const FAQS: Faq[] = [
  {
    q: "Is my cookbook private?",
    a: "Completely. Only you and the family members you invite can see your recipes — it's never public or searchable.",
    landing: true,
  },
  {
    q: "How many people can I invite?",
    a: "Up to 5 family members or friends, free for them. They can add recipes, plan meals, and cook right alongside you.",
    landing: true,
  },
  {
    q: "What if my family is bigger than 5?",
    a: "Your plan covers you plus 5 members. Need more? Tap “Notify me” in the app and we'll let you know as soon as extra seats are available.",
  },
  {
    q: "Do my family members pay?",
    a: "No. Only you, the cookbook owner, subscribe. Everyone you invite uses the app for free.",
    landing: true,
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel whenever you like and you'll keep full access until the end of your billing period.",
    landing: true,
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
    landing: true,
  },
  // ── Gifting ──
  // ⚠ Every answer here is checked against what the code actually does, not
  // what the marketing implies. Getting a gifting FAQ wrong is expensive: these
  // are the questions somebody asks with their card already in their hand.
  {
    q: "How does gifting work?",
    a: "Buy it in the app under More → Gift a year. We email them a card with a code on the day you choose, and you get a copy too. They redeem it in the app and the year lands on their own cookbook.",
    landing: true,
  },
  {
    q: "Does a gift renew?",
    a: "No. You pay once and are never charged again. When their year is up they decide for themselves whether to carry on — and nothing is deleted either way, so their cookbook is still there if they do.",
  },
  {
    q: "Can I send them my recipes too?",
    a: "Yes, if you own a cookbook. Tick “Include my recipes” and they start with a copy of your whole cookbook — every recipe and kitchen tip, with who contributed each one kept intact. Yours is untouched, and they never get access to it.",
  },
  {
    q: "What if they never claim it?",
    a: "The code doesn't expire, so it keeps. We remind them after a week, and if it's still sitting there after three we let you know — usually it's a mistyped address or a spam folder, and you can send the code on yourself.",
  },
  {
    q: "Can I join more than one cookbook?",
    a: "Yes — you can be a free member of up to 3 other families' cookbooks, on top of your own. Use the same email address you already sign in with when you accept the invitation: that is what keeps every cookbook under one login. A different address creates a second, separate account, and the two cannot see each other. Once you are in more than one, tap More, then Switch cookbook — it appears just under your name — to move between them.",
  },
  {
    q: "How do I switch between cookbooks?",
    a: "Tap More, then Switch cookbook — it appears just under your name as soon as you belong to more than one. Your recipes, meal plan and shopping list all follow whichever cookbook you are in.",
  },
];
