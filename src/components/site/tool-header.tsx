"use client";

import {
  ArrowLeftRight,
  BadgeCheck,
  Clock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/i18n/context";

export function ToolHeader() {
  const { t } = useI18n();

  const trustItems = [
    { icon: ShieldCheck, label: t("hero.trustE2e") },
    { icon: ArrowLeftRight, label: t("hero.trustP2p") },
    { icon: Clock, label: t("hero.trustNoSignup") },
    { icon: BadgeCheck, label: t("hero.trustSha256") },
  ];

  return (
    <section id="top" className="relative isolate overflow-hidden pt-8 pb-2 sm:pt-12 sm:pb-4 text-center">
      {/* Decorative background: soft subtle radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(244,63,94,0.12),transparent_70%)] dark:bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(244,63,94,0.08),transparent_70%)]" />
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 sm:px-6">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3.5 py-1 text-xs font-semibold text-rose-700 shadow-sm dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <Sparkles aria-hidden="true" className="size-3.5" />
          {t("hero.badge")}
        </span>

        <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
          {t("hero.titlePre")}
          <span className="text-rose-600 dark:text-rose-500">
            {t("hero.titleHighlight")}
          </span>
          {t("hero.titlePost")}
        </h1>

        <p className="mt-2.5 max-w-xl text-pretty text-sm text-muted-foreground sm:text-base">
          {t("hero.subtitle")}
        </p>

        <ul
          aria-label="Key guarantees"
          className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2"
        >
          {trustItems.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:text-sm"
            >
              <Icon
                aria-hidden="true"
                className="size-3.5 text-rose-600 dark:text-rose-500 sm:size-4"
              />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

