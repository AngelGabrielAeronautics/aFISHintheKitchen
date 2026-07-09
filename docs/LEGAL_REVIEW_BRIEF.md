# Legal review brief — A Fish in the Kitchen

**Prepared for:** external legal counsel
**Prepared by:** development team
**Date:** 9 July 2026
**Status:** documents are live in production but have **not** had professional legal review.

---

## 1. What we're asking for

We run a small commercial family-cookbook app and are approaching launch. We have drafted our own **Terms of Service** and **Privacy Policy** in plain language and want a lawyer to:

1. Confirm the documents are **enforceable and adequate** for a paid, cross-border consumer app.
2. Review the **risk-shifting clauses** specifically (liability, indemnity, warranties, governing law).
3. Flag anything **missing or non-compliant** for our jurisdictions and platforms.
4. Tell us what **operator/entity details** we must add.

We are not looking for a full bespoke rewrite unless you judge one necessary — a markup of the existing drafts plus a list of required changes is the ideal output.

---

## 2. The business

- **Product:** a private, invite-only digital cookbook. A paying "owner" creates a household cookbook; they can invite family "members" who use it free. Content is recipes, photos/videos, meal plans, shopping lists, kitchen tips, and event menus. Nothing is public or searchable.
- **Operator:** operated from **Jersey** (Channel Islands). *(Counsel: we need to confirm the exact legal entity name, registration, and registered address to state in the documents — currently the docs say only "we/us". See §6.)*
- **Users:** expected to be international from day one — the founding family spans multiple continents (notably South Africa, UK, EU). So **users will be UK/EU/US/ZA consumers**, not only Jersey residents.
- **Platform & billing:** launching **iOS first** via the App Store. Subscriptions are **auto-renewable and sold through Apple** (Apple is merchant of record; we never touch card data). A web app exists but new signups are iOS-only at launch.
- **Price:** USD 5.99/month or 59.99/year, with a 14-day free trial.
- **Sub-processors:** Google Firebase (auth, database, file storage), Vercel (hosting), Twilio SendGrid (transactional email), Anthropic / Claude API (optional AI recipe-from-photo import — user-triggered), Google Gemini (optional AI photo enhancement).

---

## 3. What changed recently (context for the review)

We just strengthened the Terms and added a signup agreement. Prior to this the only "acceptance" was browsewrap (a line inside the terms page). Now:

- **Clickwrap at signup:** both platforms show "By continuing, you agree to our Terms of Service and Privacy Policy" with links, on every account-creating path (email, Apple, Google).
- **Acceptance record:** on signup we store `termsAcceptedVersion` + `termsAcceptedAt` on the user's record. The version string is `2026-07-09`.
- **Added to the Terms:** an enumerated prohibited-conduct/abuse list, an "our IP" clause, a copyright-takedown clause, an indemnity, a liability cap, the Apple-required EULA acknowledgements, and general boilerplate (severability, entire agreement, assignment, waiver).

**Please confirm our clickwrap + version-stamped acceptance record is sufficient evidence of assent, and whether a checkbox is advisable instead of a passive "by continuing" line.**

---

## 4. Documents to review

- **Terms of Service:** `https://www.afishinthekitchen.com/terms` (source: `src/app/terms/page.tsx`)
- **Privacy Policy:** `https://www.afishinthekitchen.com/privacy` (source: `src/app/privacy/page.tsx`)

---

## 5. Specific clauses we want signed off

| # | Clause / area | Our concern |
|---|---|---|
| 1 | **Governing law & jurisdiction (Jersey)** | Is a Jersey choice-of-law/forum enforceable against UK/EU/US consumers, or will mandatory local consumer-protection law override it? Should we carve out consumers' non-waivable rights? |
| 2 | **Limitation of liability + cap** (greater of 12-month fees or USD 50) | Is the cap enforceable? Are the consumer-law carve-outs (death/personal injury, fraud, etc.) adequate and correctly worded? |
| 3 | **Indemnity** (user indemnifies us for their content/breach) | Enforceable against consumers, or should it be narrowed/removed for consumer users? |
| 4 | **Warranty disclaimer / "as is"** and the **food-safety disclaimer** | Adequate to disclaim liability for user-submitted recipes (allergens, food safety)? Any consumer-law limits? |
| 5 | **Apple EULA acknowledgements** | Do our added clauses meet Apple's **minimum required terms** for licensed applications (Apple as third-party beneficiary, maintenance, warranty, product/IP claims, legal compliance)? Should we simply adopt Apple's standard EULA instead? |
| 6 | **Subscription / auto-renewal disclosures** | Apple handles billing, but do we meet auto-renewal disclosure/consent rules that may apply (e.g. US state ARL laws, EU/UK)? Is our trial-forfeiture wording correct? |
| 7 | **Clickwrap enforceability** | See §3 — is our acceptance mechanism + record sufficient? |

---

## 6. Data-protection review (Privacy Policy)

- **Applicable regimes:** the policy references **Jersey Data Protection Law**. Given UK/EU/US users, please advise whether **UK GDPR / EU GDPR** also apply and what that requires (lawful basis, controller identity, data-subject rights, representative, transfer mechanism).
- **International transfers:** data sits with US/EU providers. Is our one-line "appropriate safeguards" statement enough, or do we need SCCs / named transfer mechanisms?
- **Sub-processor DPAs:** do we need Data Processing Agreements with Firebase/Vercel/SendGrid/Anthropic/Gemini, and should they be named/linked?
- **AI processing:** we disclose that photos are sent to Anthropic (recipe import) and Gemini (photo enhance) only on user action. Is this disclosure sufficient?
- **Children:** accounts are 18+, but adults may add family members — **including children — by name and photo**. Please advise on COPPA / UK-GDPR "children's data" exposure and whether our current wording is adequate.
- **Cookies/local storage:** we use essential local storage only, no ad/tracking cookies. Confirm whether any consent banner is required for our regions.

---

## 7. Known gaps we're already aware of

These are flagged for your view — you may have more:

- **Operator identity not stated.** The documents say "we/us" but name no legal entity, registration number, or address. Consumer law generally requires clear trader identity. **We will provide the entity details; please tell us exactly what must appear and where.**
- **Privacy Policy "last updated" date is stale** (still 31 May 2026) relative to the Terms (9 July 2026). We'll sync it — flagging so you review the current text, not the date.
- **No dispute-resolution / arbitration clause** beyond the Jersey courts provision. Advise if one is warranted.
- **No explicit consumer cancellation/withdrawal ("cooling-off") language** beyond Apple's cancellation mechanics.
- **No cookie/consent banner** on the web app.

---

## 8. Output we'd find most useful

1. A marked-up version (or comment list) of the two documents.
2. A short prioritised list: **must-fix before launch** vs **nice-to-have**.
3. The exact **operator-identity / mandatory-disclosure** text to insert.
4. A yes/no on whether our **Jersey governing-law + liability/indemnity** structure holds up for international consumers, with recommended edits.

*Developer note: the Terms are versioned via `src/lib/legal.ts` (`TERMS_VERSION`) and mirrored in the iOS app's `Sources/Core/Legal.swift`. Any change that alters user obligations should bump that version so acceptance records stay meaningful.*
