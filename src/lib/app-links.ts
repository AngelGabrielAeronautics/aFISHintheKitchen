// Store listing URLs for the native apps. Leave empty until each listing is
// live — the StoreBadges component renders a "Coming soon" badge for any empty
// URL, and flips it to a real download link the moment you paste one in.
// Live since 28 July 2026. Deliberately the region-less /app/id… form rather
// than the /us/app/… one Apple redirects to — it sends each visitor to their
// own storefront, which matters for a family spread across South Africa, the
// UK and Jersey.
export const APP_STORE_URL = "https://apps.apple.com/app/id6780944935";

// Still empty on purpose: the Play listing isn't submitted yet, and an empty
// string is what renders the "Coming soon" badge. Paste the URL in once it's
// live — nothing else needs changing.
export const PLAY_STORE_URL = ""; // https://play.google.com/store/apps/details?id=angelgabriel.afishinthekitchen
