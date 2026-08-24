import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifySuperAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The hero photos a new owner picks from, and who is actually using them.
//
// ⚠ THE LIST LIVES IN THE APPS. This mirrors `HeroPreset` in the iOS app
// (Sources/Views/Account/SettingsView.swift) and its Android twin — adding or
// removing an OPTION needs an app release. The IMAGES do not: each preset is
// a Storage object, so replacing the file changes the photo for everyone with
// no release at all. Worth knowing before anyone plans a reshoot.
//
// "Classic" is the app-bundled image and has no URL; the web's /hero.jpg is
// byte-identical to the iOS asset (verified 2026-08-24), so it stands in here.

const STORAGE = "https://firebasestorage.googleapis.com/v0/b/a-fish-in-the-kitchen.firebasestorage.app/o/hero-presets%2F";

const PRESETS = [
  { key: "standard", label: "Classic", url: null as string | null, displayUrl: "/hero.jpg" },
  { key: "roast", label: "Sunday Roast", url: `${STORAGE}preset-roast.jpg?alt=media`, displayUrl: `${STORAGE}preset-roast.jpg?alt=media` },
  { key: "baking", label: "Baking Day", url: `${STORAGE}preset-baking.jpg?alt=media`, displayUrl: `${STORAGE}preset-baking.jpg?alt=media` },
  { key: "garden", label: "From the Garden", url: `${STORAGE}preset-garden.jpg?alt=media`, displayUrl: `${STORAGE}preset-garden.jpg?alt=media` },
  { key: "teatime", label: "Tea Time", url: `${STORAGE}preset-teatime.jpg?alt=media`, displayUrl: `${STORAGE}preset-teatime.jpg?alt=media` },
];

export async function GET(req: NextRequest) {
  const auth = await verifySuperAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const snap = await getAdminDb().collection("households").get();
  const books = snap.docs.map((d) => ({
    name: (d.data().name as string) ?? d.id,
    heroUrl: ((d.data().customisation?.heroUrl as string | undefined) ?? "").trim(),
  }));

  const presetUrls = new Set(PRESETS.map((p) => p.url).filter(Boolean) as string[]);

  // ⚠ Each preset is fetched for real. A preset whose Storage object has gone
  // missing is a broken tile in every new owner's picker, and nothing else
  // would ever tell us — the apps just render a blank rectangle.
  const presets = await Promise.all(
    PRESETS.map(async (p) => {
      let status: number | string = "n/a (bundled in the apps)";
      if (p.url) {
        try {
          const res = await fetch(p.url, { method: "HEAD", cache: "no-store" });
          status = res.status;
        } catch {
          status = "unreachable";
        }
      }
      const usedBy = books.filter((b) =>
        p.url ? b.heroUrl === p.url : b.heroUrl === ""
      );
      return { ...p, status, usedBy: usedBy.length, usedByNames: usedBy.map((b) => b.name) };
    })
  );

  const custom = books
    .filter((b) => b.heroUrl !== "" && !presetUrls.has(b.heroUrl))
    .map((b) => ({ name: b.name, url: b.heroUrl }));

  return NextResponse.json({ presets, custom, totalHouseholds: books.length });
}
