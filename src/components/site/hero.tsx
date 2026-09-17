"use client"

import {
  MotionConfig,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion"
import {
  ArrowLeftRight,
  BadgeCheck,
  Clock,
  Download,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

import { Button } from "@/components/ui/button"

const HEART_PATH =
  "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"

/**
 * Switch the transfer widget mode and scroll it into view.
 * The widget (built separately) listens for the `ilovedoc:mode` event
 * with detail "send" | "receive".
 */
function startTransfer(mode: "send" | "receive") {
  window.dispatchEvent(new CustomEvent("ilovedoc:mode", { detail: mode }))
  const target = document.getElementById("transfer")
  if (target) {
    const top = target.getBoundingClientRect().top + window.scrollY - 80
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? "auto" : "smooth" })
  }
}

const TRUST_ITEMS = [
  { icon: ShieldCheck, label: "End-to-end encrypted" },
  { icon: ArrowLeftRight, label: "Direct P2P" },
  { icon: Clock, label: "No sign-up" },
  { icon: BadgeCheck, label: "SHA-256 verified" },
] as const

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: "easeOut" },
  },
}

export function Hero() {
  const reduceMotion = useReducedMotion()

  return (
    <MotionConfig reducedMotion="user">
      <section id="top" className="relative isolate overflow-hidden">
        {/* Decorative background: soft rose glow + faint dotted grid. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_-10%,rgba(244,63,94,0.13),transparent_70%)] dark:bg-[radial-gradient(ellipse_70%_55%_at_50%_-10%,rgba(244,63,94,0.10),transparent_70%)]" />
          <div className="absolute inset-0 [background-image:radial-gradient(rgba(15,23,42,0.10)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_35%,black_25%,transparent_75%)] dark:[background-image:radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)]" />
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pb-16 pt-16 text-center sm:px-6 md:pb-24 md:pt-24 lg:px-8"
        >
          <motion.span
            variants={itemVariants}
            className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-1.5 text-sm font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          >
            <Sparkles aria-hidden="true" className="size-4" />
            No permanent cloud storage
          </motion.span>

          <motion.h1
            variants={itemVariants}
            className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl"
          >
            Send files directly from{" "}
            <span className="text-rose-600 dark:text-rose-500">
              browser to browser
            </span>
            .
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="mt-6 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg"
          >
            Fast peer-to-peer file sharing with encrypted WebRTC connections
            and automatic relay fallback when needed.
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="mt-10 flex w-full flex-col items-center justify-center gap-4 sm:w-auto sm:flex-row"
          >
            <Button
              size="lg"
              onClick={() => startTransfer("send")}
              className="h-12 w-full rounded-xl bg-rose-600 px-7 text-base text-white shadow-lg shadow-rose-600/25 hover:bg-rose-700 dark:bg-rose-500 dark:shadow-rose-500/20 dark:hover:bg-rose-600 sm:w-auto"
            >
              <Send aria-hidden="true" />
              Send Files
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => startTransfer("receive")}
              className="h-12 w-full rounded-xl px-7 text-base sm:w-auto"
            >
              <Download aria-hidden="true" />
              Receive Files
            </Button>
          </motion.div>

          <motion.ul
            variants={itemVariants}
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
          </motion.ul>

          {/* Illustration: a heart-branded file flying between two browsers. */}
          <motion.div
            variants={itemVariants}
            aria-hidden="true"
            className="mt-14 w-full max-w-2xl md:mt-16"
          >
            <svg
              viewBox="0 0 560 200"
              focusable="false"
              className="block h-auto w-full"
            >
              {/* sender browser window */}
              <g>
                <rect
                  x="20"
                  y="30"
                  width="150"
                  height="130"
                  rx="14"
                  strokeWidth="1.5"
                  className="fill-card stroke-border"
                />
                <line
                  x1="22"
                  y1="60"
                  x2="168"
                  y2="60"
                  strokeWidth="1.5"
                  className="stroke-border"
                />
                <circle cx="38" cy="45" r="2.5" className="fill-muted-foreground/40" />
                <circle cx="48" cy="45" r="2.5" className="fill-muted-foreground/40" />
                <circle cx="58" cy="45" r="2.5" className="fill-muted-foreground/40" />
                <g
                  fill="none"
                  strokeWidth="1.6"
                  className="stroke-muted-foreground"
                >
                  <circle cx="95" cy="103" r="17" />
                  <ellipse cx="95" cy="103" rx="7" ry="17" />
                  <line x1="78" y1="103" x2="112" y2="103" />
                </g>
                <text
                  x="95"
                  y="146"
                  textAnchor="middle"
                  fontSize="12.5"
                  fontWeight="500"
                  className="fill-muted-foreground"
                >
                  Sender
                </text>
              </g>

              {/* receiver browser window */}
              <g>
                <rect
                  x="390"
                  y="30"
                  width="150"
                  height="130"
                  rx="14"
                  strokeWidth="1.5"
                  className="fill-card stroke-border"
                />
                <line
                  x1="392"
                  y1="60"
                  x2="538"
                  y2="60"
                  strokeWidth="1.5"
                  className="stroke-border"
                />
                <circle cx="408" cy="45" r="2.5" className="fill-muted-foreground/40" />
                <circle cx="418" cy="45" r="2.5" className="fill-muted-foreground/40" />
                <circle cx="428" cy="45" r="2.5" className="fill-muted-foreground/40" />
                <g
                  fill="none"
                  strokeWidth="1.6"
                  className="stroke-muted-foreground"
                >
                  <circle cx="465" cy="103" r="17" />
                  <ellipse cx="465" cy="103" rx="7" ry="17" />
                  <line x1="448" y1="103" x2="482" y2="103" />
                </g>
                <text
                  x="465"
                  y="146"
                  textAnchor="middle"
                  fontSize="12.5"
                  fontWeight="500"
                  className="fill-muted-foreground"
                >
                  Receiver
                </text>
              </g>

              {/* dashed connection with a subtle flow */}
              <motion.line
                x1="184"
                y1="100"
                x2="376"
                y2="100"
                strokeDasharray="5 7"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="stroke-muted-foreground/60"
                animate={reduceMotion ? undefined : { strokeDashoffset: [0, -24] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
              />

              {/* heart hub */}
              <circle
                cx="280"
                cy="100"
                r="13"
                className="fill-rose-600 dark:fill-rose-500"
              />
              <path
                d={HEART_PATH}
                transform="translate(274.96 94.8) scale(0.42)"
                className="fill-white"
              />

              {/* traveling heart-branded file */}
              <g transform="translate(0 100)">
                <motion.g
                  animate={
                    reduceMotion
                      ? { x: 240 }
                      : { x: [210, 350, 350], opacity: [0, 1, 0] }
                  }
                  transition={{
                    duration: 3.2,
                    times: [0, 0.72, 1],
                    repeat: Infinity,
                    repeatDelay: 0.8,
                    ease: "easeInOut",
                  }}
                >
                  <rect
                    x="-13"
                    y="-16"
                    width="26"
                    height="32"
                    rx="5"
                    strokeWidth="1.5"
                    className="fill-card stroke-foreground/60"
                  />
                  <path
                    d="M5 -16v7h8"
                    fill="none"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    className="stroke-foreground/60"
                  />
                  <path
                    d={HEART_PATH}
                    transform="translate(-4.6 1) scale(0.42)"
                    className="fill-rose-600 dark:fill-rose-500"
                  />
                </motion.g>
              </g>
            </svg>
          </motion.div>
        </motion.div>
      </section>
    </MotionConfig>
  )
}
