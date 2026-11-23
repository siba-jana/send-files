"use client";

import Link from "next/link";
import {
  ArrowRight,
  Code2,
  Eye,
  FileText,
  Lock,
  Radio,
  Send,
  ShieldCheck,
  Sparkles,
  Type,
  Zap,
} from "lucide-react";
import { useI18n } from "@/i18n/context";
import { dictionaries } from "@/i18n/locales";

export function ToolsGrid() {
  const { locale, dict } = useI18n();
  const hub = dict.hub || dictionaries.en.hub!;

  const transferUrl = `/${locale}/files-transfer-online`;
  const textToPdfUrl = `/${locale}/text-to-pdf`;
  const chatGptPdfUrl = `/${locale}/chatgpt-to-pdf`;

  const tools = [
    {
      id: "transfer",
      title: hub.transferCardTitle,
      description: hub.transferCardDesc,
      badge: hub.transferCardBadge,
      cta: hub.transferCardCta,
      href: transferUrl,
      icon: Send,
      color: "rose",
      features: [
        { icon: Radio, text: hub.transferFeat1 },
        { icon: Zap, text: hub.transferFeat2 },
        { icon: Lock, text: hub.transferFeat3 },
        { icon: ShieldCheck, text: hub.transferFeat4 },
      ],
    },
    {
      id: "text-pdf",
      title: hub.textToPdfCardTitle || "Text to PDF Converter",
      description:
        hub.textToPdfCardDesc ||
        "Type or paste rich text, format headings, fonts, margins, headers, footers, and download high-quality PDFs with live preview.",
      badge: hub.textToPdfCardBadge || "New",
      cta: hub.textToPdfCardCta || "Open Text to PDF",
      href: textToPdfUrl,
      icon: Type,
      color: "blue",
      features: [
        { icon: Type, text: hub.textToPdfFeat1 || "Rich text editor & formatting" },
        { icon: Eye, text: hub.textToPdfFeat2 || "Live real-time PDF preview" },
        { icon: FileText, text: hub.textToPdfFeat3 || "Page margins, sizes & watermarks" },
        { icon: ShieldCheck, text: hub.textToPdfFeat4 || "100% Client-side privacy" },
      ],
    },
    {
      id: "chatgpt-pdf",
      title: hub.chatGptCardTitle,
      description: hub.chatGptCardDesc,
      badge: hub.chatGptCardBadge,
      cta: hub.chatGptCardCta,
      href: chatGptPdfUrl,
      icon: FileText,
      color: "emerald",
      features: [
        { icon: Sparkles, text: hub.chatGptFeat1 },
        { icon: Code2, text: hub.chatGptFeat2 },
        { icon: FileText, text: hub.chatGptFeat3 },
        { icon: ShieldCheck, text: hub.chatGptFeat4 },
      ],
    },
  ];

  return (
    <section id="tools" className="py-12 sm:py-16">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {hub.toolsTitle}
          </h2>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">
            {hub.toolsSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const isRose = tool.color === "rose";
            const isBlue = tool.color === "blue";

            return (
              <div
                key={tool.id}
                className={`group relative flex flex-col justify-between rounded-2xl border bg-card p-6 sm:p-8 transition-all duration-300 hover:shadow-xl ${
                  isRose
                    ? "border-rose-100 hover:border-rose-300 dark:border-rose-950 dark:hover:border-rose-800 hover:shadow-rose-500/5"
                    : isBlue
                    ? "border-blue-100 hover:border-blue-300 dark:border-blue-950 dark:hover:border-blue-800 hover:shadow-blue-500/5"
                    : "border-emerald-100 hover:border-emerald-300 dark:border-emerald-950 dark:hover:border-emerald-800 hover:shadow-emerald-500/5"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <div
                      className={`flex size-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${
                        isRose
                          ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
                          : isBlue
                          ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                          : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                      }`}
                    >
                      <Icon className="size-6" />
                    </div>

                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        isRose
                          ? "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 border border-rose-200/60 dark:border-rose-500/30"
                          : isBlue
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 border border-blue-200/60 dark:border-blue-500/30"
                          : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-500/30"
                      }`}
                    >
                      {tool.badge}
                    </span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mb-2.5">
                    {tool.title}
                  </h3>

                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-6">
                    {tool.description}
                  </p>

                  <ul className="space-y-2 mb-8">
                    {tool.features.map((feat, idx) => {
                      const FeatIcon = feat.icon;
                      return (
                        <li
                          key={idx}
                          className="flex items-center gap-2 text-xs sm:text-sm text-foreground/80 font-medium"
                        >
                          <FeatIcon
                            className={`size-4 shrink-0 ${
                              isRose
                                ? "text-rose-600 dark:text-rose-400"
                                : isBlue
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          />
                          <span>{feat.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="pt-4 border-t border-border/50">
                  <Link
                    href={tool.href}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 px-4 text-sm font-semibold transition-all duration-200 ${
                      isRose
                        ? "bg-rose-600 text-white hover:bg-rose-700 shadow-xs shadow-rose-600/20"
                        : isBlue
                        ? "bg-blue-600 text-white hover:bg-blue-700 shadow-xs shadow-blue-600/20"
                        : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs shadow-emerald-600/20"
                    }`}
                  >
                    <span>{tool.cta}</span>
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
