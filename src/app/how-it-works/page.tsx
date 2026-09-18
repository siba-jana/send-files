import type { Metadata } from "next"
import {
  Archive,
  ArrowLeftRight,
  ArrowRight,
  BadgeCheck,
  BookOpenText,
  Check,
  EyeOff,
  Radio,
  Route,
  Send,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/site/reveal"
import { Footer } from "@/components/site/footer"
import { LandingNav } from "@/components/site/landing/landing-nav"
import {
  LandingFaq,
  type LandingFaqItem,
} from "@/components/site/landing/landing-faq"
import { LandingCta } from "@/components/site/landing/landing-cta"
import { JsonLd } from "@/components/site/landing/json-ld"

const SITE_URL = "https://ilovedoc.org"
const PAGE_URL = `${SITE_URL}/how-it-works`

const PAGE_TITLE = "How Browser-to-Browser File Transfer Works"
const PAGE_DESCRIPTION =
  "The full technical story of I Love Doc: WebRTC handshakes, DTLS encryption, chunked streaming with SHA-256 verification — and exactly what our servers never touch."

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: "/how-it-works",
  },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    siteName: "I Love Doc",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-image.jpg",
        width: 1216,
        height: 640,
        alt: "I Love Doc — files flying between two browsers over a direct encrypted connection",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/og-image.jpg"],
  },
}

const FAQ_ITEMS: readonly LandingFaqItem[] = [
  {
    q: "Do I need to install anything?",
    a: "No. Everything — the transfer engine, encryption, verification — is built into modern browsers via WebRTC. Chrome, Edge, Firefox, and Safari all work, on desktop and mobile.",
  },
  {
    q: "Can the relay read my files?",
    a: "No. The relay (TURN) only forwards packets. The DTLS encryption is negotiated directly between the two browsers, and the keys never leave them — so the relay sees encrypted bytes it cannot decrypt.",
  },
  {
    q: "Why a 6-digit code instead of just a link?",
    a: "Both work. The code is easy to read out over a phone call; the share link and QR code do the same job in one tap. Either way, it expires with the transfer.",
  },
  {
    q: "What data do you keep after a transfer?",
    a: "Only what coordination required: the session record — file names and sizes — until it expires, plus anonymous aggregate counters for the public stats. Never file contents; on the direct path there are none to keep.",
  },
  {
    q: "Can someone intercept the transfer?",
    a: "They would have to break DTLS — the same standard that protects HTTPS — using keys that exist only inside the two browsers for that session. An optional password adds another gate before any file metadata is even released.",
  },
  {
    q: "Why WebRTC instead of plain HTTPS uploads?",
    a: "HTTPS uploads put a server in the middle: your file crosses the internet twice and lands on storage. WebRTC DataChannels let browsers talk directly — one hop, no storage — while the protocol handles the messy networking (NAT traversal, reconnects) for us.",
  },
] as const

const PHASES = [
  {
    n: "01",
    icon: Radio,
    title: "The handshake",
    duration: "seconds",
    intro:
      "Two strangers on the internet become peers. The server’s only job is the introduction.",
    steps: [
      {
        title: "You pick files",
        text: "File metadata — names, sizes, types — is registered with the coordination server. Never the contents. You get a 6-digit code, a share link, and a QR code.",
      },
      {
        title: "They enter the code",
        text: "The recipient’s browser asks the server for an introduction. If you set a password, it’s checked first — stored only as a salted hash — before any metadata is released.",
      },
      {
        title: "Browsers get introduced",
        text: "Over a signaling channel, the two browsers exchange connection candidates (SDP offer/answer and ICE candidates). The server is the matchmaker — it passes messages, not files.",
      },
      {
        title: "An encrypted channel opens",
        text: "WebRTC negotiates DTLS — the same encryption family that protects HTTPS — with fresh keys that exist only inside the two browsers.",
      },
    ],
  },
  {
    n: "02",
    icon: Zap,
    title: "The transfer",
    duration: "minutes to hours",
    intro:
      "Bytes flow peer to peer, in order, with receipts — the boring reliability of a courier, at network speed.",
    steps: [
      {
        title: "Files stream in chunks",
        text: "Each file is read from disk in chunks of up to 64 KiB and pushed over the DataChannel. Memory use stays flat, whether the file is 10 MB or 10 TB.",
      },
      {
        title: "Every chunk is confirmed",
        text: "Each chunk carries a CRC-32 and the receiver ACKs progress in batches. The sender paces itself on the receiver’s buffer — fast links fly, weak links stay stable.",
      },
      {
        title: "Drops don’t restart",
        text: "If the connection breaks, both sides reconnect and the receiver asks to resume from its last confirmed chunk. Files already verified are skipped entirely.",
      },
      {
        title: "SHA-256 seals the deal",
        text: "Both sides hash the bytes as they flow. At completion the digests must match — or the transfer fails loudly rather than deliver corruption.",
      },
    ],
  },
  {
    n: "03",
    icon: Archive,
    title: "The teardown",
    duration: "on your schedule",
    intro:
      "Delivery is confirmed, the session expires, and there is nothing left to clean up.",
    steps: [
      {
        title: "Delivery confirmed",
        text: "The receiver’s browser saves each verified file to disk — individually, or as a single ZIP when the total is under 4 GB.",
      },
      {
        title: "The session expires",
        text: "Coordination metadata lives exactly as long as you choose: 1 hour to 7 days, 24 hours by default. Then it’s deleted.",
      },
      {
        title: "Nothing lingers",
        text: "On the direct path, file bytes never existed on any server. There’s nothing to breach because there’s nothing stored.",
      },
    ],
  },
] as const

