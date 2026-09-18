"use client"

import * as React from "react"
import { Menu, Send, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Logo } from "@/components/site/logo"
import { ThemeToggle } from "@/components/site/theme-toggle"
import { cn } from "@/lib/utils"

export type LandingPageId = "large-files" | "how-it-works"

const NAV_LINKS: readonly {
  href: string
  label: string
  page?: LandingPageId
}[] = [
  { href: "/#transfer", label: "Send & receive" },
  { href: "/send-large-files", label: "Send large files", page: "large-files" },
  { href: "/how-it-works", label: "How it works", page: "how-it-works" },
  { href: "/#faq", label: "FAQ" },
]

/**
 * Header for the dedicated landing pages. Same shell as the site header,
 * but links are route-aware (the anchors only exist on `/`) and the current
 * guide page is highlighted with `aria-current="page"`.
 */
export function LandingNav({ active }: { active: LandingPageId }) {
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

  const linkClass = (isActive: boolean) =>
    cn(
      "rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
      isActive
        ? "text-foreground"
        : "text-muted-foreground hover:text-foreground"
    )

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 sm:px-6 lg:px-8">
        <a
          href="/"
          aria-label="I Love Doc — home"
          className="inline-flex items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Logo />
        </a>

        <nav
          aria-label="Guide navigation"
          className="ml-6 hidden items-center gap-1 md:flex"
        >
          {NAV_LINKS.map((link) => {
            const isActive = link.page !== undefined && link.page === active
            return (
              <a
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={linkClass(isActive)}
              >
                {link.label}
              </a>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />

          <Button
            size="sm"
            className="hidden h-9 rounded-lg bg-rose-600 px-4 text-white shadow-xs hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 sm:inline-flex"
            asChild
          >
            <a href="/#transfer">
              <Send aria-hidden="true" />
              Send Files
            </a>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="size-11 text-foreground md:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-menu"
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
          id="landing-mobile-menu"
          className="border-t bg-background/95 backdrop-blur-md md:hidden"
        >
          <nav
            aria-label="Mobile guide navigation"
            className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6"
          >
            {NAV_LINKS.map((link) => {
              const isActive = link.page !== undefined && link.page === active
              return (
                <a
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex min-h-11 items-center rounded-lg px-3 text-base font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {link.label}
                </a>
              )
            })}
            <Button
              className="mt-2 h-11 rounded-lg bg-rose-600 text-base text-white hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600"
              asChild
            >
              <a href="/#transfer" onClick={() => setMenuOpen(false)}>
                <Send aria-hidden="true" />
                Send Files
              </a>
            </Button>
          </nav>
        </div>
      )}
    </header>
  )
}
