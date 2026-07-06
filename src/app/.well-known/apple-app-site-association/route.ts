import { NextResponse } from "next/server";

// Apple App Site Association — lets the iOS app claim invite links as Universal
// Links. Scoped to /auth links that carry an `email` query param (i.e. invite
// emails) so a plain /auth link still opens in the browser, not the app.
// Must be served from https://www.afishinthekitchen.com/.well-known/apple-app-site-association
// as application/json with no redirect. Apple fetches it at app-install time.
const AASA = {
  applinks: {
    details: [
      {
        appIDs: ["5PD7YC868K.angelgabriel.afishinthekitchen"],
        components: [
          {
            "/": "/auth",
            "?": { email: "?*" },
            comment: "Invite links (carry ?email=) open the app; plain /auth stays on web.",
          },
          {
            "/": "/r/*",
            comment: "Shared-recipe links open in the app when installed; web page otherwise.",
          },
        ],
      },
    ],
  },
};

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(AASA, {
    headers: { "Content-Type": "application/json" },
  });
}
