import type { MetadataRoute } from "next";
import { SUPPORTED_LOCALES } from "@/i18n/locales";

/**
 * Sitemap for crawlers (docs/SPEC.md §seo).
 *
 * Public, indexable routes: the app itself, localized pages, dedicated guide
 * pages, and legal documents.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : "https://www.ilovedoc.org");

export default function sitemap(): MetadataRoute.Sitemap {
  const localizedHomePages: MetadataRoute.Sitemap = SUPPORTED_LOCALES.map((l) => ({
    url: `${SITE_URL}/${l.code}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 1,
  }));

  const localizedFilesTransferOnlinePages: MetadataRoute.Sitemap =
    SUPPORTED_LOCALES.map((l) => ({
      url: `${SITE_URL}/${l.code}/files-transfer-online`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    }));

  return [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...localizedHomePages,
    {
      url: `${SITE_URL}/files-transfer-online`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...localizedFilesTransferOnlinePages,
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
