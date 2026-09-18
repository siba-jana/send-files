import { db } from '@/lib/db'
import { randomBase62 } from '@/lib/server/crypto'

/**
 * Centralized error/audit log store for the admin console (Task 16).
 *
 * All access is raw SQL via Prisma's $queryRaw/$executeRaw — the ErrorLog
 * table was added after the long-running dev server booted, and raw SQL
 * sidesteps stale Prisma-client regeneration races (same pattern as
 * lib/server/cleanup.ts uses for StatsCounter).
 *
 * SECURITY: never store secrets, share codes, tokens or file contents.
 * Callers must sanitize + cap lengths before insert (see sanitizeText).
 */

export type ErrorLevel = 'error' | 'warn' | 'info'

export const ERROR_LEVELS: readonly ErrorLevel[] = ['error', 'warn', 'info']

export interface InsertErrorInput {
  level: ErrorLevel
  /** client | api | page | signaling | admin | cleanup */
  source: string
  message: string
  stack?: string | null
  url?: string | null
  userAgent?: string | null
  ip?: string | null
  context?: Record<string, unknown> | null
}

export interface ErrorLogRow {
  id: string
  level: string
  source: string
  message: string
  stack: string | null
  url: string | null
  userAgent: string | null
  ip: string | null
  context: string | null
  resolved: boolean
  createdAt: string // ISO
}

/** Strip control characters and cap length (defense against log spam). */
export function sanitizeText(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  if (!cleaned) return null
  return cleaned.slice(0, maxLen)
}

const globalForErrorLog = globalThis as unknown as {
  __ilovedocErrorTableReady?: boolean
}

/**
 * Idempotent table bootstrap. db:push normally creates the table, but this
 * makes the module self-healing (e.g. fresh DB file) without ever throwing
 * into the caller's request path.
 */
async function ensureTable(): Promise<void> {
  if (globalForErrorLog.__ilovedocErrorTableReady) return
  try {
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS "ErrorLog" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "level" TEXT NOT NULL,
        "source" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "stack" TEXT,
        "url" TEXT,
        "userAgent" TEXT,
        "ip" TEXT,
        "context" TEXT,
        "resolved" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" DATETIME NOT NULL
      )
    `
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS "ErrorLog_createdAt_idx" ON "ErrorLog"("createdAt")
    `
    globalForErrorLog.__ilovedocErrorTableReady = true
  } catch {
    // Table creation race or read-only FS — queries below will surface it.
  }
}

/** Insert one log entry. Never throws (observability must not break requests). */
export async function insertErrorLog(input: InsertErrorInput): Promise<void> {
  try {
    await ensureTable()
    const contextJson =
      input.context && Object.keys(input.context).length > 0
        ? JSON.stringify(input.context).slice(0, 4000)
        : null
    await db.$executeRaw`
      INSERT INTO "ErrorLog" ("id", "level", "source", "message", "stack", "url", "userAgent", "ip", "context", "resolved", "createdAt")
      VALUES (
        ${randomBase62(16)},
        ${input.level},
        ${sanitizeText(input.source, 32) ?? 'unknown'},
        ${sanitizeText(input.message, 2000) ?? '(empty message)'},
        ${sanitizeText(input.stack, 8000)},
        ${sanitizeText(input.url, 500)},
        ${sanitizeText(input.userAgent, 400)},
        ${sanitizeText(input.ip, 64)},
        ${contextJson},
        false,
        ${Date.now()}
      )
    `
  } catch (err) {
    console.error(
      '[error-log] insert failed:',
      err instanceof Error ? err.message : err
    )
  }
}

/** Convenience wrapper for server-side catch blocks. */
export function logServerError(
  err: unknown,
  meta: { route?: string; url?: string; ip?: string; extra?: Record<string, unknown> }
): void {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  void insertErrorLog({
    level: 'error',
    source: 'api',
    message,
    stack: err instanceof Error ? err.stack ?? null : null,
    url: meta.url ?? null,
    ip: meta.ip ?? null,
    context: { route: meta.route, ...meta.extra },
  })
}

export interface QueryErrorLogsOptions {
  level?: ErrorLevel
  source?: string
  resolved?: boolean
  q?: string
  limit: number
  offset: number
}

interface RawErrorRow {
  id: string
  level: string
  source: string
  message: string
  stack: string | null
  url: string | null
  userAgent: string | null
  ip: string | null
  context: string | null
  resolved: number | bigint
  createdAt: Date | number | bigint
}

function normalizeRow(row: RawErrorRow): ErrorLogRow {
  const ms =
    typeof row.createdAt === 'number'
      ? row.createdAt
      : Number(row.createdAt)
  return {
    id: row.id,
    level: row.level,
    source: row.source,
    message: row.message,
    stack: row.stack,
    url: row.url,
    userAgent: row.userAgent,
    ip: row.ip,
    context: row.context,
    resolved: Boolean(row.resolved),
    createdAt: new Date(ms).toISOString(),
  }
}

