"use client";

import { useId, useMemo, useState } from "react";
import { Activity, Gauge, Radio } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatSpeed, type TelemetrySample } from "@/lib/transfer/stats";

/* ---------------------------------------------------------------- helpers */

/** Compact axis-style time: "45s", "2m 05s". */
function fmtSecs(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

/** Floor variant for the mid-axis label so it never rounds into the end label. */
function fmtSecsFloor(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

interface Pt {
  x: number;
  y: number;
  /** index into the source samples (for hover lookups) */
  i: number;
}

interface Series {
  /** contiguous runs of points (null values break the line) */
  runs: Pt[][];
  peak: Pt | null;
  max: number;
  count: number;
}

function buildSeries(
  samples: readonly TelemetrySample[],
  pick: (s: TelemetrySample) => number | null,
  xSpan: number,
  plotW: number,
  plotH: number,
): Series {
  const values = samples.map(pick);
  const max = values.reduce<number>((m, v) => (v !== null && v > m ? v : m), 0);
  const runs: Pt[][] = [];
  let current: Pt[] = [];
  let peak: Pt | null = null;
  let count = 0;
  values.forEach((v, i) => {
    if (v === null) {
      if (current.length > 0) runs.push(current);
      current = [];
      return;
    }
    count += 1;
    const x = xSpan > 0 ? (samples[i].t / xSpan) * plotW : 0;
    const y = max > 0 ? plotH - (v / max) * plotH : plotH;
    const pt: Pt = { x, y, i };
    current.push(pt);
    if (!peak || v > pick(samples[peak.i])!) peak = pt;
  });
  if (current.length > 0) runs.push(current);
  return { runs, peak, max, count };
}

/* ------------------------------------------------------- live sparkline */

/**
 * Compact in-flight history of throughput (rose area) and RTT (muted line).
 * Purely additive to the live numbers already shown as pills.
 */
export function TelemetrySparkline({
  samples,
  className,
}: {
  samples: readonly TelemetrySample[];
  className?: string;
}) {
  const geo = useMemo(() => {
    if (samples.length < 2) return null;
    const W = 320;
    const H = 40;
    const tMax = Math.max(samples[samples.length - 1].t, 1);
    const speed = buildSeries(samples, (s) => s.bps, tMax, W, H - 2);
    const rtt = buildSeries(samples, (s) => s.rtt, tMax, W, H - 2);
    if (speed.count < 2 && rtt.count < 2) return null;
    return { W, H, tMax, speed, rtt };
  }, [samples]);

  if (!geo) return null;
  const { W, H, tMax, speed, rtt } = geo;
  const span = (pts: Pt[]) =>
    pts.map((p, k) => `${k === 0 ? "M" : "L"}${p.x.toFixed(1)},${(p.y + 1).toFixed(1)}`).join(" ");
  /** Last speed sample with a value — anchors the live pulse dot. */
  const lastSpeed = speed.runs.flatMap((r) => r)[speed.runs.flatMap((r) => r).length - 1] ?? null;

  return (
    <div className={cn("mt-3", className)}>
      <div
        className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground"
        aria-hidden="true"
      >
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Activity className="size-3" />
          Throughput &amp; RTT history
        </span>
        <span className="inline-flex items-center gap-3 tabular-nums">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-[3px] bg-rose-500" />
            speed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3 rounded-full bg-muted-foreground/70" />
            RTT
          </span>
          <span>last {fmtSecs(tMax)}</span>
        </span>
      </div>
      <div className="mt-1 overflow-hidden rounded-xl border bg-muted/20 px-1.5 py-1 dark:bg-muted/30">
        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="h-11 w-full"
            role="img"
            aria-label={`Sparkline of the transfer so far: throughput as a filled area, round-trip time as a line, over the last ${fmtSecs(tMax)}.`}
          >
          {speed.runs.map((run, k) => {
            if (run.length < 2) return null;
            const line = span(run);
            const base = run[0].x.toFixed(1);
            const end = run[run.length - 1].x.toFixed(1);
            return (
              <g key={`s${k}`}>
                <path
                  d={`${line} L${end},${H} L${base},${H} Z`}
                  className="fill-rose-500/15"
                />
                <path
                  d={line}
                  className="stroke-rose-500"
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
          {rtt.runs.map((run, k) =>
            run.length < 2 ? null : (
              <path
                key={`r${k}`}
                d={span(run)}
                className="stroke-muted-foreground/70"
                strokeWidth={1.25}
                strokeLinejoin="round"
                strokeLinecap="round"
                fill="none"
                vectorEffect="non-scaling-stroke"
              />
            ),
          )}
          {/* live leading-edge marker (HTML dot — the stretched viewBox
              would distort an SVG circle) */}
          </svg>
          {lastSpeed && (
            <span
              aria-hidden="true"
              className="absolute flex size-2.5 -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${(lastSpeed.x / W) * 100}%`,
                top: `${((lastSpeed.y + 1) / H) * 100}%`,
              }}
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-rose-600 dark:bg-rose-400" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------ completed chart */

const CW = 640;
/** Speed lane geometry (y: captionRow above, then the framed lane). */
const L1 = { capY: 12, top: 18, h: 104 };
/** RTT lane geometry, below the speed lane with its own caption row. */
const L2 = { capY: L1.top + L1.h + 16, top: L1.top + L1.h + 22, h: 44 };
const CH = L2.top + L2.h + 22;
const PAD = 6; // horizontal inset of series inside a lane
const INSET = 4; // vertical inset so flat lines never touch the lane edge

function lanePath(pts: Pt[], laneTop: number, laneH: number): string {
  // buildSeries normalizes x,y to 0..1 (y=0 is the max value, at the top).
  return pts
    .map((p, k) => {
      const x = PAD + p.x * (CW - 2 * PAD);
      const y = laneTop + INSET + p.y * (laneH - 2 * INSET);
      return `${k === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/**
 * Post-transfer telemetry as two DevTools-style lanes — speed (rose area) and
 * round-trip time (muted line) — each with its own honest scale, plus a hover
 * readout and summary pills. Rendered from engine-sampled telemetry; nothing
 * is extrapolated.
 */
export function TelemetryChart({
  samples,
  durationMs,
  className,
}: {
  samples: readonly TelemetrySample[];
  durationMs: number;
  className?: string;
}) {
  const gradId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [hover, setHover] = useState<number | null>(null);

  const geo = useMemo(() => {
    if (samples.length < 2 || durationMs < 1500) return null;
    const speed = buildSeries(samples, (s) => s.bps, durationMs, 1, 1);
    const rtt = buildSeries(samples, (s) => s.rtt, durationMs, 1, 1);
    if (speed.count < 2 && rtt.count < 2) return null;
    const rtts = samples.map((s) => s.rtt).filter((v): v is number => v !== null);
    return {
      speed,
      rtt,
      rttMin: rtts.length > 0 ? Math.min(...rtts) : null,
      rttMax: rtts.length > 0 ? Math.max(...rtts) : null,
      peakBps: speed.peak ? samples[speed.peak.i].bps : null,
      peakAt: speed.peak ? samples[speed.peak.i].t : null,
    };
  }, [samples, durationMs]);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!geo) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    let best = 0;
    let bestD = Infinity;
    const consider = (series: Series) => {
      for (const run of series.runs) {
        for (const p of run) {
          const d = Math.abs(p.x - fx);
          if (d < bestD) {
            bestD = d;
            best = p.i;
          }
        }
      }
    };
    consider(geo.speed);
    consider(geo.rtt);
    setHover(bestD === Infinity ? null : best);
  };

  if (!geo) return null;
  const { speed, rtt, peakBps, peakAt } = geo;
  const hoverSample = hover !== null ? samples[hover] : null;
  const hoverX = hoverSample ? PAD + (hoverSample.t / durationMs) * (CW - 2 * PAD) : 0;
  const sPath = (run: Pt[]) => lanePath(run, L1.top, L1.h);
  const rPath = (run: Pt[]) => lanePath(run, L2.top, L2.h);
  const peakPt =
    speed.peak && peakBps !== null
      ? {
          x: PAD + speed.peak.x * (CW - 2 * PAD),
          y: L1.top + INSET + speed.peak.y * (L1.h - 2 * INSET),
        }
      : null;

  return (
    <div className={cn("w-full", className)}>
      {/* header */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-default items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Activity aria-hidden="true" className="size-3.5" />
            Transfer telemetry
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Sampled from live WebRTC statistics about once a second while the
          transfer ran (sparser for long transfers). Nothing is extrapolated.
        </TooltipContent>
      </Tooltip>

      {/* chart */}
      <div
        className="relative mt-2 cursor-crosshair select-none"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <svg
          viewBox={`0 0 ${CW} ${CH}`}
          className="h-auto w-full touch-none"
          role="img"
          aria-label={`Chart of the transfer in two lanes: speed as a filled area and round-trip time as a line, over ${fmtSecs(durationMs)}. Peak speed ${formatSpeed(peakBps)}${geo.rttMin !== null ? `, round-trip time between ${geo.rttMin} and ${geo.rttMax} milliseconds` : ""}.`}
        >
          <defs>
            <linearGradient id={`tg${gradId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.03" />
            </linearGradient>
          </defs>

          {/* lane captions + per-lane maxima */}
          <text x={0} y={L1.capY} className="fill-muted-foreground text-[11px] font-medium">
            Speed
          </text>
          <text
            x={CW}
            y={L1.capY}
            textAnchor="end"
            className="fill-rose-600 text-[11px] font-medium tabular-nums dark:fill-rose-400"
          >
            {speed.max > 0 ? `max ${formatSpeed(speed.max)}` : "no samples"}
          </text>
          <text x={0} y={L2.capY} className="fill-muted-foreground text-[11px] font-medium">
            Round-trip time
          </text>
          <text
            x={CW}
            y={L2.capY}
            textAnchor="end"
            className="fill-muted-foreground text-[11px] font-medium tabular-nums"
          >
            {rtt.max > 0 ? `max ${Math.round(rtt.max)} ms` : "no samples"}
          </text>

          {/* speed lane */}
          <rect
            x={0.5}
            y={L1.top}
            width={CW - 1}
            height={L1.h}
            rx={10}
            className="fill-muted/30 stroke-border"
          />
          {speed.runs.map((run, k) => {
            if (run.length < 2) return null;
            const line = sPath(run);
            const base = `L${(CW - PAD).toFixed(1)},${L1.top + L1.h - INSET} L${PAD},${L1.top + L1.h - INSET} Z`;
            return (
              <g key={`s${k}`}>
                <path d={`${line} ${base}`} fill={`url(#tg${gradId})`} />
                <path
                  d={line}
                  className="stroke-rose-500"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
            );
          })}

          {/* rtt lane */}
          <rect
            x={0.5}
            y={L2.top}
            width={CW - 1}
            height={L2.h}
            rx={10}
            className="fill-muted/30 stroke-border"
          />
          {rtt.runs.map((run, k) => {
            if (run.length < 2) return null;
            const step = Math.max(1, Math.ceil(run.length / 12));
            return (
              <g key={`r${k}`}>
                <path
                  d={rPath(run)}
                  className="stroke-muted-foreground"
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  fill="none"
                />
                {run
                  .filter((_, j) => j % step === 0)
                  .map((p, j) => {
                    const x = PAD + p.x * (CW - 2 * PAD);
                    const y = L2.top + INSET + p.y * (L2.h - 2 * INSET);
                    return <circle key={j} cx={x} cy={y} r={2.25} className="fill-muted-foreground" />;
                  })}
              </g>
            );
          })}

          {/* peak marker (speed lane) */}
          {peakPt && peakBps !== null && (
            <g>
              <circle
                cx={peakPt.x}
                cy={peakPt.y}
                r={3.5}
                className="fill-background stroke-rose-500"
                strokeWidth={2}
              />
              <text
                x={
                  peakPt.x > CW * 0.62
                    ? peakPt.x - 8 - 74
                    : peakPt.x + 8
                }
                y={peakPt.y + 3.5}
                textAnchor={peakPt.x > CW * 0.62 ? "end" : "start"}
                className="fill-foreground text-[10px] font-medium tabular-nums"
              >
                peak {formatSpeed(peakBps)}
              </text>
            </g>
          )}

          {/* time axis */}
          {[0, durationMs / 2, durationMs].map((t, i) => (
            <text
              key={i}
              x={PAD + (t / durationMs) * (CW - 2 * PAD)}
              y={CH - 6}
              textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
              className="fill-muted-foreground text-[10px] tabular-nums"
            >
              {i === 1 ? fmtSecsFloor(t) : fmtSecs(t)}
            </text>
          ))}

          {/* hover guide spanning both lanes */}
          {hoverSample && (
            <line
              x1={hoverX}
              x2={hoverX}
              y1={L1.top}
              y2={L2.top + L2.h}
              className="stroke-foreground/40"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
          )}
        </svg>

        {/* hover tooltip */}
        {hoverSample && (
          <div
            className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-lg border bg-popover px-2.5 py-1.5 text-[11px] shadow-md tabular-nums"
            style={{ left: `${Math.min(86, Math.max(14, (hoverX / CW) * 100))}%` }}
          >
            <span className="font-medium">{fmtSecs(hoverSample.t)}</span>
            <span className="mx-1.5 text-muted-foreground">·</span>
            <span className="text-rose-600 dark:text-rose-400">{formatSpeed(hoverSample.bps)}</span>
            <span className="mx-1.5 text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              {hoverSample.rtt !== null ? `${hoverSample.rtt} ms RTT` : "RTT —"}
            </span>
            <span className="mx-1.5 text-muted-foreground">·</span>
            <span className="text-muted-foreground">{Math.round(hoverSample.pct * 100)}%</span>
          </div>
        )}
      </div>

      {/* summary pills */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {peakBps !== null && (
          <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
            <Gauge aria-hidden="true" className="size-3" />
            Peak {formatSpeed(peakBps)}
            {peakAt !== null && ` at ${fmtSecs(peakAt)}`}
          </span>
        )}
        {geo.rttMin !== null && geo.rttMax !== null && (
          <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
            <Radio aria-hidden="true" className="size-3" />
            RTT {geo.rttMin === geo.rttMax ? `${geo.rttMin} ms` : `${geo.rttMin}–${geo.rttMax} ms`}
          </span>
        )}
      </div>
    </div>
  );
}
