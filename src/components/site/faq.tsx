"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Reveal } from "@/components/site/reveal"
import { useI18n } from "@/i18n/context"
import { FAQS } from "./faq-data"

export { FAQS }

export function Faq() {
  const { t, dict } = useI18n()
  const faqItems = dict?.faq?.items && dict.faq.items.length > 0 ? dict.faq.items : FAQS

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="scroll-mt-24 py-20 md:py-28"
    >
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center">
          <h2
            id="faq-heading"
            className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            {t("faq.heading")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
            {t("faq.subheading")}
          </p>
        </Reveal>

        <Reveal delay={0.12} className="mt-10">
          <div className="rounded-2xl border bg-card px-6 py-2 shadow-sm">
            <Accordion type="single" collapsible className="w-full">
              {faqItems.map((item, index) => (
                <AccordionItem key={index} value={`faq-${index}`}>
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
