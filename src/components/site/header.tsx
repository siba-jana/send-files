"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Menu, Send, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Logo } from "@/components/site/logo"
import { ThemeToggle } from "@/components/site/theme-toggle"
import { LanguageSelector } from "@/components/site/language-selector"
import { useI18n } from "@/i18n/context"

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const { locale, t } = useI18n()
  const pathname = usePathname()
  const router = useRouter()

  const isToolPage = pathname.includes("/files-transfer-online")
  const toolUrl = `/${locale}/files-transfer-online`

  const navLinks = [
    { href: isToolPage ? "#top" : toolUrl, label: t("header.send") },
    { href: "#how-it-works", label: t("header.howItWorks") },
    { href: "#security", label: t("header.security") },
    { href: "#faq", label: t("header.faq") },
  ]

  const handleStartTransfer = (mode: "send" | "receive") => {
    window.dispatchEvent(new CustomEvent("ilovedoc:mode", { detail: mode }))
    if (isToolPage) {
      window.scrollTo({ top: 0, behavior: "smooth" })
    } else {
      router.push(toolUrl)
    }
  }

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
          href={toolUrl}
          aria-label="I Love Doc — home"
          className="inline-flex items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Logo />
        </a>

        <nav
          aria-label="Main navigation"
          className="ml-6 hidden items-center gap-1 md:flex"
        >
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <LanguageSelector />
          <ThemeToggle />

          <Button
            size="sm"
            onClick={() => handleStartTransfer("send")}
            className="hidden h-9 rounded-lg bg-rose-600 px-4 text-white shadow-xs hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 sm:inline-flex"
          >
            <Send aria-hidden="true" />
            {t("header.sendFiles")}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="size-11 text-foreground md:hidden"
            aria-label={menuOpen ? t("header.closeMenu") : t("header.openMenu")}
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
          <div className="flex flex-col gap-1 px-4 py-3 sm:px-6">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2 text-base font-medium text-foreground hover:bg-accent"
              >
                {link.label}
              </a>
            ))}
            <div className="my-2 border-t pt-2">
              <LanguageSelector variant="mobile" />
            </div>
            <div className="pt-2">
              <Button
                size="lg"
                onClick={() => {
                  setMenuOpen(false)
                  handleStartTransfer("send")
                }}
                className="w-full justify-center rounded-xl bg-rose-600 text-base text-white shadow-sm hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600"
              >
                <Send aria-hidden="true" />
                {t("header.sendFiles")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
