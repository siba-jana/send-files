import { Reveal } from "@/components/site/reveal"

/**
 * Logarithmic size-scale diagram for the large-files landing page.
 *
 * Scale: 10 MB (10^7 bytes) on the left to 10 TB (10^13) on the right —
 * every gridline is 10× the previous one. Markers show where common
 * "size ceilings" sit (email attachments, free cloud-transfer tiers)
 * next to I Love Doc's 10 TB per-file cap.
 *
 * x(size) = 48 + (log10(size) − 7) × (664 / 6)
 */
function xForLog10(log10: number): number {
  return 48 + (log10 - 7) * (664 / 6)
}

const DECADES: { x: number; label: string }[] = [
  { x: xForLog10(7), label: "10 MB" },
  { x: xForLog10(8), label: "100 MB" },
  { x: xForLog10(9), label: "1 GB" },
  { x: xForLog10(10), label: "10 GB" },
  { x: xForLog10(11), label: "100 GB" },
  { x: xForLog10(12), label: "1 TB" },
  { x: xForLog10(13), label: "10 TB" },
]

const HEART_PATH =
  "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"

export function SizeScale() {
  const emailX = xForLog10(Math.log10(25 * 10 ** 6)) // 25 MB
  const cloudX = xForLog10(Math.log10(2 * 10 ** 9)) // 2 GB

  return (
    <section
      aria-labelledby="size-scale-heading"
      className="py-16 md:py-24"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2
            id="size-scale-heading"
            className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Some perspective on size
          </h2>
          <p className="mt-4 text-pretty text-base text-muted-foreground sm:text-lg">
            Where the usual ceilings sit — and where a direct transfer gets
            to live.
          </p>
        </Reveal>

        <Reveal delay={0.12} className="mt-10">
          <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
            <div className="overflow-x-auto">
              <svg
                viewBox="0 0 760 180"
                role="img"
                aria-label="Logarithmic comparison: email attachments cap around 25 megabytes, free cloud transfer tiers around 2 gigabytes, while I Love Doc accepts files up to 10 terabytes."
                className="block h-auto w-full min-w-[620px]"
              >
                {/* track */}
                <line
                  x1="48"
                  y1="100"
                  x2="712"
                  y2="100"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="stroke-border"
                />

                {/* decade ticks + labels */}
                {DECADES.map((tick) => (
                  <g key={tick.label}>
                    <line
                      x1={tick.x}
                      y1="106"
                      x2={tick.x}
                      y2="113"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      className="stroke-border"
                    />
                    <text
                      x={tick.x}
                      y="130"
                      textAnchor="middle"
                      fontSize="10.5"
                      className="fill-muted-foreground"
                    >
                      {tick.label}
                    </text>
                  </g>
                ))}

                {/* email marker (25 MB) */}
                <g>
                  <line
                    x1={emailX}
                    y1="66"
                    x2={emailX}
                    y2="94"
                    strokeDasharray="3 5"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    className="stroke-muted-foreground/60"
                  />
                  <circle
                    cx={emailX}
                    cy="100"
                    r="4.5"
                    className="fill-muted-foreground"
                  />
                  <text
                    x={emailX}
                    y="34"
                    textAnchor="middle"
                    fontSize="12.5"
                    fontWeight="600"
                    className="fill-foreground"
                  >
                    25 MB
                  </text>
                  <text
                    x={emailX}
                    y="57"
                    textAnchor="middle"
                    fontSize="11"
                    className="fill-muted-foreground"
                  >
                    email attachments
                  </text>
                </g>

                {/* free cloud tier marker (2 GB) */}
                <g>
                  <line
                    x1={cloudX}
                    y1="66"
                    x2={cloudX}
                    y2="94"
                    strokeDasharray="3 5"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    className="stroke-muted-foreground/60"
                  />
                  <circle
                    cx={cloudX}
                    cy="100"
                    r="4.5"
                    className="fill-muted-foreground"
                  />
                  <text
                    x={cloudX}
                    y="34"
                    textAnchor="middle"
                    fontSize="12.5"
                    fontWeight="600"
                    className="fill-foreground"
                  >
                    2 GB
                  </text>
                  <text
                    x={cloudX}
                    y="57"
                    textAnchor="middle"
                    fontSize="11"
                    className="fill-muted-foreground"
                  >
                    free cloud-transfer tiers
                  </text>
                </g>

                {/* I Love Doc marker (10 TB) */}
                <g>
                  <line
                    x1="712"
                    y1="60"
                    x2="712"
                    y2="90"
                    strokeDasharray="3 5"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    className="stroke-rose-600/70 dark:stroke-rose-500/70"
                  />
                  <circle
                    cx="712"
                    cy="100"
                    r="9"
                    className="fill-rose-600 dark:fill-rose-500"
                  />
                  <path
                    d={HEART_PATH}
                    transform="translate(708 96.4) scale(0.335)"
                    className="fill-white"
                  />
                  <text
                    x="712"
                    y="33"
                    textAnchor="end"
                    fontSize="13"
                    fontWeight="700"
                    className="fill-rose-600 dark:fill-rose-500"
                  >
                    10 TB
                  </text>
                  <text
                    x="712"
                    y="57"
                    textAnchor="end"
                    fontSize="11"
                    className="fill-muted-foreground"
                  >
                    I Love Doc — direct transfer
                  </text>
                </g>
              </svg>
            </div>

            <p className="mt-4 border-t pt-4 text-center text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Logarithmic scale — each gridline is 10× the one before it.
              Most services make you wait while the file uploads to their
              cloud, then pay when it&apos;s too big. A direct transfer skips
              that step entirely.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
