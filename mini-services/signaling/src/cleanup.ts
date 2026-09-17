import { runRetentionCleanup } from './db'
import { log, logError } from './log'

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

let timer: ReturnType<typeof setInterval> | null = null

export interface CleanupResult {
  expired: number
  events: number
  files: number
  transfers: number
  roomsRemoved: number
}

/** One cleanup pass: expire due transfers, delete 7-day-stale data, GC empty rooms. */
export function runCleanupOnce(gcEmptyRooms: () => number): CleanupResult {
  const result = runRetentionCleanup()
  const roomsRemoved = gcEmptyRooms()
  return { ...result, roomsRemoved }
}

function runOnce(gcEmptyRooms: () => number): void {
  try {
    const result = runCleanupOnce(gcEmptyRooms)
    log(
      'cleanup',
      `marked ${result.expired} expired; deleted ${result.transfers} transfers, ` +
        `${result.files} files, ${result.events} events; gc ${result.roomsRemoved} empty rooms`
    )
  } catch (err) {
    logError('cleanup', 'cleanup run failed', err)
  }
}

/** Start the scheduled job — runs once immediately at startup, then every 10 minutes. */
export function startCleanupJob(gcEmptyRooms: () => number): void {
  runOnce(gcEmptyRooms)
  if (timer) clearInterval(timer)
  timer = setInterval(() => runOnce(gcEmptyRooms), CLEANUP_INTERVAL_MS)
  timer.unref?.()
}

export function stopCleanupJob(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
