import type { ReactNode } from "react"
import { ArrowRight, CalendarDays, ChevronRight, Mail, Scale } from "lucide-react"

import { Footer } from "@/components/site/footer"
import {
  LandingNav,
  type LandingPageId,
} from "@/components/site/landing/landing-nav"
import { LegalToc } from "@/components/site/legal/legal-toc"
import { PrintButton } from "@/components/site/legal/print-button"

export interface LegalSection {
  id: string
  title: string
  content: ReactNode
}

export interface LegalSibling {
  href: string
  label: string
  description: string
}

/**
 * Shared shell for the /legal/* pages: breadcrumb, document header with
 * last-updated badge + print button, sticky TOC (desktop) / disclosure
 * (mobile), numbered article sections, contact card, and cross-links to the
 * sibling documents. Server-rendered end to end — the only client islands
 * are the TOC scrollspy and the print button.
 */
export function LegalPage({
  active,
  crumb,
  title,
  description,
  lastUpdated,
  intro,
  sections,
  contact,
  siblings,
}: {
  active: LandingPageId
  /** Short label for the breadcrumb (e.g. "Terms"). */
  crumb: string
  title: string
  description: string
  lastUpdated: string
  /** Optional highlighted block between the header and section 01. */
  intro?: ReactNode
  sections: readonly LegalSection[]
  contact: { label: string; email: string; note: string }
  siblings: readonly LegalSibling[]
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingNav active={active} />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="pt-8 md:pt-10 print:hidden"
          >
            <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
              <li>
                <a
                  href="/"
                  className="rounded-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Home
                </a>
              </li>
              <li aria-hidden="true" className="flex items-center">
                <ChevronRight className="size-3.5 text-muted-foreground/50" />
              </li>
              <li className="text-muted-foreground">Legal</li>
              <li aria-hidden="true" className="flex items-center">
                <ChevronRight className="size-3.5 text-muted-foreground/50" />
              </li>
              <li aria-current="page" className="font-medium text-foreground">
                {crumb}
              </li>
            </ol>
          </nav>

          {/* Document header */}
          <header className="mt-8 max-w-3xl md:mt-10">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-rose-600/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
                <Scale aria-hidden="true" className="size-4" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700 dark:text-rose-400">
                Legal
              </span>
            </div>

            <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              {title}
            </h1>
            <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              {description}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <CalendarDays aria-hidden="true" className="size-3.5" />
                Last updated {lastUpdated}
              </span>
              <PrintButton />
            </div>
          </header>

          <div
            aria-hidden="true"
            className="gradient-rule mt-10 print:hidden"
          />

          {/* TOC + article */}
          <div className="mt-10 grid gap-10 pb-20 md:pb-24 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12 print:mt-8 print:block">
            <LegalToc
              sections={sections.map((s) => ({ id: s.id, title: s.title }))}
            />

            <article className="min-w-0 max-w-3xl">
              {intro && <div className="mb-12">{intro}</div>}

              <div className="space-y-12">
                {sections.map((section, index) => (
                  <section
                    key={section.id}
                    id={section.id}
                    aria-labelledby={`${section.id}-heading`}
                    className="scroll-mt-28"
                  >
                    <div className="flex items-baseline gap-3 border-b pb-4">
                      <span className="font-mono text-sm font-medium tabular-nums text-rose-600 dark:text-rose-500">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <h2
                        id={`${section.id}-heading`}
                        className="text-xl font-semibold tracking-tight sm:text-2xl"
                      >
                        {section.title}
                      </h2>
                    </div>
                    <div className="mt-5">{section.content}</div>
                  </section>
                ))}
              </div>

              {/* Contact card */}
              <div className="mt-14 rounded-2xl border bg-card p-6 shadow-sm print:break-inside-avoid">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Mail aria-hidden="true" className="size-4 text-rose-600 dark:text-rose-500" />
                  {contact.label}
                </p>
                <p className="mt-2.5 text-[15px] leading-7 text-muted-foreground">
                  {contact.note}{" "}
                  <a
                    href={`mailto:${contact.email}`}
                    className="font-medium text-foreground underline decoration-rose-600/40 underline-offset-4 transition-colors hover:decoration-rose-600"
                  >
                    {contact.email}
                  </a>
                  .
                </p>
              </div>

              {/* Sibling cross-links */}
              <nav
                aria-label="Related legal documents"
                className="mt-8 grid gap-4 sm:grid-cols-2 print:hidden"
              >
                {siblings.map((sibling) => (
                  <a
                    key={sibling.href}
                    href={sibling.href}
                    className="group rounded-2xl border bg-card/60 p-5 outline-none transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-md hover:shadow-rose-600/5 focus-visible:ring-2 focus-visible:ring-ring dark:hover:border-rose-500/30 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  >
                    <p className="flex items-center justify-between gap-3 text-sm font-semibold text-foreground">
                      {sibling.label}
                      <ArrowRight
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-rose-600 dark:group-hover:text-rose-400"
                      />
                    </p>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                      {sibling.description}
                    </p>
                  </a>
                ))}
              </nav>
            </article>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
