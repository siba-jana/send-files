import { notFound } from "next/navigation";
import { isSupportedLocale, SUPPORTED_LOCALES } from "@/i18n/locales";
import { I18nProvider } from "@/i18n/context";
import { Locale } from "@/i18n/types";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((l) => ({ locale: l.code }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  return (
    <I18nProvider initialLocale={locale as Locale}>
      {children}
    </I18nProvider>
  );
}

