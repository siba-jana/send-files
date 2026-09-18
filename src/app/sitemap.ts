import type { MetadataRoute } from "next";

/**
 * Sitemap for crawlers (docs/SPEC.md §seo).
 *
 * The app is a single user-facing route (`/`): transfer share links are
 * `/?t=<token>` / `/?code=<digits>` query variants that are (a) noindexed at
 * render time and (b) ephemeral — neither belongs in a sitemap. API routes
 * are omitted (non-HTML).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://ilovedoc.org/",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
