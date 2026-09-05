import type { Metadata } from "next";
import Link from "next/link";
import { getAdminDb } from "@/lib/firebase-admin";
import { formatTime } from "@/lib/types";
import StoreBadges from "@/components/StoreBadges";

// Public shared-recipe page: the full recipe (the sharer MEANT to give it),
// wrapped in the family-cookbook story with app CTAs. Token-only + noindex —
// this is sharing, not publishing.

export const dynamic = "force-dynamic";

async function loadShare(token: string) {
  const snap = await getAdminDb().collection("sharedRecipes").doc(token).get();
  return snap.exists ? snap.data()! : null;
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const share = await loadShare(token);
  if (!share) return { title: "Recipe not found", robots: { index: false } };
  return {
    title: `${share.snapshot.title} — shared from ${share.bookName}`,
    description: share.snapshot.description,
    robots: { index: false, follow: false },
    openGraph: {
      title: share.snapshot.title,
      description: `A recipe from ${share.bookName}, shared with you on A Fish in the Kitchen.`,
      images: share.snapshot.image ? [share.snapshot.image] : [],
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function SharedRecipePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await loadShare(token);

  if (!share) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="font-serif text-3xl font-bold text-charcoal">This recipe link isn&rsquo;t available</h1>
          <p className="mt-3 font-sans text-slate">
            It may have been removed by the family that shared it.
          </p>
          <Link href="/" className="mt-6 inline-block rounded-lg bg-terracotta px-6 py-3 font-sans text-sm font-semibold text-warm-white">
            Visit A Fish in the Kitchen
          </Link>
        </div>
      </main>
    );
  }

  const r = share.snapshot;
  const headerLine = (line: string) => line.startsWith("## ");
  const stripHeader = (line: string) => line.replace(/^## /, "");

  return (
    <main className="min-h-screen bg-cream">
      {/* Who shared it — the human wrapper is the pitch */}
      <div className="bg-terracotta px-6 py-3 text-center">
        <p className="font-sans text-sm text-warm-white">
          <span className="font-semibold">{share.sharedByName}</span> shared a recipe with you from{" "}
          <span className="font-semibold">{share.bookName}</span>
        </p>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-10">
        {r.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.image} alt={r.title} className="w-full aspect-[4/3] object-cover rounded-2xl shadow-md" />
        )}
        <h1 className="mt-6 font-serif text-4xl font-bold text-charcoal">{r.title}</h1>
        <p className="mt-1 font-sans text-sm text-slate">
          by {r.contributedBy}
          {r.originalSource ? ` · original recipe by ${r.originalSource}` : ""}
        </p>
        {r.description && <p className="mt-4 font-sans text-base text-slate leading-relaxed">{r.description}</p>}
        {r.story && (
          <blockquote className="mt-4 border-l-4 border-terracotta/30 bg-warm-white/60 px-4 py-3 font-sans text-sm italic text-slate">
            {r.story}
          </blockquote>
        )}

        <div className="mt-6 flex flex-wrap gap-4 font-sans text-sm text-slate">
          <span>Prep: {formatTime(r.prepTime)}</span>
          <span>Cook: {r.noCook ? "None" : formatTime(r.cookTime)}</span>
          <span>Serves: {r.servings}</span>
          <span>{r.difficulty}</span>
        </div>

        <section className="mt-8">
          <h2 className="font-serif text-2xl font-bold text-charcoal">Ingredients</h2>
          <ul className="mt-3 space-y-2">
            {r.ingredients.map((ing: string, i: number) =>
              headerLine(ing) ? (
                <li key={i} className="pt-2 font-sans text-xs font-bold uppercase tracking-wide text-sage">
                  {stripHeader(ing)}
                </li>
              ) : (
                <li key={i} className="font-sans text-base text-charcoal">
                  • {ing}
                </li>
              )
            )}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="font-serif text-2xl font-bold text-charcoal">Method</h2>
          <ol className="mt-3 space-y-3">
            {(() => {
              let n = 0;
              return r.instructions.map((step: string, i: number) =>
                headerLine(step) ? (
                  <li key={i} className="pt-2 font-sans text-xs font-bold uppercase tracking-wide text-sage list-none">
                    {stripHeader(step)}
                  </li>
                ) : (
                  <li key={i} className="flex gap-3 font-sans text-base text-charcoal">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracotta text-sm font-bold text-warm-white">
                      {++n}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                )
              );
            })()}
          </ol>
        </section>

        {/* The pitch */}
        <section className="mt-12 rounded-2xl bg-warm-white p-8 text-center ring-1 ring-charcoal/5">
          <h3 className="font-serif text-2xl font-bold text-charcoal">
            This recipe lives in a family cookbook
          </h3>
          <p className="mt-3 font-sans text-sm text-slate leading-relaxed">
            A Fish in the Kitchen keeps a family&rsquo;s recipes together — the meals, the stories,
            and the people who cook them. Save this recipe to your own cookbook, plan the week,
            and cook hands-free at the stove.
          </p>
          {/* Both badges, rather than the single App Store button this used to
              carry: the person receiving a shared recipe is whoever the sharer
              knows, and half this family is on Android. */}
          <StoreBadges className="mt-5" />
          <p className="mt-4 font-sans text-xs text-slate/70">
            Already have the app? Open this link on your phone and it appears there.
          </p>
        </section>
      </div>
    </main>
  );
}
