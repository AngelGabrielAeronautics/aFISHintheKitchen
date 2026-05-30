import Link from "next/link";
import Image from "next/image";
import Reveal from "@/components/Reveal";

export const metadata = {
  title: "Our Story · A Fish in the Kitchen",
  description: "How a paperback called the Kookbook — written by a grandfather, asked for by a granddaughter — became this app.",
};

export default function OurStoryPage() {
  return (
    <main className="bg-cream">
      {/* Back link — a clear way out of the story page, before the reader commits. */}
      <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-sans text-sm font-medium text-slate transition-colors hover:text-charcoal"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 0 1 0 1.06L9.06 10l3.73 3.71a.75.75 0 1 1-1.06 1.06l-4.25-4.24a.75.75 0 0 1 0-1.06l4.25-4.24a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
          Back to home
        </Link>
      </div>

      {/* Opening */}
      <section className="pb-20 pt-12 sm:pb-28 sm:pt-16">
        <Reveal className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="font-sans text-xs uppercase tracking-[0.2em] text-terracotta">Our story</p>
          <h1 className="mt-4 font-serif text-4xl font-bold leading-tight text-charcoal sm:text-5xl md:text-6xl">
            A book my father wrote.
            <br />
            For my daughter.
          </h1>
        </Reveal>

        <Reveal delay={0.1} className="mx-auto mt-12 max-w-md px-4">
          <div className="overflow-hidden rounded-2xl shadow-xl ring-1 ring-cream-dark/40">
            <Image
              src="/kookbook-cover.png"
              alt="The Kookbook by Popsie & Gillian — the original paperback"
              width={279}
              height={219}
              className="h-auto w-full"
              priority
            />
          </div>
          <p className="mt-3 text-center font-sans text-xs italic text-slate/60">
            The original Kookbook
          </p>
        </Reveal>

        {/* Dedication — book-style, sits up front like the front of the Kookbook. */}
        <Reveal delay={0.2} className="mx-auto mt-14 max-w-md px-4 text-center">
          <p className="font-serif text-xl italic text-charcoal sm:text-2xl">
            Poppie &mdash; the cook of our family.
          </p>
        </Reveal>
      </section>

      {/* The story (paragraphs) */}
      <section className="pb-16">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <Reveal>
            <div className="space-y-6 font-sans text-lg leading-relaxed text-charcoal/90">
              <p>
                I grew up watching my father &mdash; Poppie &mdash; cook for our family. He&rsquo;s the one who taught me. I cook his recipes for my own kids now, and they&rsquo;ve started cooking them too: the same flavours, the same way, the same things he was making when I was their age.
              </p>
              <p>
                A few years ago we immigrated, and my parents stayed behind. The thing I didn&rsquo;t realise I&rsquo;d miss so badly was just sitting around the table eating Poppie&rsquo;s food. My eldest daughter missed this too, prompting her to ask her grandfather to write his recipes down &mdash; and so he did. A paperback he made himself, called the <em>Kookbook</em>. That&rsquo;s where this app started.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Cross-continent ritual — distinct callout */}
      <section className="bg-warm-white py-16 sm:py-20">
        <Reveal className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <p className="font-serif text-2xl italic leading-snug text-charcoal sm:text-3xl">
            Sometimes on special occasions we cook the same meal, thousands of kilometres apart, and eat together over a video call. The flavours and smells perfectly aligned.
          </p>
        </Reveal>
      </section>

      {/* Why this exists */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <Reveal>
            <h2 className="font-serif text-3xl font-bold text-charcoal sm:text-4xl">
              Why this exists
            </h2>
            <div className="mt-6 space-y-6 font-sans text-lg leading-relaxed text-charcoal/90">
              <p>
                Cooking and sharing food with the people you love is one of the most fundamentally human things we do. Long before kitchens, tribes gathered around a fire to cook, eat, and tell stories. It&rsquo;s how families bond and how the day winds down &mdash; it&rsquo;s wired into us.
              </p>
              <p>
                And it runs deeper than habit. The smell of something your mom or gran used to make can take you straight back to being a child. Those flavours and smells live deep in our psyche; comfort food comforts because of the people and the memories baked into it.
              </p>
              <p>
                Modern life &mdash; most of all the phones at the table &mdash; is quietly eroding that. We sit together but look elsewhere. We eat without really eating together, and a little of what makes us human slips away with it.
              </p>
              <p>
                This app is a small push back: to keep your family&rsquo;s recipes alive, to cook them together even when you&rsquo;re apart, and to put the phones down and come back to the simple, healthy fundamentals &mdash; good food and the people around the table.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Pull quote from Poppie (placeholder) */}
      <section className="bg-cream-dark/30 py-16 sm:py-20">
        <Reveal className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <p className="font-serif text-2xl italic leading-snug text-charcoal sm:text-3xl">
            &ldquo;A line from Poppie &mdash; Dylan to provide.&rdquo;
          </p>
          <p className="mt-4 font-sans text-xs uppercase tracking-wider text-slate/60">
            &mdash; Poppie
          </p>
        </Reveal>
      </section>

      {/* Soft CTA */}
      <section className="py-16 sm:py-24">
        <Reveal className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="font-serif text-3xl font-bold text-charcoal sm:text-4xl">
            Start your family&rsquo;s cookbook
          </h2>
          <p className="mt-4 font-sans text-sm text-slate">
            Recipes outlast the people who made them &mdash; but only if someone
            writes them down. This is where you do that.
          </p>
          <Link
            href="/auth"
            className="mt-8 inline-block rounded-xl bg-terracotta px-8 py-3.5 font-sans text-base font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-terracotta-dark hover:shadow-lg"
          >
            Start your free trial
          </Link>
          <p className="mt-6">
            <Link
              href="/"
              className="font-sans text-sm font-medium text-slate transition-colors hover:text-charcoal"
            >
              Not yet &mdash; back to home
            </Link>
          </p>
        </Reveal>
      </section>
    </main>
  );
}
