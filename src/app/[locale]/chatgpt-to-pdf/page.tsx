import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { I18nProvider } from "@/i18n/context";
import {
  DEFAULT_LOCALE,
  dictionaries,
  isSupportedLocale,
  SUPPORTED_LOCALES,
} from "@/i18n/locales";
import { Locale } from "@/i18n/types";
import { ChatGptToPdfApp } from "@/components/chatgpt-to-pdf/chatgpt-to-pdf-app";
import { ChatGptFeatureSection } from "@/components/chatgpt-to-pdf/chatgpt-feature-section";
import { Sparkles, ShieldCheck, FileCheck, Printer } from "lucide-react";

const SITE_URL = "https://ilovedoc.org";
const SITE_NAME = "I Love Doc";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((l) => ({ locale: l.code }));
}

/**
 * JSON-LD structured data for the ChatGPT to PDF Converter tool.
 */
function StructuredData({ locale }: { locale: Locale }) {
  const dict = dictionaries[locale] || dictionaries.en;
  const toolDict = dict.chatgptToPdf;
  const pageTitle = toolDict?.title || "ChatGPT to PDF Converter";
  const pageDesc =
    toolDict?.subtitle ||
    "Convert ChatGPT text, code snippets, LaTeX math equations, and conversations into print-ready PDF documents with 100% in-browser privacy.";

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${SITE_URL}/${locale}/chatgpt-to-pdf#webapp`,
        name: `${SITE_NAME} — ${pageTitle}`,
        alternateName: "ChatGPT to PDF",
        url: `${SITE_URL}/${locale}/chatgpt-to-pdf`,
        description: pageDesc,
        applicationCategory: "UtilityApplication",
        applicationSubCategory: "PDF Converter",
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
          "100% In-Browser Privacy — No Server Uploads",
          "Code Blocks with Syntax Highlighting",
          "LaTeX Math Equation Rendering (KaTeX)",
          "Markdown Tables & Checklist Support",
          "A4 & US Letter Standard Paper Sizes",
          "Instant Vector Print to PDF & Direct File Download",
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/${locale}/chatgpt-to-pdf#website`,
        name: SITE_NAME,
        url: `${SITE_URL}/${locale}/chatgpt-to-pdf`,
        description: pageDesc,
        publisher: {
          "@id": `${SITE_URL}/${locale}/chatgpt-to-pdf#webapp`,
        },
        inLanguage: locale,
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
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const validLocale = (
    isSupportedLocale(locale) ? locale : DEFAULT_LOCALE
  ) as Locale;

  const dict = dictionaries[validLocale] || dictionaries.en;
  const toolDict = dict.chatgptToPdf;

  const languagesRecord: Record<string, string> = {};
  for (const item of SUPPORTED_LOCALES) {
    languagesRecord[item.code] = `${SITE_URL}/${item.code}/chatgpt-to-pdf`;
  }

  const pageTitle = toolDict?.title
    ? `${toolDict.title} — ${SITE_NAME}`
    : `Convert ChatGPT Text to PDF Online (Free, Fast & Easy) — ${SITE_NAME}`;
  const pageDescription =
    toolDict?.subtitle ||
    "Easily convert ChatGPT conversations, prompts, code snippets, and markdown text into professional, print-ready PDF documents. Includes LaTeX math, syntax highlighting, and 100% browser privacy.";

  return {
    title: pageTitle,
    description: pageDescription,
    keywords: [
      "chatgpt to pdf",
      "convert chatgpt text to pdf",
      "chatgpt export to pdf",
      "save chatgpt conversation as pdf",
      "chatgpt markdown to pdf",
      "chatgpt code to pdf",
      "chatgpt pdf converter free",
      "print chatgpt to pdf",
    ],
    alternates: {
      canonical: `${SITE_URL}/${validLocale}/chatgpt-to-pdf`,
      languages: languagesRecord,
    },
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      url: `${SITE_URL}/${validLocale}/chatgpt-to-pdf`,
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

export default async function ChatGptToPdfPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const dict = dictionaries[locale] || dictionaries.en;
  const toolDict = dict.chatgptToPdf;

  return (
    <I18nProvider initialLocale={locale}>
      <StructuredData locale={locale} />
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <SiteHeader />

        <main className="flex-1">
          {/* Main App Workspace */}
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <ChatGptToPdfApp />

            {/* Explanatory Guide, Features & FAQ */}
            <ChatGptFeatureSection />
          </div>
        </main>

        <Footer />
      </div>
    </I18nProvider>
  );
}

