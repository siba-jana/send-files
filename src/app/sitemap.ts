import type { MetadataRoute } from "next";

/**
 * Sitemap for crawlers (docs/SPEC.md §seo).
 *
 * Public, indexable routes: the app itself (`/`) and the two dedicated
 * guide pages. Transfer share links are `/?t=<token>` / `/?code=<digits>`
 * query variants that are (a) noindexed at render time and (b) ephemeral —
 * neither belongs in a sitemap. API routes are omitted (non-HTML).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://ilovedoc.org/",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://ilovedoc.org/send-large-files",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: "https://ilovedoc.org/how-it-works",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];
}
