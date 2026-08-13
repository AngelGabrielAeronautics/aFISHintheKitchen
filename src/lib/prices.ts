// Store prices, shared by the marketing landing and /gift.
//
// ⚠ THIS LIVES IN lib/, NOT IN LandingPage.tsx, and that is the whole point.
// It was briefly exported from that component — which is a CLIENT component —
// and imported by /gift, a server component. That 500'd the page in
// production. `next build` did not catch it: /gift is force-dynamic, so it is
// never rendered at build time and the failure only exists at request time.
//
// ⚠ These must match StoreKit, because this page is where someone decides to
// trust us and the App Store is where they're charged. The previous values were
// pre-billing guesses ("refine when payment provider is wired") and were never
// refined: the site advertised R99 while South Africans were charged R119.99,
// and £4.99 while the UK was charged £5.99 — both about a fifth under, in the
// two markets this app actually has.
//
// Apple sets these from its own price tiers, so they don't track FX and they
// change when Apple adjusts a tier. If you change the tier in App Store
// Connect, change it here in the same sitting.
// ⚠ `gift` is a ONE-OFF purchase of a year, priced to match the annual
// subscription — and quoted at APPLE's tier, which is what the rest of this
// table already uses.
//
// ⚠ The two stores do NOT charge the same. Play's own regional table puts the
// GB annual at £53.99 where Apple's tier is £59.99. Quoting the HIGHER of the
// two is deliberate: the documented failure of this table was under-quoting
// (the site said £4.99 while the UK was charged £5.99), and a Play buyer
// pleasantly surprised is a far better outcome than an Apple buyer who feels
// misled at checkout.
export type CurrencyCode = "ZAR" | "USD" | "GBP" | "EUR" | "AUD";
export const PLAN_PRICES: Record<
  CurrencyCode,
  { prefix: string; monthly: string; annual: string; gift: string }
> = {
  ZAR: { prefix: "R", monthly: "119.99", annual: "1,199.99", gift: "1,199.99" },
  USD: { prefix: "$", monthly: "5.99", annual: "59.99", gift: "59.99" },
  GBP: { prefix: "£", monthly: "5.99", annual: "59.99", gift: "59.99" },
  EUR: { prefix: "€", monthly: "6.99", annual: "69.99", gift: "69.99" },
  AUD: { prefix: "A$", monthly: "9.99", annual: "99.99", gift: "99.99" },
};


/**
 * Which currency a visitor is shown, by ISO country.
 *
 * ⚠ ONE map, shared by /api/geo (the landing) and /gift. There were two, and
 * they disagreed: Jersey fell through to USD on the landing and to GBP on the
 * gift page, so the same visitor saw $5.99 and £59.99 two clicks apart.
 *
 * ⚠ JE / GG / IM were missing entirely — the Channel Islands and the Isle of
 * Man all pay in sterling, and Jersey is where this business is REGISTERED and
 * where its owner lives. The home market was being quoted in dollars.
 */
export const COUNTRY_TO_CURRENCY: Record<string, CurrencyCode> = {
  ZA: "ZAR",
  US: "USD", CA: "USD",
  GB: "GBP", JE: "GBP", GG: "GBP", IM: "GBP",
  IE: "EUR",
  AU: "AUD", NZ: "AUD",
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", BE: "EUR",
  PT: "EUR", AT: "EUR", FI: "EUR", GR: "EUR", LU: "EUR", SK: "EUR",
  SI: "EUR", EE: "EUR", LV: "EUR", LT: "EUR", MT: "EUR", CY: "EUR", HR: "EUR",
};

/** Falls back to USD, the global default, for anywhere unlisted. */
export function currencyForCountry(country: string | null | undefined): CurrencyCode {
  return COUNTRY_TO_CURRENCY[(country ?? "").toUpperCase()] ?? "USD";
}
