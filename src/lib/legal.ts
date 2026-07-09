// Single source of truth for the legal-document version. Bump TERMS_VERSION
// (and TERMS_UPDATED) whenever the Terms of Service change materially — signup
// records the version a user accepted, so this string is what we store.
// Keep in sync with the iOS copy in Sources/Core/Legal.swift.
export const TERMS_VERSION = "2026-07-09";
export const TERMS_UPDATED = "9 July 2026";
export const PRIVACY_UPDATED = "9 July 2026";

// The operator behind "A Fish in the Kitchen" — a Jersey registered business
// name held by an individual (a sole trader, not a limited company). Consumer
// law requires this trader identity + geographic address to appear in the
// legal documents. Shown publicly on /terms and /privacy.
export const OPERATOR = {
  name: "Dylan Glen Coppard",
  tradingAs: "PNB Apps Apps N Apps",
  registration:
    "a business name registered in Jersey under the Registration of Business Names (Jersey) Law 1956 (certificate no. 36758)",
  address: "Glenmoor, L'Amont de la Ville Bagot, St. Ouen, Jersey JE3 2DF",
  email: "admin@afishinthekitchen.com",
} as const;
