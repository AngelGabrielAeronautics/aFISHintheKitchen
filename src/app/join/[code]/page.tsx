import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import StoreBadges from "@/components/StoreBadges";
import { getAdminDb } from "@/lib/firebase-admin";
import { loadJoinCode, isOpen, type JoinCode } from "@/lib/join-codes";
import { formatGiftCode } from "@/lib/gift";

export const dynamic = "force-dynamic";

// /join/CODE — where a shared join link lands. The link itself is the app's
// universal link, so on a phone with the app installed this page is never seen;
// this is for the phone WITHOUT the app, or a laptop. It shows the code big
// enough to type and points at the stores. It deliberately reveals nothing
// about the cookbook to somebody holding a dead code.
// The link is what lands in WhatsApp, so its preview does the inviting: a live
// code names the cookbook and who's asking; a dead one stays generic (the page
// deliberately reveals nothing to somebody holding a stale link).
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const { jc, bookName } = await load(code);
  const base: Metadata = { robots: { index: false, follow: false } };
  if (!jc || !isOpen(jc)) return { ...base, title: "Join a cookbook" };
  const title = `${jc.createdByName} wants you in ${bookName ?? "their cookbook"}`;
  const description = "You're invited to a private family cookbook on A Fish in the Kitchen. Tap to join — it's free for you.";
  return {
    ...base,
    title,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

async function load(code: string): Promise<{ jc: JoinCode | null; bookName: string | null }> {
  try {
    const db = getAdminDb();
    const jc = await loadJoinCode(db, code);
    if (!jc) return { jc: null, bookName: null };
    const hh = (await db.collection("households").doc(jc.householdId).get()).data();
    return { jc, bookName: hh?.customisation?.brandName ?? hh?.name ?? null };
  } catch {
    return { jc: null, bookName: null };
  }
}

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { jc, bookName } = await load(code);
  const open = jc ? isOpen(jc) : false;

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center px-6 py-16">
      <div className="text-center max-w-md">
        <Image src="/logo.png" alt="" width={2064} height={2174} className="mx-auto mb-5 h-auto w-24 max-w-full" />
        {!jc || !open ? (
          <>
            <h1 className="font-serif text-3xl font-bold text-charcoal">
              {jc?.status === "used"
                ? "This invitation has been used"
                : jc && !open
                  ? "This invitation has expired"
                  : "We couldn’t find that invitation"}
            </h1>
            <p className="mt-3 font-sans text-slate">
              Ask whoever sent it for a fresh one &mdash; a join code lasts seven days and works once.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-lg bg-terracotta px-6 py-3 font-sans text-sm font-semibold text-warm-white"
            >
              Visit A Fish in the Kitchen
            </Link>
          </>
        ) : (
          <>
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-gold">You&rsquo;re invited</p>
            <h1 className="mt-2 font-serif text-3xl font-bold text-charcoal sm:text-4xl">
              {jc.createdByName} wants you in {bookName ?? "their cookbook"}
            </h1>
            <p className="mt-3 font-sans text-slate">
              Open A Fish in the Kitchen, sign in (or create an account), then enter this code under
              <span className="font-semibold text-charcoal"> Join a cookbook</span>.
            </p>
            <div className="mx-auto mt-6 inline-block rounded-2xl bg-white px-8 py-5 shadow-sm ring-1 ring-charcoal/5">
              <div className="font-serif text-4xl tracking-[0.12em] text-charcoal">{formatGiftCode(jc.code)}</div>
              <div className="mt-1 font-sans text-xs text-slate">
                works once &middot; until {new Date(jc.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
              </div>
            </div>
            <p className="mt-8 font-sans text-sm text-slate">Don&rsquo;t have the app yet?</p>
            <div className="mt-3 flex justify-center">
              <StoreBadges />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
