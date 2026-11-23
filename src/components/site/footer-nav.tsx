"use client"

import { usePathname } from "next/navigation"
import { useI18n } from "@/i18n/context"

const linkClass =
  "inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:min-h-0"

export function FooterNav() {
  const pathname = usePathname()
  const { locale, t } = useI18n()
  const onTool = /^\/[a-z]{2}\/files-transfer-online(\/)?$/.test(pathname)
  const onHome = pathname === "/" || /^\/[a-z]{2}(\/)?$/.test(pathname)

  const toolUrl = `/${locale}/files-transfer-online`
  const textToPdfUrl = `/${locale}/text-to-pdf`
  const chatGptPdfUrl = `/${locale}/chatgpt-to-pdf`

  const mainLinks = [
    { kind: "route", href: toolUrl, label: t("footer.sendAndReceive") },
    { kind: "route", href: textToPdfUrl, label: "Text to PDF" },
    { kind: "route", href: chatGptPdfUrl, label: "ChatGPT to PDF" },
    { kind: "route", href: "/send-large-files", label: t("footer.sendLargeFiles") },
    { kind: "route", href: "/how-it-works", label: t("footer.howItWorks") },
    { kind: "hash", anchor: "security", label: t("footer.security") },
    { kind: "hash", anchor: "faq", label: t("footer.faq") },
  ] as const

  const legalLinks = [
    { href: "/legal/terms", label: t("footer.terms") },
    { href: "/legal/privacy", label: t("footer.privacy") },
    { href: "/legal/dmca", label: t("footer.dmca") },
  ] as const

  return (
    <nav aria-label="Footer">
      <div className="flex flex-col gap-x-1 gap-y-1 md:flex-row md:items-center">
        <ul className="flex flex-wrap items-center gap-x-1 gap-y-1">
          {mainLinks.map((link) => {
            let href: string
            if (link.kind === "route") {
              href = link.href
            } else if (link.anchor === "security") {
              href = onTool ? "#security" : `${toolUrl}#security`
            } else if (onHome || onTool) {
              href = `#${link.anchor}`
            } else {
              href = `/${locale}#${link.anchor}`
            }
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
          {legalLinks.map((link) => (
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
