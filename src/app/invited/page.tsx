import type { Metadata } from "next";
import StoreBadges from "@/components/StoreBadges";

// Public landing for invite-email links opened in a browser — i.e. by someone
// who does NOT have the app yet, which is every invitee the first time.
//
// The emails link to /auth so the Universal Link / App Link can open the app
// when it IS installed; the proxy sends browser hits here with the query
// intact. Before this page existed those clicks 307'd to the marketing
// homepage with the query stripped — the invitee lost all context and the
// funnel's first customer family fell straight through it.
//
// Signups are native-only (decided 2026-07-09), so the job of this page is
// exactly two lines: you're invited, and here's the app — sign up with the
// invited address and the join is automatic.

export const metadata: Metadata = {
  title: "You're invited — A Fish in the Kitchen",
  robots: { index: false, follow: false },
};

export default async function InvitedPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; name?: string; book?: string }>;
}) {
  const { email, name, book } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4 py-12">
      <div className="w-full max-w-lg text-center">
        <h1 className="font-serif text-3xl font-bold text-charcoal sm:text-4xl">
          {name ? `${name}, you're invited` : "You're invited"}
        </h1>
        <p className="mt-4 font-sans text-base leading-relaxed text-slate">
          {book ? (
            <>
              You&rsquo;ve been invited to join <strong>{book}</strong> — a private family
              cookbook on A Fish in the Kitchen.
            </>
          ) : (
            <>You&rsquo;ve been invited to join a private family cookbook on A Fish in the Kitchen.</>
          )}{" "}
          Joining is free — the cookbook&rsquo;s owner covers the subscription.
        </p>

        <div className="mt-8 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-charcoal/5 sm:p-8">
          <ol className="space-y-4 text-left">
            <li className="flex gap-3 font-sans text-sm text-charcoal">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracotta text-sm font-bold text-warm-white">1</span>
              <span className="pt-1">Download the app on your phone or tablet.</span>
            </li>
            <li className="flex gap-3 font-sans text-sm text-charcoal">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-terracotta text-sm font-bold text-warm-white">2</span>
              <span className="pt-1">
                Sign up with{" "}
                {email ? (
                  <strong className="break-all">{email}</strong>
                ) : (
                  <strong>the email address this invitation was sent to</strong>
                )}{" "}
                — that address is your invitation, so the cookbook opens automatically.
              </span>
            </li>
          </ol>
          <StoreBadges className="mt-7" />
        </div>

        <p className="mt-6 font-sans text-xs text-slate/70">
          Already have the app? Open the invitation email on that device and tap the button —
          it will take you straight there.
        </p>
      </div>
    </main>
  );
}
