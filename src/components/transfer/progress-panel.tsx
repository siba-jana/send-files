"use client";

import { useEffect, useState } from "react";
import { Check, Gauge, LoaderCircle, Timer } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  formatBytes,
  formatEta,
  formatSpeed,
} from "@/lib/transfer/stats";
import type { SenderState } from "@/lib/transfer/sender";
import type { ReceiverState } from "@/lib/transfer/receiver";
import { ConnectionBadge } from "./connection-badge";
import { FileIcon } from "./file-icon";

export interface ProgressPanelProps {
  progress: SenderState | ReceiverState;
  variant: "sending" | "receiving";
  className?: string;
}

const INDICATOR_ROSE =
  "[&_[data-slot=progress-indicator]]:bg-rose-600 dark:[&_[data-slot=progress-indicator]]:bg-rose-500";
const INDICATOR_EMERALD =
  "[&_[data-slot=progress-indicator]]:bg-emerald-600 dark:[&_[data-slot=progress-indicator]]:bg-emerald-500";
const INDICATOR_DESTRUCTIVE =
  "[&_[data-slot=progress-indicator]]:bg-destructive";

function percent(done: number, total: number): number {
  if (total <= 0) return 100;
  return Math.min(100, Math.floor((done / total) * 100));
}

/**
 * Live transfer progress: overall stats (bytes, %, speed, ETA — all real
 * values from the engine) plus a per-file breakdown. Null speed/ETA are
 * hidden rather than faked.
 */
export function ProgressPanel({ progress, variant, className }: ProgressPanelProps) {
  const isSending = variant === "sending";
  const pct = percent(progress.transferredBytes, progress.totalBytes);

  return (
    <Card className={cn("gap-0 rounded-2xl py-0", className)}>
      <CardContent className="p-6">
        {/* header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="inline-flex items-center gap-2.5 font-medium">
            <span
              aria-hidden="true"
              className="relative flex size-2.5"
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-rose-600 dark:bg-rose-500" />
            </span>
            {isSending ? "Sending files…" : "Receiving files…"}
          </p>
          <ConnectionBadge kind={progress.connectionKind} />
        </div>

        {/* overall */}
        <div className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-2xl font-semibold tabular-nums" aria-hidden="true">
              {pct}%
            </span>
            <span className="text-sm text-muted-foreground tabular-nums">
              {formatBytes(progress.transferredBytes)} /{" "}
              {formatBytes(progress.totalBytes)}
            </span>
          </div>
          <Progress
            value={pct}
            aria-label={
              isSending
                ? `Overall sending progress: ${pct}%`
                : `Overall receiving progress: ${pct}%`
            }
            className={cn(
              "mt-2 h-3 bg-rose-100 dark:bg-rose-500/20",
              INDICATOR_ROSE,
            )}
          />
          <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
            {progress.speedBps !== null && (
              <span className="inline-flex items-center gap-1.5">
                <Gauge aria-hidden="true" className="size-4" />
                <span className="tabular-nums">{formatSpeed(progress.speedBps)}</span>
              </span>
            )}
            {progress.etaSeconds !== null && (
              <span className="inline-flex items-center gap-1.5">
                <Timer aria-hidden="true" className="size-4" />
                <span>
                  Estimated time remaining:{" "}
                  <span className="tabular-nums">{formatEta(progress.etaSeconds)}</span>
                </span>
              </span>
            )}
            <span className="ml-auto tabular-nums">
              {progress.files.length} file{progress.files.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {/* per-file list */}
        <ul
          aria-label={isSending ? "Files being sent" : "Files being received"}
          className="mt-5 max-h-72 space-y-1 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:transparent"
        >
          {progress.files.map((file) => {
            const filePct = percent(file.transferred, file.size);
            const done = file.status === "done" || file.status === "verified";
            return (
              <li
                key={`${file.fileId}-${file.name}`}
                className="rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <FileIcon name={file.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatBytes(file.size)}
                    </p>
                  </div>
                  <FileStatusText
                    status={file.status}
                    filePct={filePct}
                    error={file.error}
                    variant={variant}
                  />
                </div>
                <Progress
                  value={file.status === "pending" ? 0 : filePct}
                  aria-label={`${file.name}: ${
                    done
                      ? "complete"
                      : file.status === "error"
                        ? "error"
                        : `${filePct}% transferred`
                  }`}
                  className={cn(
                    "mt-2 h-1.5",
                    file.status === "error"
                      ? INDICATOR_DESTRUCTIVE
                      : done
                        ? INDICATOR_EMERALD
                        : INDICATOR_ROSE,
                  )}
                />
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function FileStatusText({
  status,
  filePct,
  error,
  variant,
}: {
  status: SenderState["files"][number]["status"];
  filePct: number;
  error?: string;
  variant: "sending" | "receiving";
}) {
  if (status === "verified") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <Check aria-hidden="true" className="size-3.5" />
        Verified
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <Check aria-hidden="true" className="size-3.5" />
        {variant === "sending" ? "Sent" : "Received"}
      </span>
    );
  }
  if (status === "error") {
    return (
      <span
        className="shrink-0 text-xs font-medium text-destructive"
        title={error ?? "Transfer error"}
      >
        Error
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="shrink-0 text-xs text-muted-foreground">Waiting</span>
    );
  }
  return (
    <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
      {filePct}%
    </span>
  );
}

export interface ConnectionStepsProps {
  steps: readonly string[];
  className?: string;
}

/**
 * Animated connection checklist for the "connecting" phase. The engine does
 * not expose sub-step timing, so the highlight cycles as a visual heartbeat —
 * purely decorative (aria-hidden); the parent provides sr-only status text.
 */
export function ConnectionSteps({ steps, className }: ConnectionStepsProps) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((prev) => (prev + 1) % steps.length);
    }, 1700);
    return () => window.clearInterval(id);
  }, [steps.length]);

  return (
    <ol aria-hidden="true" className={cn("space-y-2.5 text-left", className)}>
      {steps.map((step, i) => {
        const done = i < active;
        const current = i === active;
        return (
          <li
            key={step}
            className={cn(
              "flex items-center gap-3 text-sm transition-colors duration-500",
              done && "text-muted-foreground",
              current && "text-foreground",
              !done && !current && "text-muted-foreground/60",
            )}
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-500",
                done &&
                  "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400",
                current && "border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-400",
                !done && !current && "border-border bg-muted/50",
              )}
            >
              {done ? (
                <Check className="size-3.5" />
              ) : current ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <span className="text-xs font-medium tabular-nums">{i + 1}</span>
              )}
            </span>
            {step}
          </li>
        );
      })}
    </ol>
  );
}
