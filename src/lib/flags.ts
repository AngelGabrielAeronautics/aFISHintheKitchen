/**
 * Product-shape switches. One place, so the gate and the UI cannot disagree.
 *
 * ⚠ WHY THIS EXISTS. `BLOCK_WEB_APP` lived only inside proxy.ts, so the PROXY
 * knew the in-browser app was withdrawn and the UI did not. The result, found
 * 2026-08-14: the site still rendered the full app to anyone signed in — a
 * dashboard at "/" and a navigation offering Recipes, Add Recipe, Meal Planner,
 * Shopping List, Event Menus, Tips and The Family, every one of which the proxy
 * bounced straight back to "/". An app-shaped website where nothing works.
 *
 * A flag that only half the codebase can see is not a flag.
 */

/**
 * Is the in-browser version of the app offered?
 *
 * FALSE is the shipped state: the product is the iOS and Android apps. The
 * website is marketing, the legal pages, the FAQ, the public share links and
 * the back office — nothing you sign into and use as a cookbook.
 *
 * ⚠ Turning this on again does NOT restore a working web app on its own. The
 * page routes still exist (see src/app/recipes, /meal-planner, /tips …) but
 * have not been exercised since the native pivot, and the apps have moved on
 * without them.
 */
export const WEB_APP_ENABLED = false;
