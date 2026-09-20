import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { log, logError } from './log'

/**
 * PostgreSQL access to the shared ilovedoc database (same DB Prisma uses).
 * Prisma stores DateTime as timestamptz. Only read queries + tiny UPDATEs /
 * event INSERTs happen here.
 */

export interface TransferRow {
  id: string
  senderTokenHash: string
  receiverTokenHash: string
  status: string
  expiresAt: Date
  maxDownloads: number
  downloads: number
  /** true when expiresAt <= NOW() */
  isExpired: boolean
}

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  throw new Error('signaling: DATABASE_URL environment variable is required')
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

// Test connection on startup
pool.query('SELECT 1').then(() => {
  log('db', `connected to PostgreSQL (pool max=5)`)
}).catch((err: unknown) => {
  logError('db', 'failed to connect to PostgreSQL', err)
  process.exit(1)
})

// Verify tables exist
pool.query(
  `SELECT COUNT(*) AS n FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN ('Transfer', 'TransferFile', 'TransferEvent')`
).then((result) => {
  const n = parseInt(result.rows[0]?.n ?? '0', 10)
  if (n !== 3) {
    throw new Error(
      `signaling: Transfer/TransferFile/TransferEvent tables are missing — run \`npx prisma db push\` in the main project first`
    )
  }
}).catch((err: unknown) => {
  logError('db', 'table verification failed', err)
  process.exit(1)
})

// ---------------------------------------------------------------- reads

export async function getTransferByToken(publicToken: string): Promise<TransferRow | null> {
  const result = await pool.query(
    `SELECT id, "senderTokenHash", "receiverTokenHash", status, "expiresAt",
            "maxDownloads", downloads,
            ("expiresAt" <= NOW()) AS "isExpired"
       FROM "Transfer"
      WHERE "publicToken" = $1`,
    [publicToken]
  )
  return result.rows[0] ?? null
}

export interface DownloadCounts {
  downloads: number
  maxDownloads: number
}

export async function getDownloadCounts(publicToken: string): Promise<DownloadCounts | null> {
  const result = await pool.query(
    `SELECT downloads, "maxDownloads" FROM "Transfer" WHERE "publicToken" = $1`,
    [publicToken]
  )
  return result.rows[0] ?? null
}

// ---------------------------------------------------------------- writes

export async function markTransferExpired(id: string): Promise<void> {
  await pool.query(
    `UPDATE "Transfer" SET status = 'expired', "updatedAt" = NOW()
     WHERE id = $1 AND status IN ('waiting','active')`,
    [id]
  )
}

export async function activateIfWaiting(publicToken: string): Promise<void> {
  await pool.query(
    `UPDATE "Transfer" SET status = 'active', "updatedAt" = NOW()
     WHERE "publicToken" = $1 AND status = 'waiting'`,
    [publicToken]
  )
}

export async function incrementDownloads(publicToken: string): Promise<void> {
  await pool.query(
    `UPDATE "Transfer" SET downloads = downloads + 1, "updatedAt" = NOW()
     WHERE "publicToken" = $1`,
    [publicToken]
  )
}

export async function completeTransfer(publicToken: string): Promise<void> {
  await pool.query(
    `UPDATE "Transfer" SET status = 'completed', "updatedAt" = NOW()
     WHERE "publicToken" = $1 AND status IN ('waiting','active')`,
    [publicToken]
  )
}

export async function cancelTransfer(publicToken: string): Promise<void> {
  await pool.query(
    `UPDATE "Transfer" SET status = 'cancelled', "updatedAt" = NOW()
     WHERE "publicToken" = $1 AND status IN ('waiting','active')`,
    [publicToken]
  )
}

export async function logEvent(transferId: string, eventType: string, metadata: Record<string, unknown>): Promise<void> {
  await pool.query(
    `INSERT INTO "TransferEvent" (id, "transferId", "eventType", metadata, "createdAt")
     VALUES ($1, $2, $3, $4, NOW())`,
    [randomUUID(), transferId, eventType, JSON.stringify(metadata)]
  )
}

// ---------------------------------------------------------------- retention cleanup

export interface RetentionResult {
  expired: number
  events: number
  files: number
  transfers: number
}

export async function runRetentionCleanup(): Promise<RetentionResult> {
  // Count and mark due expired
  const expiredCount = await pool.query(
    `SELECT COUNT(*) AS n FROM "Transfer"
     WHERE status IN ('waiting','active') AND "expiresAt" <= NOW()`
  )
  const expired = parseInt(expiredCount.rows[0]?.n ?? '0', 10)

  await pool.query(
    `UPDATE "Transfer" SET status='expired'
     WHERE status IN ('waiting','active') AND "expiresAt" <= NOW()`
  )

  // Count and delete stale events (7 days past expiry)
  const eventsCount = await pool.query(
    `SELECT COUNT(*) AS n FROM "TransferEvent"
     WHERE "transferId" IN (SELECT id FROM "Transfer" WHERE "expiresAt" <= NOW() - INTERVAL '7 days')`
  )
  const events = parseInt(eventsCount.rows[0]?.n ?? '0', 10)

  await pool.query(
    `DELETE FROM "TransferEvent"
     WHERE "transferId" IN (SELECT id FROM "Transfer" WHERE "expiresAt" <= NOW() - INTERVAL '7 days')`
  )

  // Count and delete stale files
  const filesCount = await pool.query(
    `SELECT COUNT(*) AS n FROM "TransferFile"
     WHERE "transferId" IN (SELECT id FROM "Transfer" WHERE "expiresAt" <= NOW() - INTERVAL '7 days')`
  )
  const files = parseInt(filesCount.rows[0]?.n ?? '0', 10)

  await pool.query(
    `DELETE FROM "TransferFile"
     WHERE "transferId" IN (SELECT id FROM "Transfer" WHERE "expiresAt" <= NOW() - INTERVAL '7 days')`
  )

  // Count and delete stale transfers
  const transfersCount = await pool.query(
    `SELECT COUNT(*) AS n FROM "Transfer"
     WHERE "expiresAt" <= NOW() - INTERVAL '7 days'`
  )
  const transfers = parseInt(transfersCount.rows[0]?.n ?? '0', 10)

  await pool.query(
    `DELETE FROM "Transfer"
     WHERE "expiresAt" <= NOW() - INTERVAL '7 days'`
  )

  return { expired, events, files, transfers }
}

export async function closeDb(): Promise<void> {
  await pool.end()
}
