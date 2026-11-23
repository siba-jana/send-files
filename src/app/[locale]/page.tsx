import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site/header";
import { HubHero } from "@/components/site/hub-hero";
import { ToolsGrid } from "@/components/site/tools-grid";
import { StatsStrip } from "@/components/site/stats-strip";
import { Faq, HUB_FAQS } from "@/components/site/faq";
import { Footer } from "@/components/site/footer";
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
 * JSON-LD structured data for the localized homepage hub.
 */
function StructuredData({ locale }: { locale: Locale }) {
  const dict = dictionaries[locale] || dictionaries.en;
  const hub = dict.hub || dictionaries.en.hub!;
  const faqItems =
    hub?.faqItems && hub.faqItems.length > 0 ? hub.faqItems : HUB_FAQS;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/${locale}#website`,
        name: SITE_NAME,
        url: `${SITE_URL}/${locale}`,
        description: hub.metaDesc || hub.subtitle,
        inLanguage: locale,
        hasPart: [
          {
            "@type": "WebApplication",
            name: `${SITE_NAME} — ${hub.transferCardTitle}`,
            url: `${SITE_URL}/${locale}/files-transfer-online`,
            applicationCategory: "UtilityApplication",
            applicationSubCategory: "File Transfer Tool",
            operatingSystem: "Any (web browser)",
            isAccessibleForFree: true,
          },
          {
            "@type": "WebApplication",
            name: `${SITE_NAME} — ${hub.chatGptCardTitle}`,
            url: `${SITE_URL}/${locale}/chatgpt-to-pdf`,
            applicationCategory: "UtilityApplication",
            applicationSubCategory: "Document Converter",
            operatingSystem: "Any (web browser)",
            isAccessibleForFree: true,
          },
        ],
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
      title: sParams.admin !== undefined ? "Admin Console — I Love Doc" : undefined,
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
  const hub = dict.hub || dictionaries.en.hub!;

  const languagesRecord: Record<string, string> = {};
  for (const item of SUPPORTED_LOCALES) {
    languagesRecord[item.code] = `${SITE_URL}/${item.code}`;
  }

  const pageTitle = `${SITE_NAME} — ${hub.metaTitle || hub.titlePre + hub.titleHighlight}`;
  const pageDescription = hub.metaDesc || hub.subtitle;

  return {
    title: pageTitle,
    description: pageDescription,
    keywords: [
      "free document tools",
      "online document tools",
      "send big files online free",
      "files transfer online",
      "chatgpt to pdf",
      "p2p file transfer",
      "free online file sharing",
      "browser document tools",
      "ilovedoc",
    ],
    alternates: {
      canonical: `${SITE_URL}/${validLocale}`,
      languages: languagesRecord,
    },
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      url: `${SITE_URL}/${validLocale}`,
      siteName: SITE_NAME,
      locale: validLocale,
      type: "website",
      images: [
        {
          url: "/og-image.jpg",
          width: 1216,
          height: 640,
          alt: "I Love Doc — Free Online Document & File Tools",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: pageDescription,
      images: ["/og-image.jpg"],
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

  const dict = dictionaries[locale as Locale] || dictionaries.en;
  const sParams = await searchParams;

  if (sParams.admin !== undefined) {
    redirect(`/${locale}/admin`);
  }

  // If a share token or code is opened on the homepage, redirect to the dedicated transfer tool
  if (sParams.t || sParams.code) {
    const q = new URLSearchParams();
    if (typeof sParams.t === "string") q.set("t", sParams.t);
    if (typeof sParams.code === "string") q.set("code", sParams.code);
    redirect(`/${locale}/files-transfer-online?${q.toString()}`);
  }

  return (
    <I18nProvider initialLocale={locale as Locale}>
      <div className="min-h-screen flex flex-col bg-background">
        <StructuredData locale={locale as Locale} />
        <SiteHeader />
        <main className="flex-1">
          {/* Main Hub: Hero and Tool Showcase Cards */}
          <HubHero />
          <ToolsGrid />
          <StatsStrip />
          <Faq
            items={dict.hub?.faqItems || HUB_FAQS}
            heading={dict.hub?.faqHeading || dict.faq?.heading}
            subheading={dict.hub?.faqSubheading || dict.faq?.subheading}
          />
        </main>
        <Footer />
      </div>
    </I18nProvider>
  );
}
