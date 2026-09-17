import { cn } from "@/lib/utils"

/** Heart glyph (Material "favorite", 24×24) reused across brand assets. */
const HEART_PATH =
  "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"

/**
 * I Love Doc brand mark: a document with a folded corner and a filled rose
 * heart, plus the "I Love Doc" wordmark (Doc in rose).
 *
 * Rendered as inline SVG so it stays crisp from 16px to 40px.
 * Pass `markOnly` to render just the icon (e.g. inside a labelled link).
 */
export function Logo({
  className,
  markOnly = false,
}: {
  className?: string
  markOnly?: boolean
}) {
  const mark = (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn("size-7 shrink-0 text-foreground", markOnly && className)}
    >
      {/* document body with folded corner */}
      <path
        d="M10 5h8l7 7v14a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M18 5v7h7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* rose heart */}
      <path
        d={HEART_PATH}
        transform="translate(11 15.5) scale(0.5)"
        className="fill-rose-600 dark:fill-rose-500"
      />
    </svg>
  )

  if (markOnly) return mark

  return (
    <span
      className={cn(
        "inline-flex select-none items-center gap-2 text-foreground",
        className
      )}
    >
      {mark}
      <span className="text-lg font-semibold leading-none tracking-tight">
        I Love{" "}
        <span className="text-rose-600 dark:text-rose-500">Doc</span>
      </span>
    </span>
  )
}
