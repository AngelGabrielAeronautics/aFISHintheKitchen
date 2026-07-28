import type { Metadata } from "next";
import Link from "next/link";
import { getAdminDb } from "@/lib/firebase-admin";
import { APP_STORE_URL } from "@/lib/app-links";

// Public live view of a shared event menu — who's bringing what, right now.
// View-only on web; claiming and commenting happen in the app. Token-only,
// noindex: sharing, not publishing.

export const dynamic = "force-dynamic";

async function loadMenu(token: string) {
  const db = getAdminDb();
  const shareSnap = await db.collection("sharedMenus").doc(token).get();
  if (!shareSnap.exists) return null;
  const share = shareSnap.data()!;
  const menuSnap = await db.collection("collections").doc(share.collectionId).get();
  if (!menuSnap.exists) return null;
  const menu = menuSnap.data()!;
  const ids: string[] = menu.recipeIds ?? [];
  const recipeSnaps = await Promise.all(ids.map((id) => db.collection("recipes").doc(id).get()));
  const assignments = (menu.assignments ?? {}) as Record<string, string[]>;
  const status = (menu.assignmentStatus ?? {}) as Record<string, Record<string, string>>;
  return {
    share,
    menu,
    recipes: recipeSnaps
      .filter((s) => s.exists)
      .map((s) => ({
        id: s.id,
        title: s.data()!.title as string,
        image: (s.data()!.thumbUrl || s.data()!.image || "") as string,
        assignees: (assignments[s.id] ?? []).map((name) => ({
          name,
          status: status[s.id]?.[name] ?? "pending",
        })),
      })),
  };
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const data = await loadMenu(token);
  if (!data) return { title: "Menu not found", robots: { index: false } };
  const cover = data.recipes.find((r) => r.image)?.image;
  const description =
    (data.menu.description as string) ||
    "An event menu on A Fish in the Kitchen — see who's bringing what.";
  return {
    title: `${data.menu.name} — help plan it on A Fish in the Kitchen`,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title: data.menu.name as string,
      description,
      images: cover ? [cover] : [],
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function SharedMenuPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await loadMenu(token);

  if (!data) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="font-serif text-3xl font-bold text-charcoal">This menu link isn&rsquo;t available</h1>
          <p className="mt-3 font-sans text-slate">It may have been removed by the family planning it.</p>
          <Link href="/" className="mt-6 inline-block rounded-lg bg-terracotta px-6 py-3 font-sans text-sm font-semibold text-white">
            Visit A Fish in the Kitchen
          </Link>
        </div>
      </main>
    );
  }

  const { share, menu, recipes } = data;
  const dateLabel = menu.eventDate
    ? new Date(menu.eventDate + "T00:00:00").toLocaleDateString("en-GB", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      })
    : null;

  return (
    <main className="min-h-screen bg-cream">
      <div className="bg-terracotta px-6 py-3 text-center">
        <p className="font-sans text-sm text-white">
          <span className="font-semibold">{share.sharedByName}</span> invited you to help plan{" "}
          <span className="font-semibold">{menu.name}</span> with <span className="font-semibold">{share.bookName}</span>
        </p>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-serif text-4xl font-bold text-charcoal">{menu.name}</h1>
        {dateLabel && <p className="mt-2 font-sans text-sm font-semibold text-terracotta">📅 {dateLabel}</p>}
        {menu.description && <p className="mt-3 font-sans text-base text-slate">{menu.description}</p>}

        <section className="mt-8 space-y-4">
          <h2 className="font-serif text-2xl font-bold text-charcoal">Who&rsquo;s making what</h2>
          {recipes.map((r) => (
            <div key={r.id} className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-charcoal/5">
              {r.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.image} alt={r.title} className="h-14 w-14 rounded-lg object-cover" />
              ) : (
                <div className="h-14 w-14 rounded-lg bg-cream-dark/40" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-sans text-base font-semibold text-charcoal">{r.title}</p>
                {r.assignees.length > 0 ? (
                  <p className="mt-0.5 font-sans text-xs text-slate">
                    {r.assignees.map((a) => `${a.name}${a.status === "accepted" ? " ✓" : ""}`).join(" · ")}
                  </p>
                ) : (
                  <p className="mt-0.5 font-sans text-xs italic text-slate/60">No one&rsquo;s claimed this yet</p>
                )}
              </div>
            </div>
          ))}
        </section>

        {(menu.comments ?? []).length > 0 && (
          <section className="mt-8">
            <h2 className="font-serif text-2xl font-bold text-charcoal">Comments</h2>
            <div className="mt-3 space-y-3">
              {(menu.comments as { id: string; author: string; text: string }[]).map((c) => (
                <div key={c.id} className="rounded-xl bg-warm-white p-3">
                  <p className="font-sans text-xs font-semibold text-charcoal">{c.author}</p>
                  <p className="mt-0.5 font-sans text-sm text-slate">{c.text}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-10 rounded-2xl bg-warm-white p-8 text-center ring-1 ring-charcoal/5">
          <h3 className="font-serif text-2xl font-bold text-charcoal">Want to claim a dish?</h3>
          <p className="mt-3 font-sans text-sm text-slate leading-relaxed">
            Open this link in the A Fish in the Kitchen app to say what you&rsquo;ll bring and
            join the planning — comments, claims, and the family cookbook itself.
          </p>
          {/* Mirrors the same block on /r/[token]: a real download button once
              the store listing is live, and an honest holding line before it. */}
          {APP_STORE_URL ? (
            <a
              href={APP_STORE_URL}
              className="mt-5 inline-block rounded-lg bg-terracotta px-8 py-3.5 font-sans text-sm font-semibold text-white shadow-md"
            >
              Get the app — claim a dish
            </a>
          ) : (
            <p className="mt-5 inline-block rounded-lg bg-cream-dark/40 px-6 py-3 font-sans text-sm font-semibold text-slate">
              The iOS app is coming soon — this link will open it directly.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
