import type { Metadata } from "next"
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Clapperboard,
  Clock,
  Disc,
  FileCheck2,
  FlaskConical,
  Gauge,
  HardDrive,
  Layers,
  Palette,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Terminal,
  Upload,
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
import { SizeScale } from "@/components/site/landing/size-scale"
import { JsonLd } from "@/components/site/landing/json-ld"

const SITE_URL = "https://ilovedoc.org"
const PAGE_URL = `${SITE_URL}/send-large-files`

const PAGE_TITLE = "Send Large Files Online — Up to 10 TB, No Cloud Upload"
const PAGE_DESCRIPTION =
  "Send large files directly from browser to browser. Stream up to 10 TB per file over an encrypted peer-to-peer channel — no cloud upload, no storage, no sign-up."

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: "/send-large-files",
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
    q: "What is the maximum file size I can send?",
    a: "10 TB per file — that is the hard cap the transfer protocol enforces. In practice you are limited by the sender’s and recipient’s free disk space and browser stability. For transfers of 8 GB or more, keep both tabs open and awake until delivery completes.",
  },
  {
    q: "How many files can one transfer contain?",
    a: "Up to 200. You can reorder them before sending and the receiver gets them in exactly that order. If the total size is under 4 GB, they can also download everything as a single ZIP.",
  },
  {
    q: "Do both of us need to be online?",
    a: "Yes — that is the nature of a direct transfer. The sender’s tab streams the files, so it needs to stay open; the receiver picks them up live. Cloud services can hold files for later, but then your data sits on their servers.",
  },
  {
    q: "What if the connection drops mid-transfer?",
    a: "Both browsers automatically reconnect and resume from the last confirmed chunk. A dropped Wi-Fi network or a flaky hotel link does not restart a 200 GB job from zero.",
  },
  {
    q: "Will a huge transfer eat my memory?",
    a: "No. Files are streamed from disk to the network in small chunks, so memory use stays flat no matter the file size. A 10 TB transfer uses roughly the same memory as a 10 MB one.",
  },
  {
    q: "Is a 10 TB transfer actually realistic?",
    a: "Over a fast local network, yes — WebRTC data channels can saturate a LAN. Over the public internet, multi-hundred-gigabyte transfers are routine; 10 TB is the ceiling, not the promise. The speed you see is the speed of the slowest link.",
  },
  {
    q: "Can I send a whole folder?",
    a: "Add up to 200 files from any folders you like — the receiver gets the full list and can download files individually or as one ZIP (when the total is under 4 GB).",
  },
] as const

const TRUST_ITEMS = [
  { icon: ShieldCheck, label: "DTLS encrypted" },
  { icon: BadgeCheck, label: "SHA-256 verified" },
  { icon: Layers, label: "200 files per transfer" },
  { icon: Clock, label: "No sign-up" },
] as const

const CLOUD_STEPS = [
  {
    title: "Upload",
    text: "The full file travels from you to their storage. You watch a progress bar.",
  },
  {
    title: "Wait",
    text: "Nothing reaches the recipient until your upload finishes — every last byte.",
  },
  {
    title: "Download",
    text: "The file travels again, this time from their storage down to the recipient.",
  },
] as const

const DIRECT_STEPS = [
  {
    title: "Connect",
    text: "The two browsers find each other and open an encrypted channel. Seconds.",
  },
  {
    title: "Stream",
    text: "Bytes flow directly, sender to recipient — the file crosses the internet exactly once.",
  },
  {
    title: "Verify",
    text: "SHA-256 digests computed on both sides must match before delivery counts.",
  },
] as const

const COMPARISON_ROWS = [
  {
    label: "Max file size",
    us: "10 TB per file",
    them: "~2 GB on free tiers; paid plans for more",
  },
  {
    label: "Internet crossings",
    us: "Once — sender to recipient",
    them: "Twice — upload to storage, then download",
  },
  {
    label: "Recipient starts receiving",
    us: "While the file streams",
    them: "After the upload completes",
  },
  {
    label: "Stored on a server",
    us: "Never, on the direct path",
    them: "Yes, until the link expires",
  },
  {
    label: "Account required",
    us: "No",
    them: "Often, for larger files",
  },
  {
    label: "Works after sender closes the tab",
    us: "No — the sender stays online",
    them: "Yes",
  },
] as const

const BULK_FEATURES = [
  {
    icon: Disc,
    title: "Streamed, not loaded",
    description:
      "Files are read and sent in chunks of up to 64 KiB. Memory use stays flat whether you’re sending 10 MB or 10 TB.",
  },
  {
    icon: RefreshCw,
    title: "Survives connection drops",
    description:
      "Every chunk is CRC-checked and confirmed. If the link breaks, both sides reconnect and resume from the last confirmed byte.",
  },
  {
    icon: FileCheck2,
    title: "Verified end to end",
    description:
      "Sender and receiver hash the stream with SHA-256 as it flows. If a single bit differs, the transfer fails loudly instead of delivering corruption.",
  },
  {
    icon: Gauge,
    title: "Paces itself to the link",
    description:
      "The sender watches its send buffer and backs off when the network is congested — fast LANs fly, weak links stay stable.",
  },
] as const

