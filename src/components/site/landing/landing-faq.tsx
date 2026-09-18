import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Reveal } from "@/components/site/reveal"

export interface LandingFaqItem {
  q: string
  a: string
}

/**
 * Parameterized FAQ section for the landing pages — same markup language as
 * the home FAQ, but each page supplies its own items (which also feed that
 * page's FAQPage JSON-LD, keeping structured data and visible copy in sync).
 */
export function LandingFaq({
  items,
  heading,
  intro,
}: {
  items: readonly LandingFaqItem[]
  heading: string
  intro: string
}) {
  return (
    <section
      id="faq"
      aria-labelledby="landing-faq-heading"
      className="scroll-mt-24 py-16 md:py-24"
    >
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center">
          <h2
            id="landing-faq-heading"
            className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            {heading}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
            {intro}
          </p>
        </Reveal>

        <Reveal delay={0.12} className="mt-10">
          <div className="rounded-2xl border bg-card px-6 py-2 shadow-sm">
            <Accordion type="single" collapsible className="w-full">
              {items.map((item, index) => (
                <AccordionItem key={item.q} value={`faq-${index}`}>
                  <AccordionTrigger className="py-5 text-left text-base font-medium">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 text-base leading-relaxed text-muted-foreground">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
