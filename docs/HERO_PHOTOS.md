# Cookbook hero photos

The big photo behind a cookbook's name on the Recipes screen. An owner picks
one in **More → Cookbook Settings → Home hero photo**, or uploads their own.

## How it works (since 2026-08-24)

The list is **data**, not an enum compiled into the apps — add one in the
superadmin console and it appears in every app on the next launch, with no
release. Same move as `docs/LEARN.md`.

- **`heroPresets`** (Firestore): `{ label, url, storagePath, sortOrder,
  createdAt }`. Rules: signed-in read, no client writes.
- **`/api/admin/hero-presets`**: GET (list + who uses what) · POST multipart
  (uploads to Storage with a `firebaseStorageDownloadTokens` metadata token so
  the URL is publicly readable, then writes the doc) · PATCH (rename, or
  reorder by swapping `sortOrder`) · DELETE.
- The apps read the collection and **prepend "Classic" themselves** — it is
  the app-bundled image (`HeroBackground`, byte-identical to `public/hero.jpg`)
  and is deliberately NOT in the collection, so the picker still offers
  something offline or if the fetch fails.
- A household stores its choice as `customisation.heroUrl` (empty = Classic).

⚠ **DELETE removes a preset from the PICKER and leaves the Storage file
alone.** Families already using that photo hold the URL on their own household
doc and would go blank — see the 2026-08-13 storage incident.

⚠ **The web home page ignores `customisation.heroUrl`** and hardcodes
`/hero.jpg`. Harmless while the web app is gated off; fix if it's revived.

## What makes a good hero

Wide and landscape (16:9 works well), under 8MB. The cookbook name, tagline
and logo are overlaid across the middle, so the centre wants to be calm and
darker — Classic works because the wood there is quiet. Warm, rustic and
lived-in beats styled and busy.

## Queued: four photos to generate

Not yet made — Higgsfield generation needs its MCP connector authenticated
(the CLI is blocked on this account's plan). Nano Banana Pro, 16:9, 2k,
2 credits each.

Chosen to fill real gaps: the existing set has no fire, no fish in a
fish-named app, nothing in the red/gold register, and no picture of the thing
the whole product is about — a family table.

**1. Braai**
> A wide cinematic photograph of a South African braai at golden hour: coiled
> boerewors sausage on a grill over glowing wood coals, lamb chops beside it,
> thin smoke drifting through warm light. In the soft-focus foreground, the
> edge of a weathered wooden table with a bowl of chakalaka relish. Rich amber
> firelight, deep earthy shadows, shot from a three-quarter angle slightly
> above. Shallow depth of field, calm uncluttered darker area across the lower
> middle of the frame. Photographic and natural, not styled. No people, no
> text, no logos, no watermarks.

**2. The Family Table**
> A wide overhead photograph of a laden family dinner table on weathered dark
> wood: a roast chicken, bowls of vegetables, a torn loaf of bread, a jug of
> water, mismatched plates and worn cutlery, crumpled linen napkins. Warm
> late-afternoon window light from the left, long soft shadows. Homely and
> lived-in rather than styled — a table people are about to eat at. Muted
> earthy greens, creams and browns. Open space between the dishes through the
> middle of the frame. No people, no text, no logos, no watermarks.

**3. Fresh Fish**
> A wide cinematic photograph of a whole fresh fish on a weathered wooden
> board, silver scales catching the light, with lemon halves, coarse sea salt,
> flat-leaf parsley and a worn kitchen knife beside it. Cool morning light
> from a window on the left, warm wood tones beneath. Rustic coastal kitchen,
> shallow depth of field, shot from a low three-quarter angle. Calm
> uncluttered space through the lower centre. No people, no text, no logos, no
> watermarks.

**4. Curry Night**
> A wide cinematic photograph of a rich curry in a cast-iron pot on a dark
> rustic table, surrounded by small bowls of spices — turmeric, cumin, dried
> chillies — with fresh coriander and a stack of warm flatbread to one side.
> Deep warm reds and golds, moody side lighting, faint steam rising. Shot from
> a three-quarter angle slightly above. Uncluttered darker area across the
> lower middle of the frame. No people, no text, no logos, no watermarks.
