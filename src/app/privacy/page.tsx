import Link from "next/link";

export const metadata = {
  title: "Privacy Policy",
  description:
    "How A Fish in the Kitchen collects, uses, and protects your information.",
};

const UPDATED = "31 May 2026";

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p className="mt-3 font-sans text-sm text-slate">Last updated {UPDATED}</p>

        <div className="mt-10 space-y-8 font-sans text-[15px] leading-relaxed text-charcoal/90">
          <section className="space-y-3">
            <p>
              This policy explains how <strong>A Fish in the Kitchen</strong> (&ldquo;we&rdquo;,
              &ldquo;us&rdquo;) handles your information when you use our family-cookbook app. We
              keep this short and plain. If anything is unclear, email us at{" "}
              <a href="mailto:admin@afishinthekitchen.com" className="font-medium text-terracotta hover:text-terracotta-dark">
                admin@afishinthekitchen.com
              </a>.
            </p>
          </section>

          <Section title="What we collect">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Account details</strong> &mdash; your name and email address, and either a
                password or your Google/Apple sign-in identity.
              </li>
              <li>
                <strong>Content you add</strong> &mdash; recipes, photos and videos, kitchen tips,
                meal plans, shopping lists, family-member profiles, notes, and your cookbook&rsquo;s
                name and members.
              </li>
              <li>
                <strong>Basic technical data</strong> &mdash; standard logs and device information
                from our hosting and infrastructure providers, used to run and secure the service.
              </li>
            </ul>
          </Section>

          <Section title="How we use it">
            <ul className="list-disc space-y-2 pl-5">
              <li>To provide the app &mdash; storing and showing your cookbook to your household.</li>
              <li>To sign you in and keep your account secure.</li>
              <li>To send necessary emails, such as invitations (and, in future, billing notices).</li>
              <li>To maintain, improve, and protect the service.</li>
            </ul>
            <p>We do not sell your personal information, and we don&rsquo;t use it for advertising.</p>
          </Section>

          <Section title="AI recipe import">
            <p>
              If you use the &ldquo;import from photo&rdquo; feature, the image you upload is sent to{" "}
              <strong>Anthropic</strong> (the Claude API) to read the recipe and turn it into
              structured text. This only happens when you choose to use that feature.
            </p>
          </Section>

          <Section title="Who we share it with">
            <p>We use a small number of trusted providers to run the service, acting on our instructions:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li><strong>Google Firebase</strong> &mdash; sign-in, database, and file storage.</li>
              <li><strong>Vercel</strong> &mdash; application hosting.</li>
              <li><strong>Twilio SendGrid</strong> &mdash; sending transactional emails.</li>
              <li><strong>Anthropic</strong> &mdash; AI recipe import (only when you use it).</li>
            </ul>
            <p>
              Your cookbook is private: only you and the family members you invite can see its
              contents. We don&rsquo;t make it public or searchable.
            </p>
          </Section>

          <Section title="Where your data is stored">
            <p>
              Your information is stored on our providers&rsquo; servers, which may be located outside
              Jersey (for example in the EU or United States). These providers maintain appropriate
              safeguards for international data transfers.
            </p>
          </Section>

          <Section title="How long we keep it">
            <p>
              We keep your content while your cookbook is active. If a subscription lapses, access
              steps down over time (to read-only, then suspended), and the cookbook&rsquo;s data is
              deleted roughly one year after it is suspended. You can delete your account and
              cookbook at any time from your account settings.
            </p>
          </Section>

          <Section title="Your rights">
            <p>
              Under the Jersey Data Protection Law you can ask to access, correct, delete, or receive
              a copy of your personal data, and you can object to certain uses. To make a request,
              email{" "}
              <a href="mailto:admin@afishinthekitchen.com" className="font-medium text-terracotta hover:text-terracotta-dark">
                admin@afishinthekitchen.com
              </a>.
            </p>
          </Section>

          <Section title="Children">
            <p>
              The app is intended for adults running a family cookbook. Accounts are for adults,
              though the recipes and profiles an adult adds may mention family members, including
              children, by name or photo. The app is not directed at children creating their own
              accounts.
            </p>
          </Section>

          <Section title="Cookies and local storage">
            <p>
              We use your browser&rsquo;s local storage for essential sign-in and session purposes
              (for example, remembering which cookbook is active). We don&rsquo;t use third-party
              advertising or tracking cookies.
            </p>
          </Section>

          <Section title="Security">
            <p>
              Sign-in and passwords are handled by Google Firebase Authentication; we never store
              your raw password. No system is perfectly secure, but we take reasonable measures to
              protect your information.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              We may update this policy from time to time. If we make a material change, we&rsquo;ll
              update the date above and, where appropriate, let you know in the app.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about your privacy? Email{" "}
              <a href="mailto:admin@afishinthekitchen.com" className="font-medium text-terracotta hover:text-terracotta-dark">
                admin@afishinthekitchen.com
              </a>. This service is operated from Jersey and governed by Jersey law.
            </p>
          </Section>
        </div>

        <p className="mt-12 font-sans text-sm text-slate">
          See also our{" "}
          <Link href="/terms" className="font-medium text-terracotta hover:text-terracotta-dark">
            Terms of Service
          </Link>.
        </p>
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
