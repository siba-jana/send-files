import { Logo } from "@/components/site/logo"

const FOOTER_LINKS = [
  { href: "#transfer", label: "Send" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#security", label: "Security" },
  { href: "#faq", label: "FAQ" },
] as const

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t bg-muted/30">
      {/* Decorative hairline gradient on top of the border. */}
      <div aria-hidden="true" className="gradient-rule" />
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col items-start gap-3">
            <a
              href="#top"
              aria-label="I Love Doc — back to top"
              className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Logo />
            </a>
            <p className="text-sm text-muted-foreground">
              Send files directly from browser to browser.
            </p>
          </div>

          <nav aria-label="Footer">
            <ul className="flex flex-wrap items-center gap-x-1 gap-y-1">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:min-h-0"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {year} I Love Doc — ilovedoc.org
          </p>
          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground/80">
            Designed for direct peer-to-peer transfer, with encrypted relay
            fallback when direct connectivity isn’t possible.
          </p>
        </div>
      </div>
    </footer>
  )
}
