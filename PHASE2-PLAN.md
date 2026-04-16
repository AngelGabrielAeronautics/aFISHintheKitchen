# Phase 2: Multi-Tenant Family Cookbook Platform

## Overview

Transform "A Fish in the Kitchen" from a single-family app into a white-label platform where any family can create their own private cookbook.

---

## Architecture: How Multi-Tenancy Works

### The Household Model

Every family gets a **Household** — an isolated container for all their data.

```
households/{householdId}
  - name: "The Coppard Kitchen"
  - slug: "coppard-kitchen"
  - customisation: { brandName, tagline, primaryColor, logoUrl }
  - plan: "free" | "premium"
  - createdAt
  - ownerId (Firebase UID of the person who created it)
```

All existing collections get a `householdId` field. Every query filters by it. Every write includes it. Users never see data from other households.

### Data Structure (Before vs After)

**Before:** `recipes/{recipeId}` — one flat collection, all recipes visible to everyone

**After:** `recipes/{recipeId}` with `householdId: "abc123"` — same collection, but every query includes `where("householdId", "==", currentHouseholdId)`

This is simpler than subcollections and keeps Firestore queries straightforward.

---

## Technical Changes (Ordered by Priority)

### 1. Household & Membership System

**New collections:**
- `households/{id}` — household config, customisation, plan
- `householdMembers/{id}` — maps userId to householdId (a user can belong to multiple households)

**New context:** `HouseholdContext` wraps the app, provides `currentHouseholdId` to all components and data functions.

**User flow:**
1. Sign up -> create a household OR accept an invite to join one
2. If user belongs to multiple households -> household switcher in header
3. All data reads/writes scoped to `currentHouseholdId`

**Effort:** Medium. New context, new collections, invite flow update.

### 2. Scope All Data Functions

Every function in `firebase-recipes.ts` gets a `householdId` parameter:

```typescript
// Before
export async function getAllRecipes(): Promise<Recipe[]> {
  const q = query(recipesCollection(), orderBy("createdAt", "desc"));
  ...
}

// After
export async function getAllRecipes(householdId: string): Promise<Recipe[]> {
  const q = query(recipesCollection(), where("householdId", "==", householdId), orderBy("createdAt", "desc"));
  ...
}
```

**Collections affected:** recipes, members, collections, tips, notifications, mealPlans, invitedUsers

**Effort:** Large but mechanical. ~67 functions to update, plus every page that calls them.

### 3. Firestore Security Rules

Rules enforce that users can only access data in households they belong to:

```
match /recipes/{recipeId} {
  allow read: if request.auth != null && 
    exists(/databases/$(database)/documents/householdMembers/$(request.auth.uid + '_' + resource.data.householdId));
  allow create: if request.auth != null && 
    exists(/databases/$(database)/documents/householdMembers/$(request.auth.uid + '_' + request.resource.data.householdId));
}
```

**Effort:** Medium. One rule pattern, applied to all collections.

### 4. Firestore Indexes

New composite indexes needed for every collection:
- `recipes`: `householdId` + `createdAt` (desc)
- `recipes`: `householdId` + `category`
- `recipes`: `householdId` + `slug`
- `tips`: `householdId` + `createdAt` (desc)
- `tips`: `householdId` + `linkedRecipeIds` (array-contains)
- etc.

**Effort:** Small. Define in `firestore.indexes.json`, deploy once.

### 5. Customisation System

Each household can configure:
- **Brand name** (replaces "A Fish in the Kitchen")
- **Tagline** (replaces "Family Recipes Worth Catching")
- **Logo** (uploaded to Storage)
- **Primary colour** (replaces terracotta)
- **Family members** (managed per household)

Stored in the `households/{id}` document. Loaded by `HouseholdContext` and applied via CSS custom properties.

**Effort:** Medium. Header, footer, and theme need to read from context instead of hardcoded values.

### 6. Storage Isolation

Storage paths include householdId:
```
{householdId}/recipe-images/{slug}/{filename}
{householdId}/tip-images/{tipId}/{filename}
{householdId}/logo.png
```

**Effort:** Small. Update upload functions to prefix with householdId.

---

## Monetisation

### Recommended Model: Freemium

**Free tier:**
- 1 household
- Up to 20 recipes
- Up to 3 family members
- Basic features (recipes, ingredients, instructions)

