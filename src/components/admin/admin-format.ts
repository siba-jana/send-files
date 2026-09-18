/** Formatting helpers for the admin console (client-side, pure). */

/** Bytes as "12.4 MB" / "1.18 GB" / "3.2 TB". Accepts string (BigInt-safe). */
export function formatBytes(bytes: number | string | null | undefined): string {
  if (bytes === null || bytes === undefined) return "—"
  let value: number
  if (typeof bytes === "string") {
    // Large sums can exceed Number.MAX_SAFE_INTEGER only past ~9 PB — parse
    // via BigInt first for correctness, then downgrade for display.
    try {
      const big = BigInt(bytes)
      if (big < BigInt(1024)) return `${big.toString()} B`
      value = Number(big)
    } catch {
      return "—"
    }
  } else {
    value = bytes
  }
  if (!Number.isFinite(value) || value < 0) return "—"
  if (value < 1024) return `${Math.round(value)} B`
  const units = ["KB", "MB", "GB", "TB", "PB"]
  let u = -1
  do {
    value /= 1024
    u += 1
  } while (Math.abs(value) >= 1024 && u < units.length - 1)
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(value >= 10 ? 1 : 2)} ${units[u]}`
}

/** "14 s" / "6 m 12 s" / "3 h 24 m" / "2 d 5 h". */
export function formatUptime(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec < 0) return "—"
  const s = Math.floor(totalSec)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} m ${String(s % 60).padStart(2, "0")} s`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h} h ${String(m % 60).padStart(2, "0")} m`
  return `${Math.floor(h / 24)} d ${h % 24} h`
}

/** Compact relative time: "just now" / "4 m ago" / "3 h ago" / "2 d ago". */
export function timeAgo(iso: string | number): string {
  const ms = typeof iso === "number" ? iso : Date.parse(iso)
  if (!Number.isFinite(ms)) return "—"
  const diff = Date.now() - ms
  if (diff < 0) return "in the future"
  const s = Math.floor(diff / 1000)
  if (s < 45) return "just now"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} h ago`
  return `${Math.floor(h / 24)} d ago`
}

/** "14:32:05" in the viewer's local time. */
export function formatClock(iso: string | number): string {
  const d = typeof iso === "number" ? new Date(iso) : new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

/** "Sep 18, 14:32" in the viewer's local time. */
export function formatDateTime(iso: string | number): string {
  const d = typeof iso === "number" ? new Date(iso) : new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** "3 h left" / "expired 2 h ago" for transfer expiry. */
export function formatExpiry(iso: string): string {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return "—"
  const diff = ms - Date.now()
  if (diff > 0) return `in ${formatUptime(Math.floor(diff / 1000))}`
  return `expired ${timeAgo(ms)}`
}

/** "8c1f…" style short token. */
export function shortToken(token: string, keep = 8): string {
  if (token.length <= keep + 1) return token
  return `${token.slice(0, keep)}…`
}

/** Thousands separator. Accepts string counters (BigInt-safe transport). */
export function formatCount(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—"
  const value = typeof n === "string" ? Number(n) : n
  if (!Number.isFinite(value)) return String(n)
  return value.toLocaleString()
}
