"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  dictionaries,
  getLocaleMeta,
  isSupportedLocale,
} from "./locales";
import { Dictionary, Direction, Locale, LocaleMeta } from "./types";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dir: Direction;
  isRTL: boolean;
  dict: Dictionary;
  meta: LocaleMeta;
  supportedLocales: LocaleMeta[];
  t: (path: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "ilovedoc_locale";
const COOKIE_NAME = "NEXT_LOCALE";

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;

  try {
    // 1. Check localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && isSupportedLocale(saved)) {
      return saved;
    }

    // 2. Check Cookie
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`)
    );
    if (match && isSupportedLocale(match[1])) {
      return match[1];
    }

    // 3. Check browser language (e.g. 'es-ES' -> 'es')
    if (navigator.language) {
      const code = navigator.language.slice(0, 2).toLowerCase();
      if (isSupportedLocale(code)) {
        return code;
      }
    }
  } catch {
    // Ignore storage/cookie access errors
  }

  return DEFAULT_LOCALE;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(
    initialLocale && isSupportedLocale(initialLocale)
      ? initialLocale
      : DEFAULT_LOCALE
  );

  // Sync on mount: if route specifies an initialLocale, ensure it persists;
  // otherwise fallback to client preferences or browser detection.
  useEffect(() => {
    if (initialLocale && isSupportedLocale(initialLocale)) {
      setLocaleState(initialLocale);
      try {
        localStorage.setItem(STORAGE_KEY, initialLocale);
        document.cookie = `${COOKIE_NAME}=${initialLocale}; path=/; max-age=31536000; SameSite=Lax`;
      } catch {
        // Storage access may fail in certain private modes
      }
      return;
    }

    const detected = getInitialLocale();
    if (detected !== locale) {
      setLocaleState(detected);
    }
  }, [initialLocale]);

  const meta = useMemo(() => getLocaleMeta(locale), [locale]);
  const dir = meta.dir;
  const isRTL = dir === "rtl";
  const dict = dictionaries[locale] || dictionaries[DEFAULT_LOCALE];
  const fallbackDict = dictionaries[DEFAULT_LOCALE];

  const setLocale = useCallback((newLocale: Locale) => {
    if (!isSupportedLocale(newLocale)) return;
    setLocaleState(newLocale);

    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
      document.cookie = `${COOKIE_NAME}=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // Storage access may fail in certain private modes
    }

    const newMeta = getLocaleMeta(newLocale);
    document.documentElement.lang = newLocale;
    document.documentElement.dir = newMeta.dir;
  }, []);

  // Update <html> lang and dir when locale changes
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const t = useCallback(
    (path: string, params?: Record<string, string | number>): string => {
      let val = getNestedValue(dict as unknown as Record<string, unknown>, path);
      if (typeof val !== "string") {
        val = getNestedValue(
          fallbackDict as unknown as Record<string, unknown>,
          path
        );
      }

      if (typeof val !== "string") {
        return path;
      }

      if (params) {
        let result = val;
        for (const [k, v] of Object.entries(params)) {
          result = result.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
        return result;
      }

      return val;
    },
    [dict, fallbackDict]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      dir,
      isRTL,
      dict,
      meta,
      supportedLocales: SUPPORTED_LOCALES,
      t,
    }),
    [locale, setLocale, dir, isRTL, dict, meta, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}

