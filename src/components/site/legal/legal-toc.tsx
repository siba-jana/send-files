"use client"

import * as React from "react"
import { ChevronDown, ListTree } from "lucide-react"

import { cn } from "@/lib/utils"

export interface TocSection {
  id: string
  title: string
}

/**
 * "On this page" table of contents for the legal pages.
 *
 * Desktop (lg+): sticky sidebar; a passive scroll listener highlights the
 * section currently at the top of the viewport (rose marker + aria-current).
 * Mobile: a native <details> disclosure (works without JS, keyboard-friendly).
 * Hidden when printing — a printed legal doc doesn't need web navigation.
 */
export function LegalToc({ sections }: { sections: readonly TocSection[] }) {
  const [active, setActive] = React.useState<string | null>(null)

  React.useEffect(() => {
    const onScroll = () => {
      let current: string | null = null
      for (const section of sections) {
        const el = document.getElementById(section.id)
        if (!el) continue
        // A section becomes "current" once its heading crosses the sticky
        // header line (header 64px + breathing room).
        if (el.getBoundingClientRect().top <= 120) current = section.id
        else break
      }
      setActive(current)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [sections])

  const list = (onNavigate?: () => void) => (
    <ol className="space-y-0.5">
      {sections.map((section, index) => {
        const isActive = active === section.id
        return (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              onClick={onNavigate}
              aria-current={isActive ? "location" : undefined}
              className={cn(
                "group flex items-baseline gap-2.5 border-l-2 py-1.5 pl-3 pr-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                isActive
                  ? "border-rose-600 font-medium text-foreground dark:border-rose-500"
                  : "border-transparent text-muted-foreground hover:border-rose-300 hover:text-foreground dark:hover:border-rose-500/40"
              )}
            >
              <span
                className={cn(
                  "font-mono text-xs tabular-nums transition-colors",
                  isActive
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-muted-foreground/60"
                )}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>{section.title}</span>
            </a>
          </li>
        )
      })}
    </ol>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <nav
        aria-label="On this page"
        className="hidden self-start lg:sticky lg:top-24 lg:block print:hidden"
      >
        <p className="flex items-center gap-2 pb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <ListTree aria-hidden="true" className="size-3.5" />
          On this page
        </p>
        {list()}
        <div
          aria-hidden="true"
          className="mt-6 border-t pt-4 text-xs leading-relaxed text-muted-foreground/70"
        >
          Questions about this document?
          <br />
          The contact details are at the end.
        </div>
      </nav>

      {/* Mobile disclosure */}
      <details className="group rounded-2xl border bg-card/60 lg:hidden print:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <ListTree aria-hidden="true" className="size-4 text-muted-foreground" />
            On this page
          </span>
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
          />
        </summary>
        <div className="border-t px-2.5 py-2.5">{list()}</div>
      </details>
    </>
  )
}