**Premium tier (R49/month or $5/month):**
- Unlimited recipes
- Unlimited family members
- Cooking mode with timers
- Meal planner
- Shopping lists
- Event menus with assignments
- Tips & Tricks
- Notifications
- Custom branding
- Priority support

### Payment Integration

- **Stripe Checkout** — simplest to implement. User clicks "Upgrade", redirected to Stripe, webhook updates household plan.
- **Stripe Customer Portal** — for managing subscription (cancel, update card).
- Store `stripeCustomerId` and `plan` on the household document.
- A `checkPremium()` helper gates premium features.

**Effort:** Medium. Stripe integration, webhook handler (Next.js API route or Firebase Function), feature gating.

---

## Onboarding Flow

### New User Journey

1. **Landing page** — marketing site explaining the product
2. **Sign up** — email/password (or Google auth later)
3. **Create household** — name your family cookbook, invite members
4. **Seed or start fresh** — option to add a few starter recipes or start empty
5. **Dashboard** — the app, scoped to their household

### Invite Flow (Updated)

Current: Admin adds email to invitedUsers -> person signs up.
New: Household owner invites email -> invitation email sent -> person signs up and auto-joins that household.

---

## Migration Plan (Your Family's Data)

Your current data becomes the first household:

1. Create a `households/coppard` document
2. Run a migration script that adds `householdId: "coppard"` to every existing recipe, member, collection, tip, notification, mealPlan document
3. Create `householdMembers` docs for all existing users
4. Your family continues using the app without noticing anything changed

**Effort:** Small. One-time script.

---

## Implementation Order

### Sprint 1: Foundation (Week 1-2)
- [ ] Household and HouseholdMembers collections + types
- [ ] HouseholdContext provider
- [ ] Migrate all data functions to accept householdId
- [ ] Update all pages to pass householdId from context
- [ ] Migration script for existing data
- [ ] Updated Firestore rules and indexes

### Sprint 2: Onboarding (Week 3)
- [ ] Landing/marketing page
- [ ] Create household flow
- [ ] Updated invite system (per-household)
- [ ] Household settings page (name, logo, members)

### Sprint 3: Customisation (Week 4)
- [ ] Per-household branding (name, tagline, logo, colour)
- [ ] CSS custom properties for theming
- [ ] Household switcher (if user belongs to multiple)

### Sprint 4: Monetisation (Week 5)
- [ ] Stripe integration (Checkout + webhooks)
- [ ] Free/premium feature gating
- [ ] Stripe Customer Portal for subscription management
- [ ] Usage limits on free tier

### Sprint 5: Polish & Launch (Week 6)
- [ ] Landing page finalisation
- [ ] SEO, social sharing per household
- [ ] App Store / Play Store via PWA
- [ ] Analytics (basic usage tracking)
- [ ] Launch

---

## Cost Estimate (Running the Platform)

| Service | Free Tier | At Scale (500 families) |
|---------|-----------|------------------------|
| Vercel | Free | ~$20/month (Pro) |
| Firebase Firestore | 50K reads/day free | ~$25/month |
| Firebase Auth | 10K users free | Free |
| Firebase Storage | 5GB free | ~$5/month |
| Stripe | 2.9% + 30c per transaction | ~$75/month in fees on $2,500 revenue |
| Custom domain | Already owned | $12/year |
| **Total** | **~$0/month** | **~$50/month** |

At 500 families paying $5/month = **$2,500/month revenue** against **~$50/month costs**. That's 98% margin.

---

## Risk Mitigation

- **Start with your family as the guinea pig** — multi-tenant version should work identically for you before anyone else touches it
- **Don't build a full admin dashboard** — use Firebase Console for the first 50 households
- **Don't over-customise** — start with name + logo only. Add colour theming later if people ask.
- **Keep the free tier generous enough** to be useful — people won't pay if they can't try it properly first

---

## Decision Points (Need Your Input)

1. **Domain strategy** — one domain (fishkitchen.app/coppard) or custom subdomains (coppard.fishkitchen.app)?
2. **Auth providers** — keep email/password only, or add Google sign-in?
3. **Product name** — keep "A Fish in the Kitchen" as the platform name, or rebrand? The current name is great for your family but might not resonate as a generic product.
4. **Mobile app** — PWA is already good. Worth building a native app later, or keep PWA?
