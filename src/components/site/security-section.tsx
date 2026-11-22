"use client"

import { MotionConfig, motion } from "framer-motion"
import {
  ArrowRight,
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
import { useI18n } from "@/i18n/context"

export function SecuritySection() {
  const { t } = useI18n()

  const features = [
    {
      icon: Lock,
      title: t("security.feat1Title"),
      description: t("security.feat1Desc"),
    },
    {
      icon: HardDrive,
      title: t("security.feat2Title"),
      description: t("security.feat2Desc"),
    },
    {
      icon: Eye,
      title: t("security.feat3Title"),
      description: t("security.feat3Desc"),
    },
    {
      icon: FileCheck2,
      title: t("security.feat4Title"),
      description: t("security.feat4Desc"),
    },
    {
      icon: Timer,
      title: t("security.feat5Title"),
      description: t("security.feat5Desc"),
    },
    {
      icon: UserX,
      title: t("security.feat6Title"),
      description: t("security.feat6Desc"),
    },
  ]

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
              {t("security.heading")}
            </h2>
            <p className="mt-4 text-pretty text-base text-muted-foreground sm:text-lg">
              {t("security.subheading")}
            </p>
          </motion.div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description }, index) => (
              <motion.div
                key={title}
                className="group/card h-full"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: 0.5,
                  delay: (index % 3) * 0.07,
                  ease: "easeOut",
                }}
              >
                <Card className="h-full gap-4 rounded-2xl transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 hover:border-rose-200 hover:shadow-lg hover:shadow-rose-600/5 dark:hover:border-rose-500/30">
                  <CardHeader>
                    <div className="flex size-11 items-center justify-center rounded-xl bg-rose-600/10 text-rose-600 transition-colors duration-300 group-hover/card:bg-rose-600/15 dark:bg-rose-500/15 dark:text-rose-400 dark:group-hover/card:bg-rose-500/20">
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
              {t("footer.disclaimer")}
            </span>
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, delay: 0.12, ease: "easeOut" }}
            className="mt-4 text-center text-sm"
          >
            <a
              href="/legal/privacy"
              className="group inline-flex items-center gap-1.5 rounded-sm font-medium text-foreground underline decoration-rose-600/40 underline-offset-4 outline-none transition-colors hover:decoration-rose-600 focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("common.privacy")}
              <ArrowRight
                aria-hidden="true"
                className="size-3.5 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-rose-600 dark:group-hover:text-rose-400"
              />
            </a>
          </motion.p>
        </div>
      </section>
    </MotionConfig>
  )
}
