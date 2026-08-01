// Store listing URLs for the native apps. Leave empty until each listing is
// live — the StoreBadges component renders a "Coming soon" badge for any empty
// URL, and flips it to a real download link the moment you paste one in.
// Live since 28 July 2026. Deliberately the region-less /app/id… form rather
// than the /us/app/… one Apple redirects to — it sends each visitor to their
// own storefront, which matters for a family spread across South Africa, the
// UK and Jersey.
export const APP_STORE_URL = "https://apps.apple.com/app/id6780944935";

// Live since 1 August 2026 (production release 3, 177 countries). No `hl`/`gl`
// parameters for the same reason the Apple link has no region: Play picks the
// visitor's own locale, and pinning one sends a South African relative to a
// storefront listing in the wrong currency.
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=angelgabriel.afishinthekitchen";
