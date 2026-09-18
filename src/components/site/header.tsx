"use client"

import * as React from "react"
import { Menu, Send, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Logo } from "@/components/site/logo"
import { ThemeToggle } from "@/components/site/theme-toggle"

const NAV_LINKS = [
  { href: "#transfer", label: "Send" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#security", label: "Security" },
  { href: "#faq", label: "FAQ" },
] as const

/**
 * Switch the transfer widget mode and scroll it into view.
 * The widget (built separately) listens for the `ilovedoc:mode` event
 * with detail "send" | "receive".
 */
function startTransfer(mode: "send" | "receive") {
  window.dispatchEvent(new CustomEvent("ilovedoc:mode", { detail: mode }))
  const target = document.getElementById("transfer")
  if (target) {
    const top = target.getBoundingClientRect().top + window.scrollY - 80
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? "auto" : "smooth" })
  }
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = React.useState(false)

  // Close the mobile menu with Escape.
  React.useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [menuOpen])

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 sm:px-6 lg:px-8">
        <a
          href="#top"
          aria-label="I Love Doc — back to top"
          className="inline-flex items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Logo />
        </a>

        <nav
          aria-label="Main navigation"
          className="ml-6 hidden items-center gap-1 md:flex"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />

          <Button
            size="sm"
            onClick={() => startTransfer("send")}
            className="hidden h-9 rounded-lg bg-rose-600 px-4 text-white shadow-xs hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 sm:inline-flex"
          >
            <Send aria-hidden="true" />
            Send Files
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="size-11 text-foreground md:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <X aria-hidden="true" className="size-5" />
            ) : (
              <Menu aria-hidden="true" className="size-5" />
            )}
          </Button>
        </div>
      </div>

      {menuOpen && (
        <div
          id="mobile-menu"
          className="border-t bg-background/95 backdrop-blur-md md:hidden"
        >
          <nav
            aria-label="Mobile navigation"
            className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6"
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="flex min-h-11 items-center rounded-lg px-3 text-base font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                {link.label}
              </a>
            ))}
            <Button
              onClick={() => {
                setMenuOpen(false)
                startTransfer("send")
              }}
              className="mt-2 h-11 rounded-lg bg-rose-600 text-base text-white hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600"
            >
              <Send aria-hidden="true" />
              Send Files
            </Button>
          </nav>
        </div>
      )}
    </header>
  )
}
