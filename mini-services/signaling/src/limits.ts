/**
 * In-memory rate limiters (SPEC §5):
 *  - per IP: ≤ 15 concurrent sockets, ≤ 30 connections per rolling minute
 *  - per socket: ≤ 80 messages per 10 s (counted for every handled event)
 *  - global room cap: 200 (checked at join time in index.ts)
 *  - signal size caps: offer/answer ≤ 64 KB, ice ≤ 2 KB, ≤ 200 ICE per socket per room
 * A periodic sweep drops stale per-IP entries so the Maps stay small.
 */

export const LIMITS = {
  maxConcurrentSocketsPerIp: 15,
  maxConnectionsPerMinutePerIp: 30,
  connectionWindowMs: 60_000,
  maxMessagesPerSocketPerWindow: 80,
  messageWindowMs: 10_000,
  maxRooms: 200,
  maxSdpSignalBytes: 65_536,
  maxIceSignalBytes: 2_048,
  maxIcePerSocketPerRoom: 200,
} as const

/** x-forwarded-for (first value) → x-real-ip → 'unknown' (SPEC §4 IP convention). */
export function ipOf(headers: Record<string, string | string[] | undefined>): string {
  const xff = headers['x-forwarded-for']
  const xffFirst = Array.isArray(xff) ? xff[0] : xff
  if (typeof xffFirst === 'string') {
    const first = xffFirst.split(',')[0]?.trim() ?? ''
    if (first.length > 0) return first
  }
  const xri = headers['x-real-ip']
  const real = Array.isArray(xri) ? xri[0] : xri
  if (typeof real === 'string' && real.trim().length > 0) return real.trim()
  return 'unknown'
}

// ---------------------------------------------------------------- per-IP connection limits

interface IpState {
  concurrent: number
  connects: number[]
}

const ipStates = new Map<string, IpState>()

/** Register an incoming connection. Returns false (without counting) when a per-IP limit is hit. */
export function tryConnection(ip: string): boolean {
  const now = Date.now()
  let state = ipStates.get(ip)
  if (!state) {
    state = { concurrent: 0, connects: [] }
    ipStates.set(ip, state)
  }
  state.connects = state.connects.filter((t) => now - t < LIMITS.connectionWindowMs)
  if (state.concurrent >= LIMITS.maxConcurrentSocketsPerIp) return false
  if (state.connects.length >= LIMITS.maxConnectionsPerMinutePerIp) return false
  state.concurrent += 1
  state.connects.push(now)
  return true
}

/** Release a previously accepted connection (on socket disconnect). */
export function releaseConnection(ip: string): void {
  const state = ipStates.get(ip)
  if (!state) return
  state.concurrent = Math.max(0, state.concurrent - 1)
}

// ---------------------------------------------------------------- per-socket message window

export interface MessageWindow {
  start: number
  count: number
}

export function newMessageWindow(): MessageWindow {
  return { start: Date.now(), count: 0 }
}

/**
 * Count one handled event. Returns false once the socket has exceeded
 * 80 messages within the current 10 s window.
 */
export function countMessage(window: MessageWindow): boolean {
  const now = Date.now()
  if (now - window.start >= LIMITS.messageWindowMs) {
    window.start = now
    window.count = 0
  }
  window.count += 1
  return window.count <= LIMITS.maxMessagesPerSocketPerWindow
}

// ---------------------------------------------------------------- housekeeping

/** Sweep stale per-IP state every minute; returns the sweep timer. */
export function startLimitsSweep(): ReturnType<typeof setInterval> {
  const timer = setInterval(() => {
    const now = Date.now()
    for (const [ip, state] of ipStates) {
      state.connects = state.connects.filter((t) => now - t < LIMITS.connectionWindowMs)
      if (state.concurrent <= 0 && state.connects.length === 0) ipStates.delete(ip)
    }
  }, LIMITS.connectionWindowMs)
  timer.unref?.()
  return timer
}
