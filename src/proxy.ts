import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "./i18n/locales";

const supportedCodes = new Set(SUPPORTED_LOCALES.map((l) => l.code));

function getPreferredLocale(request: NextRequest): string {
  // 1. Check NEXT_LOCALE cookie
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  if (cookieLocale && supportedCodes.has(cookieLocale as any)) {
    return cookieLocale;
  }

  // 2. Check Accept-Language header
  const acceptLang = request.headers.get("accept-language");
  if (acceptLang) {
    const preferences = acceptLang
      .split(",")
      .map((part) => {
        const [lang, q] = part.trim().split(";q=");
        return {
          lang: lang.trim().slice(0, 2).toLowerCase(),
          q: q ? parseFloat(q) : 1.0,
        };
      })
      .sort((a, b) => b.q - a.q);

    for (const pref of preferences) {
      if (supportedCodes.has(pref.lang as any)) {
        return pref.lang;
      }
    }
  }

  return DEFAULT_LOCALE;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    const locale = getPreferredLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}`;
    return NextResponse.redirect(url);
  }

  if (pathname === "/files-transfer-online") {
    const locale = getPreferredLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/files-transfer-online`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/files-transfer-online"],
};
