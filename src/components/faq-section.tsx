import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqItems } from "@/lib/seo-faq";

export function FaqSection() {
  return (
    <Accordion
      type="single"
      collapsible
      className="w-full rounded-xl border bg-card px-6"
    >
      {faqItems.map((item, index) => (
        <AccordionItem key={item.question} value={`faq-${index + 1}`}>
          <AccordionTrigger className="text-left text-base font-medium">
            {item.question}
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground">
            <p className="leading-relaxed">{item.answer}</p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
