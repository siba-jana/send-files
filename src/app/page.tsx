import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/header";
import { Hero } from "@/components/site/hero";
import { TransferWidget } from "@/components/transfer/transfer-widget";
import { StatsStrip } from "@/components/site/stats-strip";
import { HowItWorks } from "@/components/site/how-it-works";
import { SecuritySection } from "@/components/site/security-section";
import { Faq, FAQS } from "@/components/site/faq";
import { Footer } from "@/components/site/footer";

const SITE_URL = "https://ilovedoc.org";
const SITE_NAME = "I Love Doc";
const SITE_DESCRIPTION =
  "Fast peer-to-peer file sharing with encrypted WebRTC connections and automatic relay fallback when needed. No permanent cloud storage, no sign-up — just connect and transfer.";

/**
 * JSON-LD structured data (docs/SPEC.md §seo): WebApplication + WebSite +
 * FAQPage in a single @graph. The FAQ entities are generated from the very
 * same FAQS array the visible accordion renders — structured data can never
 * drift from on-page copy. Server-rendered; private transfer views (?t= /
 * ?code=) skip it entirely.
 */
function StructuredData() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${SITE_URL}/#webapp`,
        name: SITE_NAME,
        alternateName: "ilovedoc.org",
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        applicationCategory: "UtilityApplication",
        applicationSubCategory: "File Transfer",
        operatingSystem: "Any (web browser)",
        browserRequirements: "Requires JavaScript. Supports Chrome, Edge, Firefox, and Safari.",
        isAccessibleForFree: true,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        featureList: [
          "Peer-to-peer file transfer over WebRTC",
          "End-to-end DTLS encryption",
          "Password-protected transfers",
          "SHA-256 integrity verification",
          "Automatic resume after connection drops",
          "Automatic expiry with no permanent storage",
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        publisher: { "@id": `${SITE_URL}/#webapp` },
        inLanguage: "en",
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        mainEntity: FAQS.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.a,
          },
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

/**
 * Transfer links (`/?t=<token>`) and code entries (`/?code=<digits>`) are
 * private, ephemeral pages — keep them out of search engines entirely.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const isPrivateTransfer = Boolean(params.t || params.code);
  if (isPrivateTransfer) {
    return {
      robots: {
        index: false,
        follow: false,
        noarchive: true,
        nocache: true,
      },
    };
  }
  return {};
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const isPrivateTransfer = Boolean(params.t || params.code);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Structured data only on the clean, public homepage — never on
          private transfer views (they are noindex and may contain tokens). */}
      {!isPrivateTransfer && <StructuredData />}
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <TransferWidget />
        <StatsStrip />
        <HowItWorks />
        <SecuritySection />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
