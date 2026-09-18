"use client"

import { usePathname } from "next/navigation"

const MAIN_LINKS = [
  { kind: "hash", anchor: "transfer", label: "Send & receive" },
  { kind: "route", href: "/send-large-files", label: "Send large files" },
  { kind: "route", href: "/how-it-works", label: "How it works" },
  { kind: "hash", anchor: "security", label: "Security" },
  { kind: "hash", anchor: "faq", label: "FAQ" },
] as const

const LEGAL_LINKS = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/dmca", label: "DMCA" },
] as const

const linkClass =
  "inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:min-h-0"

/**
 * Footer navigation (client island) — hash targets resolve to plain
 * `#anchor` while on `/` (same-document scroll, safe even during an
 * active receive view on `/?code=…`) and to `/#anchor` from every other
 * route so they still land on the app after a full navigation.
 */
export function FooterNav() {
  const onHome = usePathname() === "/"

  return (
    <nav aria-label="Footer">
      <div className="flex flex-col gap-x-1 gap-y-1 md:flex-row md:items-center">
        <ul className="flex flex-wrap items-center gap-x-1 gap-y-1">
          {MAIN_LINKS.map((link) => {
            const href =
              link.kind === "route"
                ? link.href
                : onHome
                  ? `#${link.anchor}`
                  : `/#${link.anchor}`
            return (
              <li key={link.label}>
                <a href={href} className={linkClass}>
                  {link.label}
                </a>
              </li>
            )
          })}
        </ul>

        <span
          aria-hidden="true"
          className="hidden h-4 w-px bg-border md:mx-3 md:block"
        />

        <ul
          aria-label="Legal"
          className="flex flex-wrap items-center gap-x-1 gap-y-1"
        >
          {LEGAL_LINKS.map((link) => (
            <li key={link.label}>
              <a href={link.href} className={linkClass}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