const SERVER_SEES = [
  "The 6-digit code, its expiry, and when it was used",
  "File names, sizes, and types — the manifest the receiver sees",
  "Connection events for the session log (joined, completed, cancelled)",
  "Anonymous aggregate counters for the public stats — numbers, never contents",
] as const

const SERVER_NEVER = [
  "File contents, on the direct path — bytes go browser to browser",
  "DTLS encryption keys — they live only in the two browsers",
  "Your password — only a salted hash is ever stored",
  "An account or a profile — there are none",
] as const

const PROTOCOL_FACTS = [
  {
    term: "protocol",
    def: "A compact binary protocol over WebRTC DataChannels: 23-byte chunk headers with per-chunk CRC-32, batched acknowledgements, and explicit resume requests after reconnects.",
  },
  {
    term: "chunking",
    def: "Chunks sized to what the network path allows (up to 64 KiB). The sender pauses when its buffer fills and resumes when it drains — backpressure, the boring kind of clever.",
  },
  {
    term: "integrity",
    def: "Incremental SHA-256 on both sides, compared at completion. Verified files are marked and never re-sent after a reconnect.",
  },
  {
    term: "telemetry",
    def: "During a transfer, both browsers sample real WebRTC statistics — throughput and round-trip time. The charts in the app are measured, never estimated.",
  },
  {
    term: "expiry",
    def: "Sessions live 1 hour to 7 days (24 hours by default). Expired sessions are deleted; the file bytes were never stored in the first place.",
  },
] as const

const HERO_META = [
  { icon: BadgeCheck, label: "3 min read" },
  { icon: ShieldCheck, label: "DTLS end-to-end" },
  { icon: EyeOff, label: "No storage" },
] as const

