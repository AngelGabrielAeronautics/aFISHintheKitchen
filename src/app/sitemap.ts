import type { MetadataRoute } from "next";

const BASE = "https://afishinthekitchen.com";

// Public, crawlable pages only — the marketing landing, our story, and legal.
// The app pages and token-only share links are intentionally excluded.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${BASE}/our-story`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/delete-account`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
