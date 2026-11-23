"use client";

import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowRight,
  BadgeCheck,
  Clock,
  FileText,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/context";
import { dictionaries } from "@/i18n/locales";

export function HubHero() {
  const { locale, dict } = useI18n();
  const hub = dict.hub || dictionaries.en.hub!;

  const transferUrl = `/${locale}/files-transfer-online`;
  const textToPdfUrl = `/${locale}/text-to-pdf`;
  const chatGptPdfUrl = `/${locale}/chatgpt-to-pdf`;

  const trustItems = [
    { icon: ShieldCheck, label: dict.hero.trustE2e },
    { icon: ArrowLeftRight, label: dict.hero.trustP2p },
    { icon: Clock, label: dict.hero.trustNoSignup },
    { icon: BadgeCheck, label: dict.hero.trustSha256 },
  ];

  return (
    <section id="top" className="relative isolate overflow-hidden pt-12 pb-8 sm:pt-16 sm:pb-12 text-center">
      {/* Subtle radial glow background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(244,63,94,0.12),transparent_70%)] dark:bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(244,63,94,0.08),transparent_70%)]" />
        <div className="absolute inset-0 [background-image:radial-gradient(rgba(15,23,42,0.08)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_35%,black_25%,transparent_75%)] dark:[background-image:radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)]" />
      </div>

      <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 sm:px-6">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3.5 py-1 text-xs font-semibold text-rose-700 shadow-xs dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <Sparkles aria-hidden="true" className="size-3.5" />
          {hub.badge}
        </span>

        <h1 className="mt-4 text-balance text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
          {hub.titlePre}
          <span className="text-rose-600 dark:text-rose-500">
            {hub.titleHighlight}
          </span>
          {hub.titlePost}
        </h1>

        <p className="mt-3.5 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
          {hub.subtitle}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
          <Button
            size="lg"
            asChild
            className="h-12 rounded-xl bg-rose-600 px-6 text-base font-semibold text-white shadow-md shadow-rose-600/20 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600"
          >
            <Link href={transferUrl}>
              <Send aria-hidden="true" className="size-4" />
              {hub.transferCardTitle}
            </Link>
          </Button>

          <Button
            size="lg"
            variant="outline"
            asChild
            className="h-12 rounded-xl border-blue-500/40 bg-blue-500/5 px-6 text-base font-semibold text-blue-700 hover:bg-blue-500/10 dark:border-blue-500/40 dark:text-blue-400 dark:hover:bg-blue-500/20"
          >
            <Link href={textToPdfUrl}>
              <FileText aria-hidden="true" className="size-4 text-blue-600 dark:text-blue-400" />
              Text to PDF
              <ArrowRight aria-hidden="true" className="size-4 opacity-70" />
            </Link>
          </Button>

          <Button
            size="lg"
            variant="outline"
            asChild
            className="h-12 rounded-xl border-emerald-500/40 bg-emerald-500/5 px-6 text-base font-semibold text-emerald-700 hover:bg-emerald-500/10 dark:border-emerald-500/40 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
          >
            <Link href={chatGptPdfUrl}>
              <Sparkles aria-hidden="true" className="size-4 text-emerald-600 dark:text-emerald-400" />
              {hub.chatGptCardTitle}
              <ArrowRight aria-hidden="true" className="size-4 opacity-70" />
            </Link>
          </Button>
        </div>

        <ul
          aria-label="Key guarantees"
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm text-muted-foreground"
        >
          {trustItems.map(({ icon: Icon, label }) => (
            <li key={label} className="inline-flex items-center gap-1.5">
              <Icon aria-hidden="true" className="size-4 text-rose-600 dark:text-rose-400" />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
