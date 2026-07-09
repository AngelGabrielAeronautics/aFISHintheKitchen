import Link from "next/link";
import { TERMS_UPDATED } from "@/lib/legal";

export const metadata = {
  title: "Terms of Service",
  description: "The terms for using A Fish in the Kitchen.",
};

const UPDATED = TERMS_UPDATED;

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
              Owning a cookbook requires a subscription, which can start with a free trial. The owner
              pays and invited members remain free. Specific prices are shown at the point of sign-up.
            </p>
            <p>
              On our iOS app, subscriptions are auto-renewable and are sold through Apple. Payment is
              charged to your Apple ID account at confirmation of purchase. The subscription
              automatically renews for the same period unless it is cancelled at least 24 hours
              before the end of the current period, and your account is charged for renewal within 24
              hours before the end of the period. You can manage or cancel your subscription, and turn
              off auto-renewal, in your App Store account settings after purchase. If a free trial is
              offered, any unused portion of the trial is forfeited when you purchase a subscription.
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
              We want this to stay a safe, friendly place for families. When using the app, you agree
              not to:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>break the law, or use the app to help anyone else break it;</li>
              <li>
                upload content that is unlawful, hateful, harassing, threatening, defamatory,
                obscene, or that exploits or endangers a child;
              </li>
              <li>
                post content you don&rsquo;t have the right to share &mdash; including recipes,
                photos, or text that infringes someone else&rsquo;s copyright, trademark, or privacy;
              </li>
              <li>impersonate anyone, or misrepresent who you are or your connection to a cookbook;</li>
              <li>
                upload viruses or malicious code, or try to disrupt, overload, attack, or gain
                unauthorised access to the service, its systems, or other users&rsquo; cookbooks;
              </li>
              <li>
                scrape, harvest, or copy the service or its content by automated means, or reverse-
                engineer, decompile, or attempt to extract the source code of the app;
              </li>
              <li>
                get around, disable, or interfere with any security feature, subscription limit, seat
                cap, or usage limit;
              </li>
              <li>
                use the app for commercial purposes beyond running your own family cookbook &mdash;
                for example, reselling access or using it to operate a public or business catalogue.
              </li>
            </ul>
            <p>
              If you come across content that breaks these rules, email{" "}
              <a href="mailto:admin@afishinthekitchen.com" className="font-medium text-terracotta hover:text-terracotta-dark">
                admin@afishinthekitchen.com
              </a>{" "}
              and we&rsquo;ll look into it.
            </p>
          </Section>

          <Section title="Our intellectual property">
            <p>
              The app itself &mdash; its name, logo, design, and software &mdash; belongs to us. These
              terms don&rsquo;t give you any right to use our branding or copy the app. You may use the
              service only as intended, to keep and share your family&rsquo;s cookbook.
            </p>
          </Section>

          <Section title="Copyright and takedowns">
            <p>
              We respect intellectual property and expect you to as well. If you believe content in the
              app infringes your copyright, email{" "}
              <a href="mailto:admin@afishinthekitchen.com" className="font-medium text-terracotta hover:text-terracotta-dark">
                admin@afishinthekitchen.com
              </a>{" "}
              with a description of the work, where it appears in the app, your contact details, and a
              statement that you believe the use isn&rsquo;t authorised. We&rsquo;ll review valid notices
              and remove infringing content, and we may suspend accounts that repeatedly infringe.
            </p>
          </Section>

          <Section title="Indemnity">
            <p>
              You agree to cover us for any claims, losses, or costs (including reasonable legal fees)
              that arise from content you add, your use of the app, or your breach of these terms. In
              plain terms: if something you upload or do causes a problem for us with a third party,
              that&rsquo;s on you, not us.
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
            <p>
              Where liability can&rsquo;t be excluded, our total liability to you for any claim is
              limited to the greater of the amount you paid us in the twelve months before the claim,
              or USD&nbsp;50. Nothing in these terms limits liability that can&rsquo;t be limited by
              law.
            </p>
          </Section>

          <Section title="App Store terms (iOS)">
            <p>
              If you use our iOS app, you also agree to this section. These terms are between you and
              us, not Apple, and Apple isn&rsquo;t responsible for the app or its content. Apple has no
              obligation to provide any support or maintenance for the app. If the app fails to meet an
              applicable warranty, you may notify Apple and Apple may refund the purchase price (if any);
              to the maximum extent permitted by law, Apple has no other warranty obligation. We, not
              Apple, are responsible for addressing any claims about the app &mdash; including product
              liability, failure to meet legal requirements, and privacy or intellectual-property claims.
              You confirm you are not located in a country subject to a US&nbsp;Government embargo or on a
              US&nbsp;Government restricted-parties list. Apple and its subsidiaries are third-party
              beneficiaries of these terms and may enforce them against you.
            </p>
          </Section>

          <Section title="Changes to these terms">
            <p>
              We may update these terms from time to time. If we make a material change, we&rsquo;ll
              update the date above and, where appropriate, let you know in the app. Continuing to use
              the app means you accept the updated terms.
            </p>
          </Section>

          <Section title="General">
            <p>
              These terms are the whole agreement between you and us about the app. If any part is found
              unenforceable, the rest still applies. Our not enforcing a term isn&rsquo;t a waiver of it.
              You may not transfer your rights under these terms; we may transfer ours to a company that
              takes over the service. Headings are for convenience only.
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
