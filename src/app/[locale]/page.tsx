import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/header";
import { Hero } from "@/components/site/hero";
import { TransferWidget } from "@/components/transfer/transfer-widget";
import { StatsStrip } from "@/components/site/stats-strip";
import { HowItWorks } from "@/components/site/how-it-works";
import { SecuritySection } from "@/components/site/security-section";
import { Faq } from "@/components/site/faq";
import { FAQS } from "@/components/site/faq-data";
import { Footer } from "@/components/site/footer";
import { AdminApp } from "@/components/admin/admin-app";
import { I18nProvider } from "@/i18n/context";
import {
  DEFAULT_LOCALE,
  dictionaries,
  isSupportedLocale,
  SUPPORTED_LOCALES,
} from "@/i18n/locales";
import { Locale } from "@/i18n/types";

const SITE_URL = "https://ilovedoc.org";
const SITE_NAME = "I Love Doc";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((l) => ({ locale: l.code }));
}

/**
 * JSON-LD structured data for the localized homepage.
 */
function StructuredData({ locale }: { locale: Locale }) {
  const dict = dictionaries[locale] || dictionaries.en;
  const faqItems =
    dict.faq?.items && dict.faq.items.length > 0 ? dict.faq.items : FAQS;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${SITE_URL}/${locale}#webapp`,
        name: SITE_NAME,
        alternateName: "ilovedoc.org",
        url: `${SITE_URL}/${locale}`,
        description: dict.hero.subtitle,
        applicationCategory: "UtilityApplication",
        applicationSubCategory: "File Transfer",
        operatingSystem: "Any (web browser)",
        browserRequirements:
          "Requires JavaScript. Supports Chrome, Edge, Firefox, and Safari.",
        isAccessibleForFree: true,
        inLanguage: locale,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        featureList: [
          dict.hero.trustE2e,
          dict.hero.trustP2p,
          dict.hero.trustNoSignup,
          dict.hero.trustSha256,
          dict.common.sendFiles,
          dict.common.receiveFiles,
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/${locale}#website`,
        name: SITE_NAME,
        url: `${SITE_URL}/${locale}`,
        description: dict.hero.subtitle,
        publisher: { "@id": `${SITE_URL}/${locale}#webapp` },
        inLanguage: locale,
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/${locale}#faq`,
        mainEntity: faqItems.map((item) => ({
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

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { locale } = await params;
  const sParams = await searchParams;
  const isPrivateView = Boolean(sParams.t || sParams.code || sParams.admin);

  if (isPrivateView) {
    return {
      robots: {
        index: false,
        follow: false,
        noarchive: true,
        nocache: true,
      },
    };
  }

  const validLocale = (
    isSupportedLocale(locale) ? locale : DEFAULT_LOCALE
  ) as Locale;
  const dict = dictionaries[validLocale] || dictionaries.en;

  const languagesRecord: Record<string, string> = {};
  for (const item of SUPPORTED_LOCALES) {
    languagesRecord[item.code] = `${SITE_URL}/${item.code}`;
  }

  return {
    title: `${SITE_NAME} — ${dict.hero.titlePre}${dict.hero.titleHighlight}${dict.hero.titlePost}`,
    description: dict.hero.subtitle,
    alternates: {
      canonical: `${SITE_URL}/${validLocale}`,
      languages: languagesRecord,
    },
  };
}

export default async function LocalizedHome({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const sParams = await searchParams;
  const isPrivateTransfer = Boolean(sParams.t || sParams.code);

  if (sParams.admin !== undefined) {
    return <AdminApp />;
  }

  return (
    <I18nProvider initialLocale={locale as Locale}>
      <div className="min-h-screen flex flex-col bg-background">
        {!isPrivateTransfer && <StructuredData locale={locale as Locale} />}
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
    </I18nProvider>
  );
}
