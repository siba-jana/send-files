"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowLeftRight,
  FileCheck2,
  HardDriveDownload,
  PackageCheck,
  type LucideIcon,
} from "lucide-react";

import { formatBytes } from "@/lib/transfer/stats";

interface StatsPayload {
  transfersCreated: number;
  deliveriesCompleted: number;
  filesDelivered: number;
  bytesDelivered: string;
}

const STATS_ENDPOINT = "/api/stats";
const emptySubscribe = () => () => {};

let reduceMotionCache: boolean | null = null;
function getReduceMotionSnapshot(): boolean {
  if (reduceMotionCache === null) {
    reduceMotionCache = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return reduceMotionCache;
}

/** One-shot probe (post-hydration): true when the user prefers reduced motion. */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    getReduceMotionSnapshot,
    () => false,
  );
}

/**
 * Smooth count-up from 0 → value while `active` is true. All setState
 * calls live inside rAF callbacks (async), keeping effects free of
 * synchronous setState. Callers fall back to the raw value when inactive.
 */
function useCountUp(target: number, active: boolean, durationMs = 900): number {
  const [animated, setAnimated] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || target <= 0) return;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic for a satisfying deceleration
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimated(Math.round(target * eased));
      frameRef.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [target, active, durationMs]);

  return animated;
}

interface StatItem {
  icon: LucideIcon;
  label: string;
  display: string;
}

function StatBlock({ icon: Icon, label, display }: { icon: LucideIcon; label: string; display: string }) {
  return (
    <div className="group flex flex-col items-center gap-1.5 px-4 py-5 text-center transition-colors duration-300 hover:bg-rose-50/60 sm:py-6 dark:hover:bg-rose-500/5">
      <span className="flex size-10 items-center justify-center rounded-xl bg-rose-600/10 text-rose-600 transition-transform duration-300 group-hover:scale-110 dark:bg-rose-500/15 dark:text-rose-400">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <p className="text-2xl font-semibold tabular-nums sm:text-3xl" aria-live="off">
        {display}
      </p>
      <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
    </div>
  );
}

/**
 * Trust strip with live aggregate numbers straight from the database —
 * honest counters only (every number is a real recorded event). Hidden
 * entirely when the API is unreachable rather than showing zeros.
 */
export function StatsStrip() {
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    let cancelled = false;
    fetch(STATS_ENDPOINT, { headers: { Accept: "application/json" } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return (await res.json()) as StatsPayload;
      })
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const animate = stats !== null && !reduceMotion;
  const transfersCreated = useCountUp(stats?.transfersCreated ?? 0, animate);
  const deliveriesCompleted = useCountUp(stats?.deliveriesCompleted ?? 0, animate);
  const filesDelivered = useCountUp(stats?.filesDelivered ?? 0, animate);
  const bytes = stats ? Number(stats.bytesDelivered) : 0;
  const bytesDisplay = stats ? formatBytes(bytes, 1) : "—";

  if (failed) return null;

  /** Animated count-up value, or the raw value when not animating. */
  const shown = (animated: number, raw: number): number =>
    stats === null ? raw : animate ? animated : raw;

  const items: StatItem[] = [
    {
      icon: ArrowLeftRight,
      label: "Transfers created",
      display: stats ? shown(transfersCreated, stats.transfersCreated).toLocaleString() : "—",
    },
    {
      icon: PackageCheck,
      label: "Deliveries completed",
      display: stats ? shown(deliveriesCompleted, stats.deliveriesCompleted).toLocaleString() : "—",
    },
    {
      icon: FileCheck2,
      label: "Files delivered",
      display: stats ? shown(filesDelivered, stats.filesDelivered).toLocaleString() : "—",
    },
    {
      icon: HardDriveDownload,
      label: "Data moved browser to browser",
      display: bytesDisplay,
    },
  ];

  return (
    <section aria-label="Usage statistics" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="relative overflow-hidden rounded-2xl border bg-card/60 shadow-sm">
        {/* faint rose wash + top hairline */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 gradient-rule" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_0%,rgba(244,63,94,0.06),transparent_70%)]" />
        </div>
        <div className="relative grid grid-cols-2 divide-border sm:grid-cols-4 sm:divide-x">
          {items.map((item) => (
            <StatBlock
              key={item.label}
              icon={item.icon}
              label={item.label}
              display={item.display}
            />
          ))}
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Live counts from this deployment — aggregate metadata only, never file contents.
      </p>
    </section>
  );
}
