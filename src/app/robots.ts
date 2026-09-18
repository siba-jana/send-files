import type { MetadataRoute } from "next";

/**
 * robots.txt via the Next.js metadata route convention (replaces the old
 * static public/robots.txt). Search crawlers get the full site; the transfer
 * pages themselves emit per-request `noindex` meta when `?t=`/`?code=` is
 * present, which is the correct mechanism for private, ephemeral URLs.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : "https://www.ilovedoc.org");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
