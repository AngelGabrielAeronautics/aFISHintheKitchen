#!/usr/bin/env node
/**
 * The FAQ exists in three codebases. Prove they still agree.
 *
 * ⚠ WHY. The same list lives in web `src/lib/faqs.ts`, iOS `LandingView.swift`
 * and Android `LandingScreen.kt`, and it HAS drifted before by being edited in
 * one place — a gifting answer was reworded on the web and quietly disagreed
 * with both apps for days. Nothing catches that by eye; the questions match
 * and only the answers differ.
 *
 * Run:  node scripts/check-faq-parity.mjs
 * Exits non-zero on any difference, so it can gate a release.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(web, "..");
const IOS = join(root, "App Files/ios app/afishinthekitchen-ios/Sources/Views/Auth/LandingView.swift");
const AND = join(root, "App Files/android app/app/src/main/java/angelgabriel/afishinthekitchen/ui/auth/LandingScreen.kt");

/** Swift writes “ as \u{201C}; compare the characters, not the escapes. */
const unescapeSwift = (s) => s.replace(/\\u\{([0-9A-Fa-f]+)\}/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
const norm = (s) => unescapeSwift(s).replace(/\\"/g, '"').replace(/\s+/g, " ").trim();

function fromWeb() {
  const src = readFileSync(join(web, "src/lib/faqs.ts"), "utf8");
  const out = new Map();
  // q: "…", then the first a: "…" after it (comments may sit between them).
  const re = /q:\s*"((?:[^"\\]|\\.)*)"\s*,[\s\S]*?a:\s*"((?:[^"\\]|\\.)*)"\s*,/g;
  for (const m of src.matchAll(re)) out.set(norm(m[1]), norm(m[2]));
  return out;
}

function fromIos() {
  const src = readFileSync(IOS, "utf8");
  const out = new Map();
  const re = /FAQ\(q:\s*"((?:[^"\\]|\\.)*)",\s*a:\s*"((?:[^"\\]|\\.)*)"\)/g;
  for (const m of src.matchAll(re)) out.set(norm(m[1]), norm(m[2]));
  return out;
}

function fromAndroid() {
  const src = readFileSync(AND, "utf8");
  const out = new Map();
  // "question" to\n  "part " +\n  "part"
  const re = /"([^"\n]+\?)"\s+to\s*\n((?:\s*"(?:[^"\\]|\\.)*"\s*\+?\s*\n?)+)/g;
  for (const m of src.matchAll(re)) {
    const body = [...m[2].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1]).join("");
    out.set(norm(m[1]), norm(body));
  }
  return out;
}

const sources = { web: fromWeb(), ios: fromIos(), android: fromAndroid() };
const counts = Object.entries(sources).map(([k, v]) => `${k} ${v.size}`).join("  ");
console.log(`FAQ parity — ${counts}`);

const problems = [];
const all = new Set(Object.values(sources).flatMap((m) => [...m.keys()]));
for (const q of all) {
  const seen = Object.entries(sources).map(([name, m]) => [name, m.get(q)]);
  const missing = seen.filter(([, a]) => a === undefined).map(([n]) => n);
  if (missing.length) {
    problems.push(`MISSING from ${missing.join(", ")}: ${q}`);
    continue;
  }
  const [, first] = seen[0];
  if (seen.some(([, a]) => a !== first)) {
    problems.push(
      `ANSWERS DIFFER: ${q}\n` +
        seen.map(([n, a]) => `      ${n.padEnd(8)} ${a.slice(0, 120)}`).join("\n"),
    );
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s):\n`);
  problems.forEach((p) => console.error("  - " + p));
  console.error("\nFix the wording in all three, then re-run.");
  process.exit(1);
}
console.log(`✓ all ${all.size} questions match across web, iOS and Android`);
