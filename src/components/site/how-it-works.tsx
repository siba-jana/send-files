"use client"

import { MotionConfig, motion } from "framer-motion"
import {
  ArrowRight,
  BadgeCheck,
  FolderUp,
  HardDrive,
  Network,
  Share2,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const STEPS = [
  {
    icon: FolderUp,
    title: "Select your files",
    description:
      "Choose one file or hundreds. They stay on your device until a recipient connects — nothing is uploaded.",
  },
  {
    icon: Share2,
    title: "Share the code",
    description:
      "Get a short transfer code, a share link, or a QR code. Send it to your recipient any way you like.",
  },
  {
    icon: Network,
    title: "Connect directly",
    description:
      "The two browsers negotiate an encrypted WebRTC channel and files stream peer-to-peer.",
  },
  {
    icon: BadgeCheck,
    title: "Verified delivery",
    description:
      "Every file is checked with SHA-256 integrity verification before it’s saved on the recipient’s device.",
  },
] as const

export function HowItWorks() {
  return (
    <MotionConfig reducedMotion="user">
      <section
        id="how-it-works"
        aria-labelledby="how-it-works-heading"
        className="scroll-mt-24 py-20 md:py-28"
      >
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="mx-auto max-w-2xl text-center"
          >
            <h2
              id="how-it-works-heading"
              className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              How it works
            </h2>
            <p className="mt-4 text-pretty text-base text-muted-foreground sm:text-lg">
              No cloud in between. Your files stream straight to the
              recipient’s browser.
            </p>
          </motion.div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, description }, index) => (
              <motion.div
                key={title}
                className="group/card h-full"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.07,
                  ease: "easeOut",
                }}
              >
                <Card className="h-full gap-4 rounded-2xl transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 hover:border-rose-200 hover:shadow-lg hover:shadow-rose-600/5 dark:hover:border-rose-500/30">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex size-11 items-center justify-center rounded-xl bg-rose-600/10 text-rose-600 transition-colors duration-300 group-hover/card:bg-rose-600/15 dark:bg-rose-500/15 dark:text-rose-400 dark:group-hover/card:bg-rose-500/20">
                        <Icon aria-hidden="true" className="size-5" />
                      </div>
                      <span
                        aria-hidden="true"
                        className="inline-flex size-7 items-center justify-center rounded-full bg-rose-600/10 text-sm font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                      >
                        {index + 1}
                      </span>
                    </div>
                    <CardTitle className="mt-2 text-base">{title}</CardTitle>
                    <CardDescription className="leading-relaxed">
                      {description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Connection diagram: direct path + relay fallback. */}
          <Card className="mt-10 gap-0 rounded-2xl py-0">
            <CardContent className="overflow-x-auto p-4 sm:p-6">
              <svg
                viewBox="0 0 760 330"
                role="img"
                aria-label="Diagram: the sender’s browser and the receiver’s browser exchange files over a direct encrypted connection; when a direct connection isn’t possible, traffic takes a dashed fallback path through an encrypted relay."
                className="block h-auto w-full min-w-[620px]"
              >
                {/* direct connection */}
                <line
                  x1="246"
                  y1="125"
                  x2="514"
                  y2="125"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="stroke-rose-600 dark:stroke-rose-500"
                />
                <path
                  d="M255 118l8 7-8 7"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="stroke-rose-600 dark:stroke-rose-500"
                />
                <path
                  d="M505 118l-8 7 8 7"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="stroke-rose-600 dark:stroke-rose-500"
                />
                <text
                  x="380"
                  y="88"
                  textAnchor="middle"
                  fontSize="13.5"
                  fontWeight="600"
                  className="fill-foreground"
                >
                  Direct encrypted connection
                </text>
                <text
                  x="380"
                  y="105"
                  textAnchor="middle"
                  fontSize="11.5"
                  className="fill-muted-foreground"
                >
                  DTLS-secured WebRTC channel
                </text>

                {/* relay fallback paths */}
                <path
                  d="M135 190C135 242 210 268 300 268"
                  fill="none"
                  strokeDasharray="3 7"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  className="stroke-muted-foreground/70"
                />
                <path
                  d="M460 268C550 268 625 242 625 190"
                  fill="none"
                  strokeDasharray="3 7"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  className="stroke-muted-foreground/70"
                />

                {/* relay node */}
                <rect
                  x="300"
                  y="240"
                  width="160"
                  height="56"
                  rx="14"
                  strokeWidth="1.5"
                  className="fill-card stroke-border"
                />
                <g fill="none" strokeWidth="1.6" className="stroke-muted-foreground">
                  <rect x="328" y="257" width="20" height="9" rx="2" />
                  <rect x="328" y="270" width="20" height="9" rx="2" />
                  <circle cx="333" cy="261.5" r="1" className="fill-muted-foreground stroke-none" />
                  <circle cx="333" cy="274.5" r="1" className="fill-muted-foreground stroke-none" />
                </g>
                <text
                  x="356"
                  y="272"
                  fontSize="13"
                  fontWeight="600"
                  className="fill-foreground"
                >
                  Secure relay
                </text>
                <text
                  x="380"
                  y="315"
                  textAnchor="middle"
                  fontSize="11.5"
                  className="fill-muted-foreground"
                >
                  Relay — only used when a direct connection isn’t possible
                </text>

                {/* lock badge on the direct path */}
                <circle
                  cx="380"
                  cy="125"
                  r="15"
                  className="fill-rose-600 dark:fill-rose-500"
                />
                <g transform="translate(380 125)">
                  <rect
                    x="-5.5"
                    y="-2"
                    width="11"
                    height="8.5"
                    rx="1.5"
                    className="fill-white"
                  />
                  <path
                    d="M-3.2 -2v-2.4a3.2 3.2 0 0 1 6.4 0V-2"
                    fill="none"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    className="stroke-white"
                  />
                </g>

                {/* sender node */}
                <g>
                  <rect
                    x="40"
                    y="60"
                    width="190"
                    height="130"
                    rx="18"
                    strokeWidth="1.5"
                    className="fill-card stroke-border"
                  />
                  <g
                    fill="none"
                    strokeWidth="1.6"
                    className="stroke-muted-foreground"
                  >
                    <circle cx="135" cy="102" r="16" />
                    <ellipse cx="135" cy="102" rx="7" ry="16" />
                    <line x1="119" y1="102" x2="151" y2="102" />
                  </g>
                  <text
                    x="135"
                    y="148"
                    textAnchor="middle"
                    fontSize="14"
                    fontWeight="600"
                    className="fill-foreground"
                  >
                    Sender browser
                  </text>
                  <text
                    x="135"
                    y="166"
                    textAnchor="middle"
                    fontSize="11"
                    className="fill-muted-foreground"
                  >
                    nothing is uploaded
                  </text>
                </g>

                {/* receiver node */}
                <g>
                  <rect
                    x="530"
                    y="60"
                    width="190"
                    height="130"
                    rx="18"
                    strokeWidth="1.5"
                    className="fill-card stroke-border"
                  />
                  <g
                    fill="none"
                    strokeWidth="1.6"
                    className="stroke-muted-foreground"
                  >
                    <circle cx="625" cy="102" r="16" />
                    <ellipse cx="625" cy="102" rx="7" ry="16" />
                    <line x1="609" y1="102" x2="641" y2="102" />
                  </g>
                  <text
                    x="625"
                    y="148"
                    textAnchor="middle"
                    fontSize="14"
                    fontWeight="600"
                    className="fill-foreground"
                  >
                    Receiver browser
                  </text>
                  <text
                    x="625"
                    y="166"
                    textAnchor="middle"
                    fontSize="11"
                    className="fill-muted-foreground"
                  >
                    verified with SHA-256
                  </text>
                </g>
              </svg>
            </CardContent>
          </Card>
          {/* Deeper guides: contextual links to the dedicated landing pages. */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <motion.a
              href="/how-it-works"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="group/guide flex flex-col rounded-2xl border bg-card p-5 shadow-sm outline-none transition-[border-color,box-shadow] duration-300 hover:border-rose-200 hover:shadow-lg hover:shadow-rose-600/5 focus-visible:ring-2 focus-visible:ring-ring dark:hover:border-rose-500/30"
            >
              <span className="inline-flex items-center gap-2 text-sm font-semibold">
                <Network
                  aria-hidden="true"
                  className="size-4 text-rose-600 dark:text-rose-500"
                />
                The full technical guide
              </span>
              <span className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Handshake, encryption, chunking, teardown — the complete
                story of a transfer.
              </span>
              <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 dark:text-rose-500">
                Read how it works
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 transition-transform duration-300 group-hover/guide:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover/guide:translate-x-0"
                />
              </span>
            </motion.a>
            <motion.a
              href="/send-large-files"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: 0.08, ease: "easeOut" }}
              className="group/guide flex flex-col rounded-2xl border bg-card p-5 shadow-sm outline-none transition-[border-color,box-shadow] duration-300 hover:border-rose-200 hover:shadow-lg hover:shadow-rose-600/5 focus-visible:ring-2 focus-visible:ring-ring dark:hover:border-rose-500/30"
            >
              <span className="inline-flex items-center gap-2 text-sm font-semibold">
                <HardDrive
                  aria-hidden="true"
                  className="size-4 text-rose-600 dark:text-rose-500"
                />
                Sending something huge?
              </span>
              <span className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Up to 10 TB per file, streamed direct — see the large-file
                guide.
              </span>
              <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 dark:text-rose-500">
                Send large files
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 transition-transform duration-300 group-hover/guide:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover/guide:translate-x-0"
                />
              </span>
            </motion.a>
          </div>
        </div>
      </section>
    </MotionConfig>
  )
}
