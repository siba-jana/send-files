import type { ReactNode } from "react"
import { AlertTriangle, Info, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Typography primitives for the legal pages. Long-form documents need a
 * consistent, readable rhythm — these keep every paragraph, list, and table
 * on all three pages visually identical. All server-rendered (no motion —
 * legal pages are deliberately static and print-friendly).
 */

/** Body paragraph. Wrap emphasis in <strong> (styled below via CSS). */
export function LP({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 text-[15px] leading-7 text-muted-foreground first:mt-0 [&>strong]:font-semibold [&>strong]:text-foreground [&>a]:font-medium [&>a]:text-foreground [&>a]:underline [&>a]:decoration-rose-600/40 [&>a]:underline-offset-4 [&>a]:transition-colors [&>a]:hover:decoration-rose-600">
      {children}
    </p>
  )
}

/** Bulleted list. */
export function LUl({ children }: { children: ReactNode }) {
  return <ul className="mt-4 space-y-2.5 first:mt-0">{children}</ul>
}

/** List item with a rose tick bullet. */
export function LLi({ children }: { children: ReactNode }) {
  return (
    <li className="relative pl-5 text-[15px] leading-7 text-muted-foreground before:absolute before:left-0 before:top-[0.9em] before:size-1.5 before:rounded-full before:bg-rose-500/70 print:break-inside-avoid [&>strong]:font-semibold [&>strong]:text-foreground [&>a]:font-medium [&>a]:text-foreground [&>a]:underline [&>a]:decoration-rose-600/40 [&>a]:underline-offset-4">
      {children}
    </li>
  )
}

/** Definition list rendered as a bordered card (defined terms). */
export function LDl({
  items,
}: {
  items: readonly { term: string; def: ReactNode }[]
}) {
  return (
    <dl className="mt-5 divide-y overflow-hidden rounded-2xl border bg-card shadow-sm first:mt-0">
      {items.map((item) => (
        <div
          key={item.term}
          className="grid gap-1 px-5 py-4 sm:grid-cols-[190px_minmax(0,1fr)] sm:gap-5 print:break-inside-avoid"
        >
          <dt className="pt-0.5 text-sm font-semibold text-foreground">
            {item.term}
          </dt>
          <dd className="text-[15px] leading-7 text-muted-foreground [&>strong]:font-semibold [&>strong]:text-foreground">
            {item.def}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Inline sub-heading inside a section (h3-level, not in the TOC). */
export function LH3({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-8 text-base font-semibold tracking-tight text-foreground first:mt-0">
      {children}
    </h3>
  )
}

/**
 * Highlighted callout. `tone="rose"` for the good kind of important
 * (summaries, key facts); `tone="amber"` for warnings.
 */
export function Callout({
  title,
  icon: Icon = Info,
  tone = "rose",
  children,
}: {
  title?: string
  icon?: LucideIcon
  tone?: "rose" | "amber"
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "mt-6 rounded-2xl border p-5 first:mt-0 print:break-inside-avoid",
        tone === "rose"
          ? "border-rose-200 bg-rose-50/60 dark:border-rose-500/25 dark:bg-rose-500/5"
          : "border-amber-300/70 bg-amber-50/70 dark:border-amber-500/25 dark:bg-amber-500/5"
      )}
    >
      {title && (
        <p
          className={cn(
            "flex items-center gap-2 text-sm font-semibold",
            tone === "rose"
              ? "text-rose-800 dark:text-rose-300"
              : "text-amber-800 dark:text-amber-300"
          )}
        >
          <Icon aria-hidden="true" className="size-4 shrink-0" />
          {title}
        </p>
      )}
      <div
        className={cn(
          "text-[15px] leading-7 text-muted-foreground",
          title && "mt-2.5",
          "[&>strong]:font-semibold [&>strong]:text-foreground"
        )}
      >
        {children}
      </div>
    </div>
  )
}

/** Warning callout shorthand (amber). */
export function CalloutWarning({
  title,
  children,
}: {
  title?: string
  children: ReactNode
}) {
  return (
    <Callout title={title} icon={AlertTriangle} tone="amber">
      {children}
    </Callout>
  )
}

/**
 * Responsive data table (used for the privacy retention inventory).
 * Horizontally scrollable on narrow screens instead of squashing.
 */
export function LegalTable({
  columns,
  rows,
}: {
  columns: readonly string[]
  rows: readonly ReactNode[][]
}) {
  return (
    <div className="mt-5 overflow-x-auto rounded-2xl border first:mt-0">
      <table className="w-full min-w-[560px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {columns.map((col) => (
              <th
                key={col}
                scope="col"
                className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, i) => (
            <tr
              key={i}
              className="align-top transition-colors hover:bg-muted/30 print:break-inside-avoid"
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={cn(
                    "px-4 py-3.5 leading-6 text-muted-foreground",
                    j === 0 && "font-medium text-foreground"
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
