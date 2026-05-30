# A Fish in the Kitchen

A multi-tenant family-cookbook web app. Each family runs its own private cookbook — recipes, kitchen tips, event menus, meal plans and shopping lists — under one shared platform. Started as the Coppard & Fish family's own book and is being grown into a white-label product (see `PHASE2-PLAN.md`).

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **Firebase** — Auth, Firestore, Storage (client SDK in the browser; Admin SDK in API routes)
- **SendGrid** — invite emails
- **Anthropic API** — AI recipe import
- **Vercel** — hosting + scheduled cron

> **Note:** This repo pins a Next.js version with breaking changes vs. older docs. Before writing Next-specific code, read the relevant guide in `node_modules/next/dist/docs/`. See `AGENTS.md`.

## Getting started

```bash
npm install
cp .env.local.example .env.local   # then fill in the values (see below)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

## Environment

Copy `.env.local.example` to `.env.local` and fill in:

- **`NEXT_PUBLIC_FIREBASE_*`** — Firebase web config (safe to expose; these reach the browser).
- **`SENDGRID_API_KEY` / `SENDGRID_FROM_EMAIL`** — invite delivery.
- **`FIREBASE_SERVICE_ACCOUNT_B64`** — base64-encoded service-account JSON for the Admin SDK in API routes. Firebase Console → Project Settings → Service Accounts → Generate new private key, then `base64 -i service-account.json`.
- **`ANTHROPIC_API_KEY`** — AI recipe import.
- **`BILLING_WEBHOOK_SECRET`** — shared secret for the billing webhook (placeholder until a payment provider is chosen).
- **`CRON_SECRET`** — bearer token Vercel sends to the scheduled lapse-sweep route.
- **`LAPSE_HARD_DELETE`** — `false` by default; set `true` only when the lapse sweep should permanently delete data past the 1-year suspension horizon.

Server-only secrets must **not** be prefixed with `NEXT_PUBLIC_`.

## Architecture

### Multi-tenancy

Every family is a **household**. All app data — `recipes`, `members`, `collections`, `tips`, `notifications`, `mealPlans`, `invitedUsers` — carries a `householdId`, and every scoped read filters on it. A user can own one cookbook and be a guest member of others.

- `AuthContext` — Firebase auth state.
- `HouseholdContext` — loads the user's memberships, resolves the active household (persisted in `localStorage`), and exposes `access` (`canView` / `canEdit` / `canManage`).
- `households/{id}` denormalises `memberIds` so Firestore rules can authorise membership in a single read.

### Access & subscriptions

`src/lib/access.ts` is the **single source of truth** for the access model — pure, Firebase-free logic that the Firestore rules mirror so client and server enforce the same thing:

- 5 member seats per owner, 14-day trial, up to 3 guest cookbooks per user.
- **Lapse ladder:** grace (0–7d, full access) → read-only (7–30d) → suspended (30d+) → data deleted at ~365d.
- A daily Vercel cron (`/api/cron/lapse-sweep`, 03:00 UTC) advances each household's mirrored `accessState` and performs deletions past the horizon.

### Data layer

`src/lib/firebase-recipes.ts` holds the Firestore read/write functions (client SDK). Household-scoped reads take a required `householdId: string | null` — the argument is mandatory and a null id returns empty/null, so no read ever runs an unscoped, cross-household query.

Privileged work lives in API routes (`src/app/api/`): billing webhook, lapse-sweep cron, invites (SendGrid), AI recipe import (Anthropic), join, admin actions, geo lookup.

## Firebase

Rules and indexes are version-controlled and deployed via the Firebase CLI:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

- `firestore.rules` — access enforcement (mirrors `src/lib/access.ts`)
- `firestore.indexes.json` — composite indexes (mostly `householdId` + sort field)
- `storage.rules` — Storage access

Default project is `a-fish-in-the-kitchen` (`.firebaserc`).

## Deployment

Hosted on Vercel. `vercel.json` registers the daily lapse-sweep cron. Set all environment variables in the Vercel project settings (the same keys as `.env.local`).
