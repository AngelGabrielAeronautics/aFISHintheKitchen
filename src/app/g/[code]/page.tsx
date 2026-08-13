import type { Metadata } from "next";
import Link from "next/link";
import { getAdminDb } from "@/lib/firebase-admin";
import StoreBadges from "@/components/StoreBadges";
import { formatGiftCode, normaliseGiftCode } from "@/lib/gift";

// Where a gift card's "Open your gift" button lands.
//
// ⚠ The recipient has almost certainly never heard of us — they were given
// this by a friend. The page has one job: say what the gift is, make clear the
// cookbook will be THEIRS, and get them to the app with the code in hand.
//
// ⚠ It must NOT ask them to sign in here. The web app is gated off at launch
// (see proxy.ts) and redemption happens in the app after sign-up, where a
// household exists to attach the year to.
//
// Token-only and noindex — a gift code is a bearer token, and a search engine
// indexing one would hand a stranger somebody's present.

export const dynamic = "force-dynamic";

async function loadGift(rawCode: string) {
  const code = normaliseGiftCode(rawCode);
  if (!code) return null;
  const snap = await getAdminDb().collection("gifts").doc(code).get();
  if (!snap.exists) return null;
  const g = snap.data()!;
  // Only what the page needs. The recipient's email and the store transaction
  // are none of a page visitor's business, even holding a valid code.
  return {
    code,
    fromName: (g.purchasedByName as string) ?? "",
    recipientName: (g.recipientName as string) ?? "",
    message: (g.message as string) ?? "",
    status: (g.status as string) ?? "unredeemed",
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const gift = await loadGift(code);
  // ⚠ noindex on EVERY branch, including not-found. The URL contains the code.
  const robots = { index: false, follow: false };
  if (!gift) return { title: "Gift not found", robots };
  return {
    title: gift.fromName
      ? `${gift.fromName} has given you a year of A Fish in the Kitchen`
      : "A gift: a year of A Fish in the Kitchen",
    description: "Your own private family cookbook, for a year.",
    robots,
  };
}

export default async function GiftPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const gift = await loadGift(code);

  if (!gift) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="font-serif text-3xl font-bold text-charcoal">
            We couldn&rsquo;t find that gift
          </h1>
          <p className="mt-3 font-sans text-slate">
            Check the link in your email — it&rsquo;s easy to lose a character when a link
            gets forwarded.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-lg bg-terracotta px-6 py-3 font-sans text-sm font-semibold text-white"
          >
            Visit A Fish in the Kitchen
          </Link>
        </div>
      </main>
    );
  }

  if (gift.status === "redeemed") {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="font-serif text-3xl font-bold text-charcoal">
            This gift has been claimed
          </h1>
          <p className="mt-3 font-sans text-slate">
            It&rsquo;s already on an account — open the app and sign in to find your cookbook.
          </p>
          <div className="mt-6 flex justify-center">
            <StoreBadges />
          </div>
        </div>
      </main>
    );
  }

  if (gift.status === "revoked") {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="font-serif text-3xl font-bold text-charcoal">
            This gift is no longer available
          </h1>
          <p className="mt-3 font-sans text-slate">
            The purchase was refunded. If that&rsquo;s a surprise, the person who sent it will
            know more.
          </p>
        </div>
      </main>
    );
  }

  const to = gift.recipientName.trim();

  return (
    <main className="min-h-screen bg-cream">
      <div className="mx-auto max-w-xl px-6 py-14 text-center">
        <p className="font-sans text-sm font-semibold uppercase tracking-widest text-terracotta">
          A gift
        </p>
        <h1 className="mt-3 font-serif text-4xl font-bold text-charcoal">
          {/* ⚠ A real \u2019, not &rsquo;. These are JS strings, not JSX text —
              React escapes them, so an HTML entity here renders as the literal
              characters "&rsquo;" on the page. Entities only decode in JSX text
              nodes, which is why they are correct everywhere else in this file. */}
          {to ? `${to}, you\u2019ve been given a year` : "You\u2019ve been given a year"}
        </h1>
        {gift.fromName && (
          <p className="mt-2 font-sans text-base text-slate">from {gift.fromName}</p>
        )}

        {gift.message && (
          <blockquote className="mt-8 rounded-xl bg-warm-white p-5 text-left font-sans text-base italic text-slate">
            &ldquo;{gift.message}&rdquo;
          </blockquote>
        )}

        <div className="mt-10 rounded-xl bg-white p-6 shadow-sm ring-1 ring-charcoal/5">
          <p className="font-sans text-sm text-slate">Your gift code</p>
          <p className="mt-2 font-mono text-2xl font-bold tracking-[0.2em] text-charcoal">
            {formatGiftCode(gift.code)}
          </p>
        </div>

        <section className="mt-10 text-left">
          <h2 className="font-serif text-2xl font-bold text-charcoal">What you&rsquo;ve been given</h2>
          <p className="mt-3 font-sans text-base text-slate">
            A Fish in the Kitchen is a private cookbook for your family&rsquo;s recipes —
            somewhere to keep them, cook them hands-free at the stove with step timers, plan
            the week, and share a shopping list.
          </p>
          {/* The single most important sentence on the page. The natural
              assumption on being sent a link like this is that you're being
              added to somebody else's cookbook, which is exactly what this is
              not. */}
          <p className="mt-3 font-sans text-base text-slate">
            The cookbook will be <strong className="text-charcoal">yours</strong> — your own,
            private, and you can invite five people of your own into it. A full year, already
            paid for.
          </p>
        </section>

        <section className="mt-10 text-left">
          <h2 className="font-serif text-2xl font-bold text-charcoal">How to claim it</h2>
          <ol className="mt-3 space-y-2 font-sans text-base text-slate">
            <li>1. Download the app.</li>
            <li>2. Sign up and set up your cookbook.</li>
            <li>3. Enter the code above when it asks — or tap this link again on your phone.</li>
          </ol>
          <div className="mt-6 flex justify-center">
            <StoreBadges />
          </div>
        </section>
      </div>
    </main>
  );
}