const USE_CASES = [
  {
    icon: Clapperboard,
    title: "Video & film",
    description:
      "Raw footage, dailies, and exports move between collaborators at network speed — no upload queue, no render-farm bottleneck.",
  },
  {
    icon: Camera,
    title: "Photography",
    description:
      "Send full-resolution RAW archives and complete galleries without compression or a storage subscription.",
  },
  {
    icon: FlaskConical,
    title: "Science & engineering",
    description:
      "Datasets, CAD assemblies, and simulation output — the boring-but-big files, moved intact and checksum-verified.",
  },
  {
    icon: Palette,
    title: "Creative teams",
    description:
      "Masters, layered project files, and final deliverables straight to the client’s browser, in the order you choose.",
  },
  {
    icon: Smartphone,
    title: "Your own devices",
    description:
      "Phone to laptop, laptop to desktop — migrate or back up without a cable, an account, or a cloud middleman.",
  },
  {
    icon: Terminal,
    title: "Developers",
    description:
      "Build artifacts, VM images, container layers, and log bundles between machines — with live throughput and RTT charts.",
  },
] as const

/** Numbered step list used inside the “crosses the internet once” cards. */
function StepList({
  steps,
}: {
  steps: readonly { title: string; text: string }[]
}) {
  return (
    <ol className="mt-5 space-y-4">
      {steps.map((step, index) => (
        <li key={step.title} className="flex gap-3.5">
          <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-semibold tabular-nums text-muted-foreground">
            {index + 1}
          </span>
          <div>
            <p className="text-sm font-semibold">{step.title}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
              {step.text}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export default function SendLargeFilesPage() {
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
            name: "Send large files",
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
      <LandingNav active="large-files" />

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
                <HardDrive aria-hidden="true" className="size-4" />
                Up to 10 TB per file
              </span>
            </Reveal>

            <Reveal delay={0.08}>
              <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
                Send large files online —{" "}
                <span className="text-rose-600 dark:text-rose-500">
                  up to 10 TB
                </span>{" "}
                per file
              </h1>
            </Reveal>

            <Reveal delay={0.16}>
              <p className="mt-6 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
                Your files stream straight from your browser to the
                recipient’s over an encrypted peer-to-peer channel. No cloud
                hop, no size wall, no account — a file leaves your device
                exactly once.
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
                    Send a large file
                  </a>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 w-full rounded-xl px-7 text-base sm:w-auto"
                  asChild
                >
                  <a href="/how-it-works">
                    How the transfer works
                    <ArrowRight aria-hidden="true" />
                  </a>
                </Button>
              </div>
            </Reveal>

            <Reveal delay={0.32}>
              <ul
                aria-label="Key guarantees"
                className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5"
              >
                {TRUST_ITEMS.map(({ icon: Icon, label }) => (
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

        {/* Log-scale size comparison */}
        <SizeScale />

        {/* Crosses the internet once */}
        <section
          aria-labelledby="once-heading"
          className="scroll-mt-24 py-16 md:py-24"
        >
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2
                id="once-heading"
                className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                The cloud makes big files cross the internet twice
              </h2>
              <p className="mt-4 text-pretty text-base text-muted-foreground sm:text-lg">
                Upload services put a storage bucket between you and the
                recipient. A direct transfer removes it — along with the
                second trip, the waiting, and the copy of your file on
                someone else’s disk.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              <Reveal delay={0.05} className="h-full">
                <Card className="h-full rounded-2xl">
                  <CardHeader>
                    <div className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <Upload aria-hidden="true" className="size-5" />
                    </div>
                    <CardTitle className="mt-2 text-base">
                      The cloud way
                    </CardTitle>
                    <CardDescription>
                      Upload, wait, download — two full trips.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <StepList steps={CLOUD_STEPS} />
                    <p className="mt-5 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
                      Plus: the file now sits on a server, tied to an expiry
                      date and an account policy you didn’t choose.
                    </p>
                  </CardContent>
                </Card>
              </Reveal>

              <Reveal delay={0.12} className="h-full">
                <Card className="h-full rounded-2xl border-rose-200 shadow-lg shadow-rose-600/5 dark:border-rose-500/30 dark:shadow-rose-500/5">
                  <CardHeader>
                    <div className="flex size-11 items-center justify-center rounded-xl bg-rose-600/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
                      <Send aria-hidden="true" className="size-5" />
                    </div>
                    <CardTitle className="mt-2 text-base">
                      The I Love Doc way
                    </CardTitle>
                    <CardDescription>
                      Connect, stream, verify — one trip.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <StepList steps={DIRECT_STEPS} />
                    <p className="mt-5 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
                      Nothing to store, nothing to expire — the file was
                      never anywhere but the two devices.
                    </p>
                  </CardContent>
                </Card>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Honest comparison table */}
        <section
          aria-labelledby="compare-heading"
          className="scroll-mt-24 pb-16 md:pb-24"
        >
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2
                id="compare-heading"
                className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                The honest comparison
              </h2>
              <p className="mt-4 text-pretty text-base text-muted-foreground sm:text-lg">
                Including the trade-off nobody likes to advertise.
              </p>
            </Reveal>

            <Reveal delay={0.1} className="mt-10">
              <Card className="rounded-2xl py-0">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <caption className="sr-only">
                        Comparison of I Love Doc direct transfers with cloud
                        upload services
                      </caption>
                      <thead>
                        <tr className="border-b bg-muted/40 text-left">
                          <th scope="col" className="px-5 py-3.5 font-medium">
                            <span className="sr-only">Feature</span>
                          </th>
                          <th
                            scope="col"
                            className="px-5 py-3.5 font-semibold text-rose-600 dark:text-rose-500"
                          >
                            I Love Doc — direct
                          </th>
                          <th
                            scope="col"
                            className="px-5 py-3.5 font-medium text-muted-foreground"
                          >
                            Cloud upload services
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {COMPARISON_ROWS.map((row) => (
                          <tr key={row.label}>
                            <th
                              scope="row"
                              className="px-5 py-3.5 text-left font-medium text-muted-foreground"
                            >
                              {row.label}
                            </th>
                            <td className="px-5 py-3.5 font-medium">
                              {row.us}
                            </td>
                            <td className="px-5 py-3.5 text-muted-foreground">
                              {row.them}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="border-t px-5 py-4 text-xs leading-relaxed text-muted-foreground">
                    The direct path needs both browsers online at the same
                    time. That’s the price of keeping servers out of the
                    path — and it’s why nothing of yours is left behind when
                    the transfer ends.
                  </p>
                </CardContent>
              </Card>
            </Reveal>
          </div>
        </section>

        {/* Built to move bulk */}
        <section
          aria-labelledby="bulk-heading"
          className="scroll-mt-24 py-16 md:py-24"
        >
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2
                id="bulk-heading"
                className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                Built to move bulk
              </h2>
              <p className="mt-4 text-pretty text-base text-muted-foreground sm:text-lg">
                Large transfers aren’t an afterthought here — the protocol
                was designed around them.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {BULK_FEATURES.map(
                ({ icon: Icon, title, description }, index) => (
                  <Reveal key={title} delay={index * 0.07} className="h-full">
                    <Card className="group/card h-full gap-4 rounded-2xl transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 hover:border-rose-200 hover:shadow-lg hover:shadow-rose-600/5 dark:hover:border-rose-500/30">
                      <CardHeader>
                        <div className="flex size-11 items-center justify-center rounded-xl bg-rose-600/10 text-rose-600 transition-colors duration-300 group-hover/card:bg-rose-600/15 dark:bg-rose-500/15 dark:text-rose-400 dark:group-hover/card:bg-rose-500/20">
                          <Icon aria-hidden="true" className="size-5" />
                        </div>
                        <CardTitle className="mt-2 text-base">
                          {title}
                        </CardTitle>
                        <CardDescription className="leading-relaxed">
                          {description}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </Reveal>
                )
              )}
            </div>
          </div>
        </section>

        {/* Use cases */}
        <section
          aria-labelledby="use-cases-heading"
          className="scroll-mt-24 pb-16 md:pb-24"
        >
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2
                id="use-cases-heading"
                className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                What people move with it
              </h2>
              <p className="mt-4 text-pretty text-base text-muted-foreground sm:text-lg">
                Any file that’s too big for an email and too sensitive for a
                storage bucket.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {USE_CASES.map(({ icon: Icon, title, description }, index) => (
                <Reveal
                  key={title}
                  delay={(index % 3) * 0.07}
                  className="h-full"
                >
                  <Card className="group/card h-full gap-4 rounded-2xl transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 hover:border-rose-200 hover:shadow-lg hover:shadow-rose-600/5 dark:hover:border-rose-500/30">
                    <CardHeader>
                      <div className="flex size-11 items-center justify-center rounded-xl bg-rose-600/10 text-rose-600 transition-colors duration-300 group-hover/card:bg-rose-600/15 dark:bg-rose-500/15 dark:text-rose-400 dark:group-hover/card:bg-rose-500/20">
                        <Icon aria-hidden="true" className="size-5" />
                      </div>
                      <CardTitle className="mt-2 text-base">
                        {title}
                      </CardTitle>
                      <CardDescription className="leading-relaxed">
                        {description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ + CTA */}
        <LandingFaq
          items={FAQ_ITEMS}
          heading="Large-file questions"
          intro="The specifics of sending big files browser to browser."
        />
        <LandingCta
          title="Ready to move something big?"
          subtitle="No install, no account, no upload queue. Pick your files, share the code, and keep the tab open."
          ctaLabel="Send a large file"
        />
      </main>

      <Footer />
    </div>
  )
}
