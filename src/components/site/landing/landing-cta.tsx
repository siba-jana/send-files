import { Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/site/reveal"

/**
 * Closing call-to-action band shared by the landing pages. Server-rendered;
 * the primary action is a plain anchor to the transfer widget on `/`.
 */
export function LandingCta({
  title,
  subtitle,
  ctaLabel = "Send files now",
  note = "No install · no account · keep your tab open",
}: {
  title: string
  subtitle: string
  ctaLabel?: string
  note?: string
}) {
  return (
    <section aria-labelledby="landing-cta-heading" className="pb-20 md:pb-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border bg-card px-6 py-14 text-center shadow-sm sm:px-12 md:py-20">
            {/* Decorative rose wash + dotted grid (matches the hero language). */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
            >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_50%_0%,rgba(244,63,94,0.10),transparent_70%)] dark:bg-[radial-gradient(ellipse_60%_70%_at_50%_0%,rgba(244,63,94,0.08),transparent_70%)]" />
              <div className="absolute inset-0 [background-image:radial-gradient(rgba(15,23,42,0.08)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_40%,black_20%,transparent_75%)] dark:[background-image:radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)]" />
            </div>

            <div className="relative">
              <h2
                id="landing-cta-heading"
                className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                {title}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
                {subtitle}
              </p>

              <div className="mt-8">
                <Button
                  size="lg"
                  className="h-12 rounded-xl bg-rose-600 px-7 text-base text-white shadow-lg shadow-rose-600/25 hover:bg-rose-700 dark:bg-rose-500 dark:shadow-rose-500/20 dark:hover:bg-rose-600"
                  asChild
                >
                  <a href="/#transfer">
                    <Send aria-hidden="true" />
                    {ctaLabel}
                  </a>
                </Button>
              </div>

              <p className="mt-4 text-xs text-muted-foreground">{note}</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
