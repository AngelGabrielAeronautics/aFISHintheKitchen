import Link from "next/link";
import Image from "next/image";
import Reveal from "@/components/Reveal";

// PLACEHOLDER photo slot — visually intentional so the page reads as "design
// in progress" rather than "broken images." Swap each one for an <Image /> as
// real photos land in public/.
function PhotoSlot({ caption, aspect = "aspect-[4/3]" }: { caption: string; aspect?: string }) {
  return (
    <div
      className={`${aspect} flex items-center justify-center rounded-2xl border-2 border-dashed border-cream-dark/70 bg-cream/40 px-4 text-center`}
    >
      <span className="font-sans text-xs uppercase tracking-[0.15em] text-slate/50">
        Photo · {caption}
      </span>
    </div>
  );
}

export const metadata = {
  title: "Our Story · A Fish in the Kitchen",
  description: "How a paperback called the Kookbook — written by a grandfather, asked for by a granddaughter — became this app.",
};

export default function OurStoryPage() {
  return (
    <main className="bg-cream">
      {/* Opening */}
      <section className="py-20 sm:py-28">
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
          <p className="font-sans text-[11px] uppercase tracking-[0.25em] text-slate/50">
            Dedicated to
          </p>
          <p className="mt-3 font-serif text-xl italic text-charcoal sm:text-2xl">
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
                Six years ago I moved to Jersey. My parents stayed in South Africa. The thing I didn&rsquo;t realise I&rsquo;d lose was just sitting around the table eating Poppie&rsquo;s food. My daughter Bella missed it too. She asked her grandfather to write his recipes down for her &mdash; and he did. A paperback he made himself, called the <em>Kookbook</em>. That&rsquo;s where this app started.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.1} className="mt-10">
            <PhotoSlot caption="Poppie cooking, or the family at the table" />
          </Reveal>
        </div>
      </section>

      {/* Cross-continent ritual — distinct callout */}
      <section className="bg-warm-white py-16 sm:py-20">
        <Reveal className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <p className="font-serif text-2xl italic leading-snug text-charcoal sm:text-3xl">
            Sometimes on special days we cook the same meal, eight thousand kilometres apart, and eat together over a video call. The flavours are exactly the same.
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
                Sharing food is one of the oldest things humans do. It&rsquo;s how families bond, how the day winds down, how stories get told. Long before kitchens, tribes sat around a fire and passed plates around.
              </p>
              <p>
                Modern life &mdash; most of all the phones at the table &mdash; is quietly cutting into that ritual. We sit together but look elsewhere. We eat without really eating together.
              </p>
              <p>
                This app is a small attempt to push back: to keep your family&rsquo;s recipes alive, to cook them together (even when you&rsquo;re apart), and to put the phones down around something worth gathering for.
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

      {/* Three-generation strip */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <Reveal>
            <h2 className="text-center font-serif text-2xl font-bold text-charcoal sm:text-3xl">
              Three generations, one kitchen
            </h2>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Reveal>
              <PhotoSlot caption="Poppie at the stove" aspect="aspect-[3/4]" />
            </Reveal>
            <Reveal delay={0.1}>
              <PhotoSlot caption="Bella & Poppie" aspect="aspect-[3/4]" />
            </Reveal>
            <Reveal delay={0.2}>
              <PhotoSlot caption="The kids cooking today" aspect="aspect-[3/4]" />
            </Reveal>
          </div>
        </div>
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
        </Reveal>
      </section>
    </main>
  );
}
