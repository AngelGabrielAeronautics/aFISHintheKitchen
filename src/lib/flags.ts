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
 * ⚠ TURNING THIS ON RESTORES NOTHING. The in-browser app's page routes were
 * DELETED on 2026-08-14 — /recipes, /submit, /meal-planner, /shopping-list,
 * /collections, /tips, /members, /settings, /setup, /account and /auth, about
 * 11,000 lines. They were unreachable behind the proxy and unexercised since
 * the native pivot, so they could only rot and mislead.
 *
 * The flag survives because the proxy still needs to know the shape of the
 * product, and because the marketing site's own behaviour keys off it. If a web
 * app is ever wanted again it gets written against today's data model, not
 * recovered from git.
 */
export const WEB_APP_ENABLED = false;
