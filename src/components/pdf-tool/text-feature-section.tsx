"use client";

import React from "react";
import {
  BadgeCheck,
  Eye,
  FileText,
  Languages,
  ListOrdered,
  ShieldCheck,
  Stamp,
  Type,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FaqSection } from "@/components/faq-section";

const steps = [
  {
    title: "Add your text",
    description:
      "Type directly into the editor, paste content from any app, or import a .txt file.",
  },
  {
    title: "Customize your document",
    description:
      "Choose fonts, colors, page size, margins, headers, footers, page numbers, and watermarks.",
  },
  {
    title: "Preview and download",
    description:
      "Watch the live PDF preview update as you type, then download your finished PDF with one click.",
  },
];

const features: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Type,
    title: "Rich text formatting",
    description:
      "Apply bold, italic, underline, and strikethrough, choose fonts, sizes, colors, and highlights, and structure content with lists, headings, and links.",
  },
  {
    icon: FileText,
    title: "Full page control",
    description:
      "Pick A4, A3, A5, Letter, Legal, or Tabloid sizes — or set custom dimensions — in portrait or landscape, with four margin presets or fully custom margins.",
  },
  {
    icon: ListOrdered,
    title: "Headers, footers & page numbers",
    description:
      'Set custom header and footer text with alignment and borders, and add flexible page numbering such as "Page 1 of 10".',
  },
  {
    icon: Stamp,
    title: "Watermarks",
    description:
      "Add DRAFT, CONFIDENTIAL, or custom text watermarks with adjustable angle, size, color, and opacity.",
  },
  {
    icon: Eye,
    title: "Live PDF preview",
    description:
      "See your document update in real time, with zoom, fit-to-width, and page navigation.",
  },
  {
    icon: Languages,
    title: "Unicode & multilingual text",
    description:
      "Supports Hindi (Devanagari), Bengali, Arabic, Thai and more Indic and international scripts with automatic font fallback.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    description:
      "Every conversion runs locally in your browser — your text is never uploaded to a server.",
  },
  {
    icon: BadgeCheck,
    title: "Free & unlimited",
    description:
      "No accounts, no watermarks forced on you, no limits on how many PDFs you create.",
  },
];

export function TextFeatureSection() {
  return (
    <div className="space-y-12 sm:space-y-16">
      {/* How to Convert */}
      <section id="how-to" className="scroll-mt-20 border-t py-12 sm:py-16">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          How to Convert Text to PDF Online
        </h2>
        <p className="mt-4 max-w-3xl text-muted-foreground">
          Converting text to a polished PDF takes just three steps — no
          installation, no account, and no cost.
        </p>
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title}>
              <Card className="h-full gap-3">
                <CardHeader className="gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-8 w-fit items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary"
                  >
                    {index + 1}
                  </span>
                  <h3 className="text-base font-semibold leading-snug">
                    {step.title}
                  </h3>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* Why Use This Tool */}
      <section id="features" className="scroll-mt-20 border-t py-12 sm:py-16">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Why Use This Text to PDF Converter
        </h2>
        <p className="mt-4 max-w-3xl text-muted-foreground">
          Everything you need to turn plain text into a professional,
          print-ready document — from rich formatting to complete page layout
          — in a single free tool.
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <Card key={feature.title} className="h-full gap-3">
              <CardHeader className="gap-4">
                <span className="flex size-10 w-fit items-center justify-center rounded-full bg-primary/10 text-primary">
                  <feature.icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="text-base font-semibold leading-snug">
                  {feature.title}
                </h3>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Privacy Guarantee */}
      <section id="privacy" className="scroll-mt-20 border-t py-12 sm:py-16">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Your Text Never Leaves Your Browser
        </h2>
        <div className="mt-4 max-w-3xl space-y-4 text-muted-foreground">
          <p>
            The text-to-PDF conversion is performed entirely client-side. Your
            browser generates the PDF using JavaScript on your own device, so
            nothing you type, paste, or import is ever transmitted to a server.
          </p>
          <p>
            The only network requests the tool makes are for static font files
            served from this website, and only when your document uses
            non-Latin scripts. Nothing is uploaded, stored, or logged, and your
            draft is kept only in the browser tab&apos;s session storage — it
            disappears as soon as you close the tab.
          </p>
        </div>
        <Card className="mt-8 gap-0 py-0">
          <CardContent className="flex items-center gap-4 py-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Local processing</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Every conversion runs on your device — your text never leaves
                your browser.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-t py-12 sm:py-16">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Frequently Asked Questions
        </h2>
        <p className="mt-4 max-w-3xl text-muted-foreground">
          Answers to common questions about converting text to PDF, the
          available customization options, and how your data is handled.
        </p>
        <div className="mt-8">
          <FaqSection />
        </div>
      </section>
    </div>
  );
}
