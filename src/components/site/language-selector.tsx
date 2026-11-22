"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/i18n/context";
import { isSupportedLocale } from "@/i18n/locales";
import { Locale } from "@/i18n/types";
import { cn } from "@/lib/utils";

export interface LanguageSelectorProps {
  className?: string;
  variant?: "header" | "mobile";
}

export function LanguageSelector({
  className,
  variant = "header",
}: LanguageSelectorProps) {
  const router = useRouter();
  const { locale, setLocale, supportedLocales, meta } = useI18n();

  const handleSelectLocale = React.useCallback(
    (targetLocale: Locale) => {
      setLocale(targetLocale);

      if (typeof window === "undefined") return;

      const currentPath = window.location.pathname;
      const search = window.location.search;
      const hash = window.location.hash;

      const segments = currentPath.split("/").filter(Boolean);

      let newPath = "";
      if (segments.length === 0) {
        newPath = `/${targetLocale}`;
      } else if (isSupportedLocale(segments[0])) {
        segments[0] = targetLocale;
        newPath = `/${segments.join("/")}`;
      } else {
        newPath = `/${targetLocale}`;
      }

      router.push(`${newPath}${search}${hash}`);
    },
    [router, setLocale]
  );

  if (variant === "mobile") {
    return (
      <div className={cn("flex flex-col gap-1 py-1", className)}>
        <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Language / Idioma / 语言
        </p>
        <div className="grid grid-cols-2 gap-1 px-1">
          {supportedLocales.map((item) => {
            const isSelected = item.code === locale;
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => handleSelectLocale(item.code as Locale)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                  isSelected
                    ? "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <span className="text-base" role="img" aria-label={item.name}>
                  {item.flag}
                </span>
                <span className="truncate">{item.nativeName}</span>
                {isSelected && (
                  <Check className="ml-auto size-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-9 gap-1.5 px-2.5 text-muted-foreground hover:text-foreground md:px-3",
            className
          )}
          aria-label={`Select language. Current language: ${meta.nativeName}`}
        >
          <Globe className="size-4 shrink-0" aria-hidden="true" />
          <span className="text-sm" role="img" aria-label={meta.name}>
            {meta.flag}
          </span>
          <span className="hidden text-xs font-medium sm:inline-block">
            {meta.nativeName}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 max-h-80 overflow-y-auto p-1.5"
      >
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          Select Language
        </div>
        {supportedLocales.map((item) => {
          const isSelected = item.code === locale;
          return (
            <DropdownMenuItem
              key={item.code}
              onClick={() => handleSelectLocale(item.code as Locale)}
              className={cn(
                "flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-sm outline-none transition-colors",
                isSelected &&
                  "bg-rose-50 font-medium text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
              )}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base" role="img" aria-label={item.name}>
                  {item.flag}
                </span>
                <div className="flex flex-col">
                  <span>{item.nativeName}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {item.name}
                  </span>
                </div>
              </div>
              {isSelected && (
                <Check className="size-4 text-rose-600 dark:text-rose-400" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
