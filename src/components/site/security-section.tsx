"use client"

import { MotionConfig, motion } from "framer-motion"
import {
  Eye,
  FileCheck2,
  HardDrive,
  Info,
  Lock,
  Timer,
  UserX,
} from "lucide-react"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const FEATURES = [
  {
    icon: Lock,
    title: "End-to-end encrypted",
    description:
      "Files travel over a DTLS-encrypted WebRTC channel secured by modern cryptography.",
  },
  {
    icon: HardDrive,
    title: "No permanent storage",
    description:
      "Files are never stored in the cloud. The server only coordinates the handshake between browsers.",
  },
  {
    icon: Eye,
    title: "Transparent about relays",
    description:
      "If a network requires a relay, we tell you. The connection badge always shows “Direct P2P” or “Secure relay”.",
  },
  {
    icon: FileCheck2,
    title: "Integrity verified",
    description:
      "Each file is hashed with SHA-256 on both ends and verified before delivery is confirmed.",
  },
  {
    icon: Timer,
    title: "Ephemeral sessions",
    description:
      "Transfer codes and links expire automatically — from 1 hour to 7 days, your choice.",
  },
  {
    icon: UserX,
    title: "No account required",
    description:
      "No sign-up, no email, no tracking. We collect the minimum metadata needed to connect two browsers.",
  },
] as const

export function SecuritySection() {
  return (
    <MotionConfig reducedMotion="user">
      <section
        id="security"
        aria-labelledby="security-heading"
        className="scroll-mt-24 border-y bg-muted/30 py-20 md:py-28"
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
              id="security-heading"
              className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              Privacy by design
            </h2>
            <p className="mt-4 text-pretty text-base text-muted-foreground sm:text-lg">
              No accounts, no cloud storage, no tracking. Files travel straight
              from your browser to your recipient’s — here is exactly how that
              works.
            </p>
          </motion.div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }, index) => (
              <motion.div
                key={title}
                className="h-full"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: 0.5,
                  delay: (index % 3) * 0.07,
                  ease: "easeOut",
                }}
              >
                <Card className="h-full gap-4 rounded-2xl">
                  <CardHeader>
                    <div className="flex size-11 items-center justify-center rounded-xl bg-rose-600/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
                      <Icon aria-hidden="true" className="size-5" />
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

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="mx-auto mt-10 flex max-w-2xl items-center justify-center gap-2 text-center text-sm text-muted-foreground"
          >
            <Info aria-hidden="true" className="size-4 shrink-0" />
            <span>
              Designed for direct peer-to-peer transfer, with encrypted relay
              fallback when direct connectivity isn’t possible.
            </span>
          </motion.p>
        </div>
      </section>
    </MotionConfig>
  )
}