export async function queryErrorLogs(
  opts: QueryErrorLogsOptions
): Promise<{ rows: ErrorLogRow[]; total: number }> {
  await ensureTable()
  const conditions: string[] = []
  const params: unknown[] = []

  if (opts.level) {
    conditions.push(`"level" = ?`)
    params.push(opts.level)
  }
  if (opts.source) {
    conditions.push(`"source" = ?`)
    params.push(opts.source)
  }
  if (opts.resolved !== undefined) {
    conditions.push(`"resolved" = ?`)
    params.push(opts.resolved ? 1 : 0)
  }
  if (opts.q) {
    conditions.push(`("message" LIKE ? OR "stack" LIKE ?)`)
    const like = `%${opts.q.replace(/[%_]/g, (m) => `\\${m}`)}%`
    params.push(like, like)
  }
  // Prisma raw SQL with SqlHelpers can't build dynamic IN lists; use
  // $queryRawUnsafe for the dynamic WHERE (params are bound, never interpolated).
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const totalRow = await db.$queryRawUnsafe<{ count: number | bigint }[]>(
    `SELECT COUNT(*) AS count FROM "ErrorLog" ${where}`,
    ...params
  )
  const rows = await db.$queryRawUnsafe<RawErrorRow[]>(
    `SELECT "id", "level", "source", "message", "stack", "url", "userAgent", "ip", "context", "resolved", "createdAt"
     FROM "ErrorLog" ${where}
     ORDER BY "createdAt" DESC
     LIMIT ? OFFSET ?`,
    ...params,
    Math.min(100, Math.max(1, opts.limit)),
    Math.max(0, opts.offset)
  )

  return {
    rows: rows.map(normalizeRow),
    total: Number(totalRow[0]?.count ?? 0),
  }
}

export interface ErrorLogStats {
  total: number
  unresolved: number
  last24h: number
  errors24h: number
  byLevel: Record<string, number>
  bySource: Record<string, number>
  /** hourly buckets covering the last 24 h, oldest first */
  series24h: Array<{ t: number; error: number; warn: number; info: number }>
}

interface HourBucket {
  bucket: number | bigint
  error: number
  warn: number
  info: number
}

export async function errorLogStats(): Promise<ErrorLogStats> {
  await ensureTable()
  const dayAgo = Date.now() - 24 * 3_600_000

  const [totals, levels, sources, buckets] = await Promise.all([
    db.$queryRaw<{ total: number | bigint; unresolved: number | bigint }[]>`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN "resolved" = 0 THEN 1 ELSE 0 END) AS unresolved
      FROM "ErrorLog"`,
    db.$queryRaw<{ level: string; count: number | bigint }[]>`
      SELECT "level", COUNT(*) AS count FROM "ErrorLog" GROUP BY "level"`,
    db.$queryRaw<{ source: string; count: number | bigint }[]>`
      SELECT "source", COUNT(*) AS count FROM "ErrorLog" GROUP BY "source"`,
    db.$queryRaw<HourBucket[]>`
      SELECT ("createdAt" / 3600000) * 3600000 AS bucket,
             SUM(CASE WHEN "level" = 'error' THEN 1 ELSE 0 END) AS error,
             SUM(CASE WHEN "level" = 'warn' THEN 1 ELSE 0 END) AS warn,
             SUM(CASE WHEN "level" = 'info' THEN 1 ELSE 0 END) AS info
      FROM "ErrorLog"
      WHERE "createdAt" >= ${dayAgo}
      GROUP BY bucket
      ORDER BY bucket ASC`,
  ])

  const byLevel: Record<string, number> = {}
  for (const row of levels) byLevel[row.level] = Number(row.count)
  const bySource: Record<string, number> = {}
  for (const row of sources) bySource[row.source] = Number(row.count)

  // Fill every hour of the window so the chart has no gaps.
  const map = new Map<number, { error: number; warn: number; info: number }>()
  for (const b of buckets) {
    map.set(Number(b.bucket), {
      error: Number(b.error),
      warn: Number(b.warn),
      info: Number(b.info),
    })
  }
  const series24h: ErrorLogStats['series24h'] = []
  const startBucket = Math.floor(dayAgo / 3_600_000) * 3_600_000
  for (let t = startBucket; t <= Date.now(); t += 3_600_000) {
    const entry = map.get(t)
    series24h.push({
      t,
      error: entry?.error ?? 0,
      warn: entry?.warn ?? 0,
      info: entry?.info ?? 0,
    })
  }

  const last24h = series24h.reduce(
    (sum, b) => sum + b.error + b.warn + b.info,
    0
  )
  const errors24h = series24h.reduce((sum, b) => sum + b.error, 0)

  return {
    total: Number(totals[0]?.total ?? 0),
    unresolved: Number(totals[0]?.unresolved ?? 0),
    last24h,
    errors24h,
    byLevel,
    bySource,
    series24h,
  }
}

/** Set the resolved flag on one row (or every unresolved row). */
export async function setErrorResolved(
  id: string | 'all-unresolved',
  resolved: boolean
): Promise<number> {
  await ensureTable()
  if (id === 'all-unresolved') {
    const res = await db.$executeRaw`
      UPDATE "ErrorLog" SET "resolved" = ${resolved ? 1 : 0} WHERE "resolved" = ${resolved ? 0 : 1}`
    return res
  }
  const res = await db.$executeRaw`
    UPDATE "ErrorLog" SET "resolved" = ${resolved ? 1 : 0} WHERE "id" = ${id}`
  return res
}

/** Delete rows; scope "resolved" (default) or "all". Returns deleted count. */
export async function clearErrorLogs(scope: 'resolved' | 'all'): Promise<number> {
  await ensureTable()
  if (scope === 'all') {
    return db.$executeRaw`DELETE FROM "ErrorLog"`
  }
  return db.$executeRaw`DELETE FROM "ErrorLog" WHERE "resolved" = 1`
}
