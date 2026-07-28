import Link from "next/link";
import { OPERATOR } from "@/lib/legal";

// Google Play requires a publicly reachable URL, outside the app, that explains
// how to delete an account and what happens to the data. It is a hard gate on
// the Data safety declaration — the form will not submit without it — and Play
// requires the page to name the app, list the steps, and state what is deleted,
// what is kept, and for how long.
//
// ⚠ Be careful editing this. It is a public promise about data handling, and
// the honest version of that promise is currently "email us and a human does
// it", because AuthService.deleteAccount() removes only the Firebase Auth user.
// If a real cascade ever lands, update the wording here at the same time —
// stale copy here is worse than no page at all.
export const metadata = {
  title: "Delete your account",
  description:
    "How to delete your A Fish in the Kitchen account and the data associated with it.",
};

export default function DeleteAccountPage() {
  return (
    <main className="bg-cream">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-sans text-sm font-medium text-slate transition-colors hover:text-charcoal"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 0 1 0 1.06L9.06 10l3.73 3.71a.75.75 0 1 1-1.06 1.06l-4.25-4.24a.75.75 0 0 1 0-1.06l4.25-4.24a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
          Back to home
        </Link>

        <h1 className="mt-8 font-serif text-4xl font-bold text-charcoal sm:text-5xl">
          Delete your account
        </h1>

        <div className="mt-10 space-y-8 font-sans text-[15px] leading-relaxed text-charcoal/90">
          <section className="space-y-3">
            <p>
              This page explains how to delete your <strong>A Fish in the Kitchen</strong> account
              and the information stored with it. The app is operated by {OPERATOR.name}, trading
              as {OPERATOR.tradingAs}.
            </p>
          </section>

          <Section title="Deleting your sign-in, in the app">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Open A Fish in the Kitchen on your phone.</li>
              <li>Go to <strong>More</strong>, then <strong>Account</strong>.</li>
              <li>Scroll down and tap <strong>Delete account</strong>.</li>
              <li>
                Confirm. You may be asked to sign in again first &mdash; that is a security check,
                not an extra step you can skip.
              </li>
            </ol>
            <p>
              This removes your sign-in immediately and permanently. You will not be able to get
              back into the app with that email address, and it cannot be undone.
            </p>
          </Section>

          <Section title="Deleting your cookbook and its contents">
            <p>
              Deleting your sign-in does <strong>not</strong> delete the cookbook itself. Recipes,
              photos, notes and family profiles are shared with the people you invited, so we
              don&rsquo;t remove them automatically &mdash; deleting one person&rsquo;s account
              would otherwise wipe a cookbook other people are still using.
            </p>
            <p>To have that content deleted as well, email us and ask:</p>
            <p>
              <a
                href={`mailto:${OPERATOR.email}?subject=Please%20delete%20my%20account%20and%20data`}
                className="font-medium text-terracotta hover:text-terracotta-dark"
              >
                {OPERATOR.email}
              </a>
            </p>
            <p>
              Write from the email address on the account, and tell us the name of the cookbook.
              We&rsquo;ll confirm it&rsquo;s you, delete it, and email you when it&rsquo;s done.
              We aim to complete requests within 30 days.
            </p>
          </Section>

          <Section title="What gets deleted">
            <ul className="list-disc space-y-2 pl-5">
              <li>Your sign-in and authentication details.</li>
              <li>Your name, email address and profile.</li>
              <li>
                On request: the cookbook you own &mdash; its recipes, photos, videos, kitchen tips,
                notes, meal plans, shopping lists, event menus and family profiles.
              </li>
              <li>Your device&rsquo;s push-notification registration.</li>
            </ul>
          </Section>

          <Section title="What is kept, and for how long">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Cookbooks you don&rsquo;t own.</strong> If you were invited to someone
                else&rsquo;s cookbook, anything you added there belongs to that cookbook and stays
                with it. Ask its owner if you want it removed.
              </li>
              <li>
                <strong>Shared links you created.</strong> A recipe or menu you shared by link is a
                separate public snapshot. Tell us and we&rsquo;ll revoke it.
              </li>
              <li>
                <strong>Records we&rsquo;re required to keep.</strong> If you ever paid for a
                subscription, we keep the billing and tax records the law requires us to keep.
                Those are financial records, not your recipes.
              </li>
            </ul>
          </Section>

          <Section title="Deleting some of your data, but keeping your account">
            <p>
              You don&rsquo;t have to delete your whole account to remove something. You can delete
              individual recipes, photos, tips and family profiles in the app at any time. If
              you&rsquo;d like something removed that you can&rsquo;t reach yourself, email{" "}
              <a
                href={`mailto:${OPERATOR.email}`}
                className="font-medium text-terracotta hover:text-terracotta-dark"
              >
                {OPERATOR.email}
              </a>{" "}
              and we&rsquo;ll help.
            </p>
          </Section>

          <Section title="More detail">
            <p>
              Our{" "}
              <Link href="/privacy" className="font-medium text-terracotta hover:text-terracotta-dark">
                Privacy Policy
              </Link>{" "}
              explains what we collect and who we share it with.
            </p>
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-serif text-xl font-bold text-charcoal sm:text-2xl">{title}</h2>
      {children}
    </section>
  );
}
