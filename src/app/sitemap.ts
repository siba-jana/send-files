import type { MetadataRoute } from "next";

/**
 * Sitemap for crawlers (docs/SPEC.md §seo).
 *
 * Public, indexable routes: the app itself (`/`), the two dedicated guide
 * pages, and the legal documents. Transfer share links are `/?t=<token>` /
 * `/?code=<digits>` query variants that are (a) noindexed at render time and
 * (b) ephemeral — neither belongs in a sitemap. API routes are omitted
 * (non-HTML).
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : "https://www.ilovedoc.org");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/send-large-files`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/how-it-works`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/legal/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/legal/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/legal/dmca`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
