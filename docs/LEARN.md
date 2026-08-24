# Learn — the app finally gives something back

Agreed with Dylan 2026-08-24. The strategic gap: the app is one-way — users
deposit their own data and retrieve it, and once the recipes are in there is
no reason to open the app until you cook. (Evidence: the first three trial
lapses on 21 Aug, and a Tips section users never filled — 5 tips ever, most
cookbooks with none.) Learn makes the app give something back.

## The shape

The **Tips** segment on the Recipes tab is renamed **Learn** and becomes:

1. **From our kitchen** — tips written by A Fish in the Kitchen (global
   content, all users see it).
2. **Videos** — hand-curated YouTube technique videos.
3. **Masterclasses** — curated YouTube *series* ("Bread, week by week"). For
   now sourced from YouTube; our own production is a later ambition, not v1.
4. **From your family** — the existing household tips, unchanged.

⚠ The Family-dock swap was tried and reverted (2026-08) — Learn stays a
segment on the Recipes tab; do not re-propose dock changes.

## The rule that shaped the architecture

**Content must never wait on an app release.** Everything is authored in the
web superadmin console and lands in a global Firestore collection the apps
read live. One app release per platform ships the Learn UI; after that, new
tips/videos/series/ordering are instant.

## Data model — `learnItems` (global collection, NOT household-scoped)

```
{
  type:        "tip" | "video" | "series"
  status:      "draft" | "published"
  title:       string
  body:        string        // tip text / video blurb / series intro
  youtubeId:   string | null // videos only (the 11-char id, never a URL)
  seriesId:    string | null // videos may belong to a series (masterclass)
  seriesOrder: number | null // position within the series
  sortOrder:   number        // manual ordering within its section
  createdAt / updatedAt / publishedAt: ISO strings
  notifiedAt:  string | null // when a broadcast push announced it
}
```

- Rules: signed-in users may read **published** items only; **no client
  writes** — all authoring goes through `/api/admin/learn` (Admin SDK).
- ⚠ Apps must query `where status == "published"` ONLY and sort client-side.
  Adding an orderBy to that query needs an undeclared composite index — and
  those THROW (the gifting lesson). The content set is small; client sort.
- YouTube playback uses the 1.6 embed fix: an IFRAME in a real page with a
  matching origin — never loadData/top-level (Error 153).

## Push

`/api/admin/learn` action `notify` broadcasts to ALL device tokens ("Learn
something new" + the item title, link `/learn`). Manually triggered per item
from the console — deliberately NOT a cron: Vercel Hobby allows only two cron
entries and both are taken (lapse-sweep + one other); a third is silently not
scheduled. Cadence guidance: one push a week, not one per item.

## Phases

1. **DONE HERE (web)**: collection + rules, admin API, superadmin authoring
   UI, broadcast push. Seed tip library drafted by Claude → Dylan signs off.
2. **App release (iOS 1.7 / Android 1.7)**: rename segment to Learn, render
   the four sections, YouTube player, series screen. After iOS 1.6 ships.
3. **Later**: own-voice content, per-user "seen" state, a notification pref
   for Learn pushes, premium series.