export default function HowItWorksPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${PAGE_URL}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: `${SITE_URL}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "How it works",
            item: PAGE_URL,
          },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${PAGE_URL}#faq`,
        mainEntity: FAQ_ITEMS.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.a,
          },
        })),
      },
    ],
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <JsonLd data={jsonLd} />
      <LandingNav active="how-it-works" />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative isolate overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_-10%,rgba(244,63,94,0.13),transparent_70%)] dark:bg-[radial-gradient(ellipse_70%_55%_at_50%_-10%,rgba(244,63,94,0.10),transparent_70%)]" />
            <div className="absolute inset-0 [background-image:radial-gradient(rgba(15,23,42,0.10)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_35%,black_25%,transparent_75%)] dark:[background-image:radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)]" />
          </div>

          <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pb-14 pt-16 text-center sm:px-6 md:pb-20 md:pt-24 lg:px-8">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-1.5 text-sm font-medium text-rose-700 shadow-sm shadow-rose-600/10 ring-1 ring-rose-600/5 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:shadow-none dark:ring-rose-400/10">
                <BookOpenText aria-hidden="true" className="size-4" />
                The complete technical story
              </span>
            </Reveal>

            <Reveal delay={0.08}>
              <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
                How files travel{" "}
                <span className="text-rose-600 dark:text-rose-500">
                  browser to browser
                </span>
              </h1>
            </Reveal>

            <Reveal delay={0.16}>
              <p className="mt-6 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
                No installs, no cloud hop, no storage bucket. This is the
                complete journey of a file — the handshake, the encrypted
                stream, and what our servers do (and never do).
              </p>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="mt-10 flex w-full flex-col items-center justify-center gap-4 sm:w-auto sm:flex-row">
                <Button
                  size="lg"
                  className="h-12 w-full rounded-xl bg-rose-600 px-7 text-base text-white shadow-lg shadow-rose-600/25 hover:bg-rose-700 dark:bg-rose-500 dark:shadow-rose-500/20 dark:hover:bg-rose-600 sm:w-auto"
                  asChild
                >
                  <a href="/#transfer">
                    <Send aria-hidden="true" />
                    Send files now
                  </a>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 w-full rounded-xl px-7 text-base sm:w-auto"
                  asChild
                >
                  <a href="/send-large-files">
                    Large-file guide
                    <ArrowRight aria-hidden="true" />
                  </a>
                </Button>
              </div>
            </Reveal>

            <Reveal delay={0.32}>
              <ul
                aria-label="At a glance"
                className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5"
              >
                {HERO_META.map(({ icon: Icon, label }) => (
                  <li
                    key={label}
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <Icon
                      aria-hidden="true"
                      className="size-4 text-rose-600 dark:text-rose-500"
                    />
                    {label}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        {/* The journey of a file — timeline */}
        <section
          aria-labelledby="journey-heading"
          className="scroll-mt-24 py-16 md:py-24"
        >
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2
                id="journey-heading"
                className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                The journey of a file
              </h2>
              <p className="mt-4 text-pretty text-base text-muted-foreground sm:text-lg">
                Three phases, from matchmaking to clean teardown.
              </p>
            </Reveal>

            <ol className="relative ml-3 mt-14 space-y-14 border-l-2 border-border">
              {PHASES.map((phase) => (
                <li key={phase.title} className="relative pl-8">
                  <span
                    aria-hidden="true"
                    className="absolute -left-[17px] top-0 flex size-8 items-center justify-center rounded-full border-2 border-border bg-card font-mono text-xs font-semibold text-rose-600 dark:text-rose-500"
                  >
                    {phase.n}
                  </span>
                  <Reveal>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-rose-600/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
                        <phase.icon aria-hidden="true" className="size-5" />
                      </div>
                      <h3 className="text-xl font-semibold tracking-tight">
                        {phase.title}
                      </h3>
                      <span className="rounded-full border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        {phase.duration}
                      </span>
                    </div>
                    <p className="mt-3 max-w-2xl text-pretty text-sm text-muted-foreground sm:text-base">
                      {phase.intro}
                    </p>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      {phase.steps.map((step, stepIndex) => (
                        <div
                          key={step.title}
                          className={
                            phase.steps.length % 2 === 1 &&
                            stepIndex === phase.steps.length - 1
                              ? "rounded-2xl border bg-card p-5 shadow-sm sm:col-span-2"
                              : "rounded-2xl border bg-card p-5 shadow-sm"
                          }
                        >
                          <p className="text-sm font-semibold">
                            {step.title}
                          </p>
                          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                            {step.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* What our servers actually see */}
        <section
          aria-labelledby="servers-heading"
          className="scroll-mt-24 py-16 md:py-24"
        >
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2
                id="servers-heading"
                className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                What our servers actually see
              </h2>
              <p className="mt-4 text-pretty text-base text-muted-foreground sm:text-lg">
                A coordination server has to see something to coordinate.
                Here is the whole inventory — and the rest of the story.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              <Reveal delay={0.05} className="h-full">
                <Card className="h-full rounded-2xl">
                  <CardHeader>
                    <CardTitle className="text-base">Coordinates</CardTitle>
                    <CardDescription>
                      Ephemeral, functional, deleted with the session.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3.5">
                      {SERVER_SEES.map((item) => (
                        <li key={item} className="flex gap-3">
                          <Check
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                          />
                          <span className="text-sm leading-relaxed text-muted-foreground">
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </Reveal>

              <Reveal delay={0.12} className="h-full">
                <Card className="h-full rounded-2xl border-rose-200 shadow-lg shadow-rose-600/5 dark:border-rose-500/30 dark:shadow-rose-500/5">
                  <CardHeader>
                    <CardTitle className="text-base">
                      Never touches
                    </CardTitle>
                    <CardDescription>
                      The parts that stay between you and your recipient.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3.5">
                      {SERVER_NEVER.map((item) => (
                        <li key={item} className="flex gap-3">
                          <X
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-500"
                          />
                          <span className="text-sm leading-relaxed text-muted-foreground">
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Two paths, always labeled */}
        <section
          aria-labelledby="paths-heading"
          className="scroll-mt-24 py-16 md:py-24"
        >
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2
                id="paths-heading"
                className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                Two paths, always labeled
              </h2>
              <p className="mt-4 text-pretty text-base text-muted-foreground sm:text-lg">
                Networking is messy. We don’t hide it — we label it.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              <Reveal delay={0.05} className="h-full">
                <Card className="h-full rounded-2xl border-rose-200 shadow-lg shadow-rose-600/5 dark:border-rose-500/30 dark:shadow-rose-500/5">
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex size-11 items-center justify-center rounded-xl bg-rose-600/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
                        <ArrowLeftRight
                          aria-hidden="true"
                          className="size-5"
                        />
                      </div>
                      <span className="rounded-full bg-rose-600/10 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                        Direct P2P
                      </span>
                    </div>
                    <CardTitle className="mt-2 text-base">
                      The default
                    </CardTitle>
                    <CardDescription>
                      Browsers connect straight to each other.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                      <li>
                        The two browsers find a direct route through NAT and
                        firewalls (STUN/ICE) and connect peer to peer.
                      </li>
                      <li>
                        File bytes travel only between the two devices — no
                        third party is in the path.
                      </li>
                      <li>
                        The connection badge in the app shows{" "}
                        <span className="font-medium text-foreground">
                          Direct P2P
                        </span>{" "}
                        the whole time.
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </Reveal>

              <Reveal delay={0.12} className="h-full">
                <Card className="h-full rounded-2xl">
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <Route aria-hidden="true" className="size-5" />
                      </div>
                      <span className="rounded-full border bg-muted/50 px-3 py-1 text-xs font-semibold text-muted-foreground">
                        Secure relay
                      </span>
                    </div>
                    <CardTitle className="mt-2 text-base">
                      The fallback
                    </CardTitle>
                    <CardDescription>
                      For networks that block direct links.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                      <li>
                        Strict corporate firewalls and symmetric NAT sometimes
                        make a direct connection impossible.
                      </li>
                      <li>
                        Traffic then flows through a TURN relay — but DTLS
                        encryption stays end-to-end between the browsers, so
                        the relay forwards bytes it cannot read.
                      </li>
                      <li>
                        The badge honestly switches to{" "}
                        <span className="font-medium text-foreground">
                          Secure relay
                        </span>{" "}
                        so you always know the path.
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </Reveal>
            </div>

            <Reveal delay={0.1}>
              <p className="mt-8 text-center text-sm text-muted-foreground">
                We label the path on every transfer because you deserve to
                know — not every service tells you.
              </p>
            </Reveal>
          </div>
        </section>

        {/* Under the hood */}
        <section
          aria-labelledby="hood-heading"
          className="scroll-mt-24 pb-16 md:pb-24"
        >
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2
                id="hood-heading"
                className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                Under the hood
              </h2>
              <p className="mt-4 text-pretty text-base text-muted-foreground sm:text-lg">
                The nerdy corner — the five mechanisms doing the heavy
                lifting.
              </p>
            </Reveal>

            <Reveal delay={0.1} className="mt-10">
              <dl className="divide-y rounded-2xl border bg-card shadow-sm">
                {PROTOCOL_FACTS.map((fact, index) => (
                  <div
                    key={fact.term}
                    className={`grid gap-2 px-6 py-5 sm:grid-cols-[140px_1fr] sm:gap-8 ${
                      index % 2 === 1 ? "bg-muted/30" : ""
                    }`}
                  >
                    <dt className="font-mono text-sm font-semibold text-rose-600 dark:text-rose-500">
                      {fact.term}
                    </dt>
                    <dd className="text-sm leading-relaxed text-muted-foreground">
                      {fact.def}
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </section>

        {/* FAQ + CTA */}
        <LandingFaq
          items={FAQ_ITEMS}
          heading="How-it-works questions"
          intro="The questions curious people ask before their first transfer."
        />
        <LandingCta
          title="Now you know how it works. Try it."
          subtitle="Pick a file, share a code, and watch the telemetry chart draw itself from real stats."
          ctaLabel="Send files now"
        />
      </main>

      <Footer />
    </div>
  )
}
