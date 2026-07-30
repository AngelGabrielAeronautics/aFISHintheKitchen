# Deleting accounts and cookbooks

Two different operations. Keeping them apart is the whole design — see
`src/lib/delete-data.ts` and the public promise on `/delete-account`.

| | What goes | Who triggers it |
|---|---|---|
| **Account deletion** | The person's account and the data that is theirs alone | The user, in the app |
| **Cookbook deletion** | A whole cookbook: content, media, share links | The owner, by email → an operator |

Deleting one person's account must **never** wipe a cookbook other people are
still using. That is why account deletion stops at the user's own data even when
they own a cookbook.

## Account deletion (automatic)

The app re-authenticates the user, then `POST /api/delete-account` with their ID
token. It removes, in this order:

1. `userPreferences/{uid}`
2. The AI throttle counters (`authEmailThrottle`, `checkThrottle`,
   `enhanceThrottle`, `tagThrottle`, `importThrottle`, `suggestThrottle`)
3. `deviceTokens` where `uid ==` — otherwise a deleted user's phone keeps
   receiving a family's push notifications
4. The Firebase Auth user **last**

⚠ The ordering is deliberate. If a step fails, the account still exists, we can
still tell whose data it is, and the call is safe to retry. Deleting the sign-in
first would leave data with nothing left to identify its owner.

## Cookbook deletion (on request, 30-day SLA)

`/delete-account` tells owners to email us, and promises completion within 30
days. Do it with the super-admin action, not by hand in the Firebase console —
hand-deleting missed Cloud Storage every time:

```
POST /api/admin/actions
Authorization: Bearer <super-admin ID token>

{
  "householdId": "<id>",
  "action": "delete_household",
  "confirmName": "<the cookbook's exact name>"
}
```

`confirmName` must match the household's `name` exactly, or the call is refused
with the expected value. A household id is unmemorable and a stale one is easy to
paste; the name is the check that stops the wrong family's cookbook being wiped.

It returns a per-collection report — use it to answer the requester with what was
actually removed.

### Before you run it

1. **Confirm identity.** The request must come from the email address on the
   account. Do not act on a request that names a cookbook the sender doesn't own.
2. **Tell the other members**, or confirm the owner has. Everyone they invited
   loses the recipes, photos and notes they contributed.
3. **Check the backups are current** (they are automatic, but check): Firestore
   PITR gives 7 days, daily backups 14 days, weekly 14 weeks. Cloud Storage keeps
   deleted objects for 90 days.

## What is not deleted, and why

- **Cookbooks the requester doesn't own.** Anything they added to someone else's
  cookbook belongs to that cookbook.
- **Recipes they contributed to their family's cookbook**, on an account
  deletion. Their name stays as attribution, the way a name in a cookbook stays
  in it.
- **Billing and tax records**, which the law requires us to keep. Financial
  records, not recipes.
- **Orphaned media.** Storage deletion works from the URLs on the documents, so a
  file no document points at — an AI-enhanced photo the cook previewed and
  rejected, a replaced cover — is not found. It is unreachable (the URL is
  unguessable and nothing links to it) but it is still stored. Worth a periodic
  sweep if the bill ever justifies one.

⚠ **Never delete Storage by prefix.** `recipe-images/{slug}/` looks
household-scoped and is not: a slug is unique only *within* a cookbook
(`getRecipeBySlug` scopes by `householdId`). Two families can each own a
"Chakalaka" and share `recipe-images/chakalaka/`. Deleting that prefix would take
one family's photos while deleting another's cookbook.

## The lapse sweep

`api/cron/lapse-sweep` runs the same `deleteHouseholdData` at day 365 of a lapsed
subscription, but **only when `LAPSE_HARD_DELETE=true`**. With it unset the cron
logs that a household is past its horizon and leaves it alone, which is the safer
default.
