import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AdminApp } from "@/components/admin/admin-app";
import { isSupportedLocale, SUPPORTED_LOCALES } from "@/i18n/locales";
import {
  adminCookieName,
  usingDefaultAdminPassword,
  verifyAdminSessionToken,
} from "@/lib/server/admin-auth";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((l) => ({ locale: l.code }));
}

export const metadata: Metadata = {
  title: "Admin Console — I Love Doc",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
  },
};

export default async function LocalizedAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(adminCookieName())?.value;
  const isAuthenticated = verifyAdminSessionToken(token);
  const usingDefault = usingDefaultAdminPassword();

  return (
    <AdminApp
      initialAuthenticated={isAuthenticated}
      usingDefaultPassword={usingDefault}
    />
  );
}
