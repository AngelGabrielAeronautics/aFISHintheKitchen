import type { MetadataRoute } from "next";

const BASE = "https://afishinthekitchen.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // The in-browser app isn't a public product (native-only), and the
      // token-only share links and API aren't for crawling — keep them out of
      // search results. Everything else (landing, our story, legal) is allowed
      // by default.
      disallow: [
        "/auth",
        "/account",
        "/recipes",
        "/meal-planner",
        "/collections",
        "/members",
        "/settings",
        "/shopping-list",
        "/submit",
        "/tips",
        "/setup",
        "/admin",
        "/superadmin",
        "/r/",
        "/m/",
        "/api/",
      ],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
