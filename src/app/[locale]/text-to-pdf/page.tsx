import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, ShieldCheck, UserCheck } from "lucide-react";

import { SiteHeader } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { I18nProvider } from "@/i18n/context";
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  SUPPORTED_LOCALES,
} from "@/i18n/locales";
import { Locale } from "@/i18n/types";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { TextToPdfTool } from "@/components/pdf-tool/text-to-pdf-tool";
import { TextFeatureSection } from "@/components/pdf-tool/text-feature-section";
import { faqItems } from "@/lib/seo-faq";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.ilovedoc.org";
const SITE_NAME = "I Love Doc";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((l) => ({ locale: l.code }));
}

/**
 * JSON-LD structured data for the Text to PDF Converter tool.
 */
function StructuredData({ locale }: { locale: Locale }) {
  const pageTitle = "Text to PDF Converter — Free Online";
  const pageDesc =
    "Convert text to PDF online for free. Type or paste your content, customize fonts, margins, page size, headers, footers, and download professional PDF documents instantly.";

  const softwareAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Text to PDF Converter",
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any (web browser)",
    url: `${SITE_URL}/${locale}/text-to-pdf`,
    description: pageDesc,
    isAccessibleForFree: true,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Rich text formatting",
      "Full page control (page size, orientation, margins)",
      "Headers, footers, and page numbers",
      "Text watermarks",
      "Live PDF preview",
      "Unicode and multilingual text support",
      "Private local processing in the browser",
      "Free and unlimited conversions",
    ],
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };

  const faqPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  const breadcrumbListJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${SITE_URL}/${locale}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Text to PDF Converter",
        item: `${SITE_URL}/${locale}/text-to-pdf`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareAppJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbListJsonLd),
        }}
      />
    </>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const validLocale = (
    isSupportedLocale(locale) ? locale : DEFAULT_LOCALE
  ) as Locale;

  const languagesRecord: Record<string, string> = {};
  for (const item of SUPPORTED_LOCALES) {
    languagesRecord[item.code] = `${SITE_URL}/${item.code}/text-to-pdf`;
  }

  const pageTitle = `Convert Text to PDF Online (Free & Fast) — ${SITE_NAME}`;
  const pageDescription =
    "Convert text to PDF online for free. Type or paste your content, customize fonts, margins, page size, headers, footers, and download professional PDF documents instantly.";

  return {
    title: pageTitle,
    description: pageDescription,
    keywords: [
      "text to pdf",
      "convert text to pdf",
      "text to pdf converter",
      "txt to pdf",
      "rich text to pdf",
      "online pdf creator",
      "free text to pdf",
      "multilingual text to pdf",
    ],
    alternates: {
      canonical: `${SITE_URL}/${validLocale}/text-to-pdf`,
      languages: languagesRecord,
    },
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      url: `${SITE_URL}/${validLocale}/text-to-pdf`,
      siteName: SITE_NAME,
      type: "website",
      locale: validLocale,
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: pageDescription,
    },
  };
}

export default async function TextToPdfPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  return (
    <I18nProvider initialLocale={locale}>
      <StructuredData locale={locale} />
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <SiteHeader />

        <main className="flex-1">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
            <Breadcrumb aria-label="Breadcrumb">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href={`/${locale}`}>Home</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Text to PDF Converter</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <section id="converter" className="scroll-mt-20 pb-8 pt-6 sm:pb-10">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Free Text to PDF Converter Online
              </h1>
              <p className="mt-4 max-w-3xl text-base text-muted-foreground sm:text-lg">
                Convert your text into professional PDF documents online for free.
                Type or paste your content, customize fonts, formatting, page size,
                margins, headers, footers, and other document settings. Preview your
                PDF before downloading. No software installation or registration
                required.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  <BadgeCheck aria-hidden="true" className="mr-1.5 size-4" />
                  100% Free
                </Badge>
                <Badge variant="secondary">
                  <UserCheck aria-hidden="true" className="mr-1.5 size-4" />
                  No sign-up required
                </Badge>
                <Badge variant="secondary">
                  <ShieldCheck aria-hidden="true" className="mr-1.5 size-4" />
                  Private — runs in your browser
                </Badge>
              </div>
            </section>

            <section
              aria-label="Text to PDF converter tool"
              className="pb-12 sm:pb-16"
            >
              <TextToPdfTool />
            </section>

            <TextFeatureSection />
          </div>
        </main>

        <Footer />
      </div>
    </I18nProvider>
  );
}
