import { NextResponse } from "next/server";

export const runtime = "edge";

// Map ISO country codes to display currency. Home market is ZA → ZAR; common
// English-speaking + eurozone markets get their local currency; everyone else
// (including local dev with no header) falls back to USD as the global default.
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  ZA: "ZAR",
  US: "USD",
  CA: "USD",
  GB: "GBP",
  IE: "EUR",
  AU: "AUD",
  NZ: "AUD",
  // Eurozone
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", BE: "EUR",
  PT: "EUR", AT: "EUR", FI: "EUR", GR: "EUR", LU: "EUR", SK: "EUR",
  SI: "EUR", EE: "EUR", LV: "EUR", LT: "EUR", MT: "EUR", CY: "EUR", HR: "EUR",
};

export async function GET(req: Request) {
  const country = req.headers.get("x-vercel-ip-country") ?? "";
  const currency = COUNTRY_TO_CURRENCY[country] ?? "USD";
  return NextResponse.json({ country, currency });
}
