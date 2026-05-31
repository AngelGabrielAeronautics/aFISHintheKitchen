import Link from "next/link";

export const metadata = {
  title: "Terms of Service",
  description: "The terms for using A Fish in the Kitchen.",
};

const UPDATED = "31 May 2026";

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="mt-3 font-sans text-sm text-slate">Last updated {UPDATED}</p>

        <div className="mt-10 space-y-8 font-sans text-[15px] leading-relaxed text-charcoal/90">
          <section className="space-y-3">
            <p>
              These terms govern your use of <strong>A Fish in the Kitchen</strong> (&ldquo;we&rdquo;,
              &ldquo;us&rdquo;), a private family-cookbook app. By creating an account or using the
              app, you agree to them. If you don&rsquo;t agree, please don&rsquo;t use the service.
            </p>
          </section>

          <Section title="The service">
            <p>
              A Fish in the Kitchen lets a family keep a private cookbook &mdash; recipes, photos,
              meal plans, shopping lists, kitchen tips, and event menus &mdash; and share it with
              invited members.
            </p>
          </Section>

          <Section title="Your account">
            <p>
              You must be at least 18 to create an account. You&rsquo;re responsible for keeping your
              login details secure and for activity under your account. Tell us promptly if you think
              your account has been compromised.
            </p>
          </Section>

          <Section title="Cookbooks, owners, and members">
            <p>
              Each cookbook has an owner, who can invite members and manage the cookbook&rsquo;s
              settings. Invited members can add and edit content but don&rsquo;t control billing,
              invitations, or cookbook settings. Joining a cookbook you&rsquo;ve been invited to is
              free for the member &mdash; the owner is responsible for any subscription.
            </p>
          </Section>

          <Section title="Subscriptions and trials">
            <p>
              Owning a cookbook may require a subscription, which can start with a free trial. When
              paid plans are available, the owner pays and invited members remain free, and a trial
              may convert to a paid subscription unless cancelled beforehand. Specific prices and
              terms will be shown at the point of sign-up.
            </p>
          </Section>

          <Section title="Your content">
            <p>
              You keep ownership of the recipes, photos, and other content you add. You grant us the
              limited permission needed to store your content and display it to you and the members
              of your cookbook, in order to run the service. You&rsquo;re responsible for the content
              you add and confirm you have the right to add it (for example, photos you upload).
            </p>
          </Section>

          <Section title="Acceptable use">
            <p>
              Don&rsquo;t use the app for anything unlawful, abusive, or harmful, and don&rsquo;t try
              to disrupt, attack, or gain unauthorised access to the service or other users&rsquo;
              cookbooks.
            </p>
          </Section>

          <Section title="Recipes and food safety">
            <p>
              Recipes and cooking content are provided by users for their own family&rsquo;s use. We
              don&rsquo;t verify them. You&rsquo;re responsible for safe food handling, allergens, and
              dietary needs &mdash; cook at your own discretion.
            </p>
          </Section>

          <Section title="Privacy">
            <p>
              Your use of the app is also covered by our{" "}
              <Link href="/privacy" className="font-medium text-terracotta hover:text-terracotta-dark">
                Privacy Policy
              </Link>.
            </p>
          </Section>

          <Section title="Suspension and termination">
            <p>
              You can stop using the app and delete your account at any time. We may suspend or end
              access if these terms are breached. If a subscription goes unpaid, access steps down
              over time and, after an extended period, the cookbook&rsquo;s data may be deleted, as
              described in our Privacy Policy.
            </p>
          </Section>

          <Section title="Disclaimers">
            <p>
              The app is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without
              warranties of any kind. We don&rsquo;t guarantee the service will be uninterrupted or
              error-free.
            </p>
          </Section>

          <Section title="Limitation of liability">
            <p>
              To the fullest extent permitted by law, A Fish in the Kitchen is not liable for any
              indirect or consequential loss, or for loss of data, arising from your use of the app.
            </p>
          </Section>

          <Section title="Changes to these terms">
            <p>
              We may update these terms from time to time. If we make a material change, we&rsquo;ll
              update the date above and, where appropriate, let you know in the app. Continuing to use
              the app means you accept the updated terms.
            </p>
          </Section>

          <Section title="Governing law">
            <p>
              These terms are governed by the law of Jersey, and any disputes are subject to the
              jurisdiction of the Jersey courts.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about these terms? Email{" "}
              <a href="mailto:admin@afishinthekitchen.com" className="font-medium text-terracotta hover:text-terracotta-dark">
                admin@afishinthekitchen.com
              </a>.
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
