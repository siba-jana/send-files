/**
 * In-memory fixed-window rate limiter for a single Next.js server process.
 *
 * Buckets live on globalThis so the counters survive module hot-reloads in
 * development (the same trick the Prisma singleton uses). Only allowed
 * requests count against a window, so a client that is being throttled does
 * not extend its own lockout by hammering.
 */

interface WindowState {
  count: number
  resetAt: number // epoch ms
}

const globalForRate = globalThis as unknown as {
  __ilovedocRateBuckets?: Map<string, WindowState>
}

const buckets: Map<string, WindowState> =
  globalForRate.__ilovedocRateBuckets ?? new Map<string, WindowState>()
globalForRate.__ilovedocRateBuckets = buckets

const PRUNE_INTERVAL_MS = 60_000
/** Lazy-pruning guard: prune stale entries once the map grows this large. */
const MAX_BUCKETS = 50_000

function pruneStale(now: number): void {
  for (const [key, state] of buckets) {
    if (state.resetAt <= now) buckets.delete(key)
  }
}

// Periodic pruning of stale entries. `unref` so the timer never keeps the
// Node/Bun process alive on its own.
const pruneTimer = setInterval(
  () => pruneStale(Date.now()),
  PRUNE_INTERVAL_MS
) as unknown as { unref?: () => void }
pruneTimer.unref?.()

/**
 * Fixed-window rate check.
 * @param key      arbitrary bucket key, e.g. `create:${ip}`
 * @param limit    max allowed requests per window
 * @param windowMs window length in milliseconds
 * @returns ok=false when the limit is exhausted; retryAfterSec >= 1 then.
 */
export function checkRate(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now()
  if (buckets.size > MAX_BUCKETS) pruneStale(now)

  const state = buckets.get(key)
  if (!state || state.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfterSec: 0 }
  }
  if (state.count < limit) {
    state.count += 1
    return { ok: true, retryAfterSec: 0 }
  }
  return {
    ok: false,
    retryAfterSec: Math.max(1, Math.ceil((state.resetAt - now) / 1000)),
  }
}

/**
 * Best-effort client IP for rate limiting:
 * first value of `x-forwarded-for` (set by the Caddy gateway), then
 * `x-real-ip`, else `unknown`.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp) {
    const ip = realIp.trim()
    if (ip) return ip
  }
  return 'unknown'
}

/**
 * Snapshot for the admin console: how many rate-limit windows are currently
 * active, plus the busiest ones (bucket type only — IPs are never exposed).
 */
export function rateLimitSnapshot(): {
  activeBuckets: number
  top: Array<{ type: string; count: number; resetInSec: number }>
} {
  const now = Date.now()
  let active = 0
  const top: Array<{ type: string; count: number; resetInSec: number }> = []
  for (const [key, state] of buckets) {
    if (state.resetAt <= now) continue
    active += 1
    if (state.count >= 2) {
      top.push({
        type: key.split(':')[0] ?? key,
        count: state.count,
        resetInSec: Math.ceil((state.resetAt - now) / 1000),
      })
    }
  }
  top.sort((a, b) => b.count - a.count)
  return { activeBuckets: active, top: top.slice(0, 10) }
}
