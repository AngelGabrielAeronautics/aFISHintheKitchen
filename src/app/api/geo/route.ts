import { NextResponse } from "next/server";
// ⚠ Shared with /gift — see the note in lib/prices.ts about the two maps that
// disagreed, and about Jersey being quoted in dollars.
import { currencyForCountry } from "@/lib/prices";

export const runtime = "edge";

export async function GET(req: Request) {
  const country = req.headers.get("x-vercel-ip-country") ?? "";
  const currency = currencyForCountry(country);
  return NextResponse.json({ country, currency });
}
