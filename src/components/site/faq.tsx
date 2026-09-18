import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Reveal } from "@/components/site/reveal"

const FAQS = [
  {
    q: "Is this really peer-to-peer?",
    a: "Yes. Whenever your network allows it, the two browsers connect directly over WebRTC and files stream straight from device to device — they never touch our servers. The connection badge shows “Direct P2P” so you can always confirm.",
  },
  {
    q: "What happens when a direct connection isn’t possible?",
    a: "Some networks — corporate firewalls, symmetric NAT, certain mobile carriers — block direct links. The transfer then falls back to an encrypted relay, and the connection badge clearly shows “Secure relay” so you always know which path your files take.",
  },
  {
    q: "Do you store my files?",
    a: "No. There is no permanent cloud storage. Files stream directly between browsers, and the server keeps only temporary session metadata needed to coordinate the handshake — deleted once the transfer expires.",
  },
  {
    q: "How large can my files be?",
    a: "I Love Doc is built for large transfers: files are streamed in small chunks, so multi-gigabyte transfers work without loading everything into memory. The practical limit comes down to the browsers and devices involved.",
  },
  {
    q: "Is it secure?",
    a: "Every transfer runs over WebRTC’s built-in DTLS encryption. You can additionally protect a transfer with a password, share links expire automatically, and every file is verified with SHA-256 before delivery is confirmed.",
  },
  {
    q: "Do I need an account?",
    a: "No. Open the site, select your files, and share the code. No sign-up, no email address, no profile.",
  },
  {
    q: "Which browsers are supported?",
    a: "All modern browsers: Chrome, Edge, Firefox, and Safari, on both desktop and mobile.",
  },
  {
    q: "How long does a transfer stay available?",
    a: "As long as the sender keeps the tab open, and until the transfer expires. You choose the lifetime when creating it — from 1 hour to 7 days, with 24 hours as the default.",
  },
  {
    q: "What if the connection drops mid-transfer?",
    a: "The transfer automatically tries to reconnect and resumes from the last confirmed chunk, so a dropped connection doesn’t mean starting over.",
  },
  {
    q: "Can I password-protect a transfer?",
    a: "Yes. When you create a transfer you can set a password, and the recipient must enter it before any file metadata or data is released.",
  },
] as const

export function Faq() {
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
            Frequently asked questions
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
            Everything else you might want to know about sending files browser
            to browser.
          </p>
        </Reveal>

        <Reveal delay={0.12} className="mt-10">
          <div className="rounded-2xl border bg-card px-6 py-2 shadow-sm">
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((item, index) => (
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
