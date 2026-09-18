"use client";

import { LoaderCircle, Shield, Zap } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ConnectionKind } from "@/lib/transfer/sender";

export interface ConnectionBadgeProps {
  kind: ConnectionKind;
  className?: string;
}

const BADGE_STYLES: Record<ConnectionKind, string> = {
  direct:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  relay:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  unknown:
    "border-border bg-muted text-muted-foreground",
};

/**
 * Honest indicator of how bytes are travelling.
 * NEVER claims "direct" when the connection is relayed.
 */
export function ConnectionBadge({ kind, className }: ConnectionBadgeProps) {
  const base = cn(
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap",
    BADGE_STYLES[kind],
    className,
  );

  if (kind === "direct") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={base} tabIndex={0}>
            <Zap aria-hidden="true" className="size-3.5" />
            Direct P2P
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-56">
          Files travel directly between the two browsers over an encrypted
          WebRTC channel.
        </TooltipContent>
      </Tooltip>
    );
  }

  if (kind === "relay") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={base} tabIndex={0}>
            <Shield aria-hidden="true" className="size-3.5" />
            Secure relay
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-56">
          Your network required a relay server for this connection. Traffic
          stays end-to-end encrypted.
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <span className={base}>
      <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
      Connecting…
    </span>
  );
}
