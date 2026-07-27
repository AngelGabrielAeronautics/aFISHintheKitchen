import { NextResponse } from "next/server";

// Digital Asset Links — the Android counterpart to apple-app-site-association.
// Without this file every afishinthekitchen.com link opens in Chrome instead of
// the app, no matter what the Android manifest declares: `autoVerify="true"`
// makes the system fetch this at install time and refuse to claim the domain
// if the app's signing certificate isn't listed here.
//
// Must be served from
// https://www.afishinthekitchen.com/.well-known/assetlinks.json
// as application/json with no redirect.
//
// ⚠ The RELEASE fingerprint is the one from **Play App Signing** (Play Console
// → Setup → App integrity → App signing key certificate), NOT the upload key.
// Play re-signs the app, so listing the upload key means verification fails for
// everyone who installs from the store while working fine locally.
const PACKAGE = "angelgabriel.afishinthekitchen";

const FINGERPRINTS = [
  // Debug keystore (~/.android/debug.keystore) — lets links work on a dev
  // device. Harmless in production: it only ever matches a locally-built APK.
  "82:0D:04:EA:03:59:6E:36:3D:D8:01:F0:56:D2:1B:B5:8C:9C:37:20:C0:CD:18:39:6D:D2:96:F9:4C:E8:AE:B3",
  // TODO: add the Play App Signing certificate once the Play app exists.
  // Until then, store installs will open links in the browser.
];

const ASSET_LINKS = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: PACKAGE,
      sha256_cert_fingerprints: FINGERPRINTS,
    },
  },
];

export function GET() {
  return NextResponse.json(ASSET_LINKS, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
