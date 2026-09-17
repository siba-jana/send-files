import { randomUUID } from 'node:crypto'
import { Database } from 'bun:sqlite'
import { log } from './log'

/**
 * Raw SQLite access to the shared ilovedoc database (same file Prisma uses).
 * Prisma stores DateTime as epoch-ms INTEGER, so expiry comparisons in SQL use
 * `1000 * CAST(strftime('%s','now') AS INTEGER)` (verified in Task 1).
 * Only read queries + tiny UPDATEs / event INSERTs happen here.
 */

export interface TransferRow {
  id: string
  senderTokenHash: string
  receiverTokenHash: string
  status: string
  expiresAt: number
  maxDownloads: number
  downloads: number
  /** 1 when expiresAt <= 1000 * CAST(strftime('%s','now') AS INTEGER) */
  isExpired: number
}

export const DB_PATH = process.env.DB_PATH || '/home/z/my-project/db/custom.db'

export const sqlite = new Database(DB_PATH)
sqlite.exec('PRAGMA journal_mode = WAL;')
sqlite.exec('PRAGMA busy_timeout = 5000;')

const tableCount = sqlite.prepare(
  "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN ('Transfer', 'TransferFile', 'TransferEvent')"
).get() as { n: number } | null

if (!tableCount || tableCount.n !== 3) {
  throw new Error(
    `signaling: Transfer/TransferFile/TransferEvent tables are missing in ${DB_PATH} — run \`bun run db:push\` in the main project first`
  )
}

log('db', `opened ${DB_PATH} (WAL, busy_timeout=5000)`)

const nowMs = (): number => Date.now()

// ---------------------------------------------------------------- reads

const qGetTransfer = sqlite.prepare(
  `SELECT id, senderTokenHash, receiverTokenHash, status, expiresAt, maxDownloads, downloads,
          (expiresAt <= 1000 * CAST(strftime('%s','now') AS INTEGER)) AS isExpired
     FROM Transfer
    WHERE publicToken = ?`
)

const qGetDownloadCounts = sqlite.prepare(
  'SELECT downloads, maxDownloads FROM Transfer WHERE publicToken = ?'
)

export function getTransferByToken(publicToken: string): TransferRow | null {
  return (qGetTransfer.get(publicToken) as TransferRow | null) ?? null
}

export interface DownloadCounts {
  downloads: number
  maxDownloads: number
}

export function getDownloadCounts(publicToken: string): DownloadCounts | null {
  return (qGetDownloadCounts.get(publicToken) as DownloadCounts | null) ?? null
}

// ---------------------------------------------------------------- writes

const qMarkExpiredById = sqlite.prepare(
  `UPDATE Transfer SET status = 'expired', updatedAt = ? WHERE id = ? AND status IN ('waiting','active')`
)

const qActivateIfWaiting = sqlite.prepare(
  `UPDATE Transfer SET status = 'active', updatedAt = ? WHERE publicToken = ? AND status = 'waiting'`
)

const qIncrementDownloads = sqlite.prepare(
  `UPDATE Transfer SET downloads = downloads + 1, updatedAt = ? WHERE publicToken = ?`
)

const qCompleteTransfer = sqlite.prepare(
  `UPDATE Transfer SET status = 'completed', updatedAt = ? WHERE publicToken = ? AND status IN ('waiting','active')`
)

const qCancelTransfer = sqlite.prepare(
  `UPDATE Transfer SET status = 'cancelled', updatedAt = ? WHERE publicToken = ? AND status IN ('waiting','active')`
)

const qInsertEvent = sqlite.prepare(
  `INSERT INTO TransferEvent (id, transferId, eventType, metadata, createdAt) VALUES (?, ?, ?, ?, ?)`
)

/** Lazily mark a transfer expired (when a join hits an already-due expiresAt). */
export function markTransferExpired(id: string): void {
  qMarkExpiredById.run(nowMs(), id)
}

/** waiting → active, fired when a receiver joins. */
export function activateIfWaiting(publicToken: string): void {
  qActivateIfWaiting.run(nowMs(), publicToken)
}

export function incrementDownloads(publicToken: string): void {
  qIncrementDownloads.run(nowMs(), publicToken)
}

export function completeTransfer(publicToken: string): void {
  qCompleteTransfer.run(nowMs(), publicToken)
}

export function cancelTransfer(publicToken: string): void {
  qCancelTransfer.run(nowMs(), publicToken)
}

/** Append an audit event. `metadata` must never contain tokens, passwords or file content. */
export function logEvent(transferId: string, eventType: string, metadata: Record<string, unknown>): void {
  qInsertEvent.run(randomUUID(), transferId, eventType, JSON.stringify(metadata), nowMs())
}

// ---------------------------------------------------------------- retention cleanup

export interface RetentionResult {
  expired: number
  events: number
  files: number
  transfers: number
}

const qCountDueExpired = sqlite.prepare(
  `SELECT COUNT(*) AS n FROM Transfer WHERE status IN ('waiting','active') AND expiresAt <= 1000 * CAST(strftime('%s','now') AS INTEGER)`
)
const qExpireDue = sqlite.prepare(
  `UPDATE Transfer SET status='expired' WHERE status IN ('waiting','active') AND expiresAt <= 1000 * CAST(strftime('%s','now') AS INTEGER)`
)
const qCountStaleEvents = sqlite.prepare(
  `SELECT COUNT(*) AS n FROM TransferEvent WHERE transferId IN (SELECT id FROM Transfer WHERE expiresAt <= 1000 * (CAST(strftime('%s','now') AS INTEGER) - 604800))`
)
const qDeleteStaleEvents = sqlite.prepare(
  `DELETE FROM TransferEvent WHERE transferId IN (SELECT id FROM Transfer WHERE expiresAt <= 1000 * (CAST(strftime('%s','now') AS INTEGER) - 604800))`
)
const qCountStaleFiles = sqlite.prepare(
  `SELECT COUNT(*) AS n FROM TransferFile WHERE transferId IN (SELECT id FROM Transfer WHERE expiresAt <= 1000 * (CAST(strftime('%s','now') AS INTEGER) - 604800))`
)
const qDeleteStaleFiles = sqlite.prepare(
  `DELETE FROM TransferFile WHERE transferId IN (SELECT id FROM Transfer WHERE expiresAt <= 1000 * (CAST(strftime('%s','now') AS INTEGER) - 604800))`
)
const qCountStaleTransfers = sqlite.prepare(
  `SELECT COUNT(*) AS n FROM Transfer WHERE expiresAt <= 1000 * (CAST(strftime('%s','now') AS INTEGER) - 604800)`
)
const qDeleteStaleTransfers = sqlite.prepare(
  `DELETE FROM Transfer WHERE expiresAt <= 1000 * (CAST(strftime('%s','now') AS INTEGER) - 604800)`
)

function countOf(stmt: { get(): unknown }): number {
  const row = stmt.get() as { n: number } | null
  return row?.n ?? 0
}

/**
 * Mark due transfers expired + delete transfers older than 7 days past expiry,
 * deleting their events/files explicitly (raw SQLite has no FK cascade).
 */
export function runRetentionCleanup(): RetentionResult {
  const expired = countOf(qCountDueExpired)
  qExpireDue.run()
  const events = countOf(qCountStaleEvents)
  qDeleteStaleEvents.run()
  const files = countOf(qCountStaleFiles)
  qDeleteStaleFiles.run()
  const transfers = countOf(qCountStaleTransfers)
  qDeleteStaleTransfers.run()
  return { expired, events, files, transfers }
}

export function closeDb(): void {
  sqlite.close()
}
