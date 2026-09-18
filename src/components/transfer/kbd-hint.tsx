import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Tiny keyboard-hint chip shown inside buttons (decorative — the title
 * attribute carries the info for pointer users).
 */
export function KbdHint({
  children,
  onPrimary = false,
}: {
  children: ReactNode;
  onPrimary?: boolean;
}) {
  return (
    <kbd
      aria-hidden="true"
      className={cn(
        "ml-1 hidden rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none sm:inline-block",
        onPrimary
          ? "border-white/25 bg-white/15"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      {children}
    </kbd>
  );
}
