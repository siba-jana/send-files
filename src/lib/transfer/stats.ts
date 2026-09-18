/** Transfer statistics: sliding-window speed, ETA, human formatters. */

/**
 * One telemetry reading taken while a transfer is in flight. `t` is
 * milliseconds since the transfer started; `rtt`/`bps` are null until the
 * WebRTC stats probe / speed window makes them measurable.
 */
export interface TelemetrySample {
  t: number;
  rtt: number | null;
  bps: number | null;
  /** Overall progress 0..1 at sample time. */
  pct: number;
}

/** Hard cap on retained samples; exceeding it halves resolution. */
const TELEMETRY_MAX_SAMPLES = 240;

/**
 * Fixed-cadence sample buffer for transfer telemetry. When the cap is hit the
 * buffer decimates (keeps every 2nd sample), so long transfers simply get a
 * sparser — but still honest, time-stamped — series instead of unbounded
 * memory growth.
 */
export class TelemetryBuffer {
  private data: TelemetrySample[] = [];

  push(sample: TelemetrySample): void {
    const last = this.data[this.data.length - 1];
    if (last && sample.t <= last.t) return;
    this.data.push(sample);
    if (this.data.length > TELEMETRY_MAX_SAMPLES) {
      this.data = this.data.filter((_, i) => i % 2 === 0);
    }
  }

  get samples(): readonly TelemetrySample[] {
    return this.data;
  }
}

export class SpeedTracker {
  private readonly windowMs: number;
  private samples: { t: number; bytes: number }[] = [];

  constructor(windowMs = 6000) {
    this.windowMs = windowMs;
  }

  /** Call with the cumulative transferred byte count. */
  observe(cumulativeBytes: number): void {
    const now = Date.now();
    const last = this.samples[this.samples.length - 1];
    if (last && last.bytes === cumulativeBytes) {
      last.t = now;
      return;
    }
    this.samples.push({ t: now, bytes: cumulativeBytes });
    while (this.samples.length > 2 && now - this.samples[0].t > this.windowMs) {
      this.samples.shift();
    }
  }

  /** Bytes per second over the window, or null when not yet measurable. */
  get bps(): number | null {
    if (this.samples.length < 2) return null;
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const dt = (last.t - first.t) / 1000;
    if (dt < 1) return null;
    return Math.max(0, (last.bytes - first.bytes) / dt);
  }

  reset(): void {
    this.samples = [];
  }
}

export function formatBytes(n: number, digits = 1): string {
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = n;
  let unit = -1;
  do {
    value /= 1024;
    unit += 1;
  } while (value >= 1024 && unit < units.length - 1);
  return `${value.toFixed(value >= 100 ? 0 : digits)} ${units[unit]}`;
}

export function formatSpeed(bps: number | null): string {
  if (bps === null || !Number.isFinite(bps) || bps <= 0) return '—';
  return `${formatBytes(bps, 1)}/s`;
}

export function formatEta(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 1) return 'under a second';
  if (seconds < 60) {
    const s = Math.round(seconds);
    return `${s} second${s === 1 ? '' : 's'}`;
  }
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (minutes < 60) return `${minutes} min ${secs.toString().padStart(2, '0')} s`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours} h ${mins.toString().padStart(2, '0')} min`;
}

/** Remaining time from a live speed reading, or null when unknowable. */
export function etaFromSpeed(bps: number | null, remainingBytes: number): number | null {
  if (bps === null || bps <= 0 || remainingBytes <= 0) return null;
  return remainingBytes / bps;
}
