import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

/**
 * Centralized error/audit log store for the admin console (Task 16).
 *
 * All access uses Prisma's first-class `db.errorLog` model to ensure full
 * type-safety, database-engine portability (PostgreSQL/Neon/SQLite), and
 * zero raw-SQL schema mismatches.
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

/** Insert one log entry. Never throws (observability must not break requests). */
export async function insertErrorLog(input: InsertErrorInput): Promise<void> {
  try {
    const contextJson =
      input.context && Object.keys(input.context).length > 0
        ? JSON.stringify(input.context).slice(0, 4000)
        : null
    await db.errorLog.create({
      data: {
        level: input.level,
        source: sanitizeText(input.source, 32) ?? 'unknown',
        message: sanitizeText(input.message, 2000) ?? '(empty message)',
        stack: sanitizeText(input.stack, 8000),
        url: sanitizeText(input.url, 500),
        userAgent: sanitizeText(input.userAgent, 400),
        ip: sanitizeText(input.ip, 64),
        context: contextJson,
        resolved: false,
      },
    })
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

export async function queryErrorLogs(
  opts: QueryErrorLogsOptions
): Promise<{ rows: ErrorLogRow[]; total: number }> {
  try {
    const where: Prisma.ErrorLogWhereInput = {}
    if (opts.level) where.level = opts.level
    if (opts.source) where.source = opts.source
    if (opts.resolved !== undefined) where.resolved = opts.resolved
    if (opts.q) {
      where.OR = [
        { message: { contains: opts.q, mode: 'insensitive' } },
        { stack: { contains: opts.q, mode: 'insensitive' } },
      ]
    }

    const [total, rows] = await Promise.all([
      db.errorLog.count({ where }),
      db.errorLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(100, Math.max(1, opts.limit)),
        skip: Math.max(0, opts.offset),
      }),
    ])

    return {
      rows: rows.map((r) => ({
        id: r.id,
        level: r.level,
        source: r.source,
        message: r.message,
        stack: r.stack,
        url: r.url,
        userAgent: r.userAgent,
        ip: r.ip,
        context: r.context,
        resolved: r.resolved,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
    }
  } catch (err) {
    console.error('[error-log] query failed:', err)
    return { rows: [], total: 0 }
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

export async function errorLogStats(): Promise<ErrorLogStats> {
  try {
    const dayAgo = new Date(Date.now() - 24 * 3_600_000)

    const [total, unresolved, levels, sources, recent] = await Promise.all([
      db.errorLog.count().catch(() => 0),
      db.errorLog.count({ where: { resolved: false } }).catch(() => 0),
      db.errorLog.groupBy({ by: ['level'], _count: true }).catch(() => []),
      db.errorLog.groupBy({ by: ['source'], _count: true }).catch(() => []),
      db.errorLog.findMany({
        where: { createdAt: { gte: dayAgo } },
        select: { level: true, createdAt: true },
      }).catch(() => []),
    ])

    const byLevel: Record<string, number> = {}
    for (const row of levels) byLevel[row.level] = row._count
    const bySource: Record<string, number> = {}
    for (const row of sources) bySource[row.source] = row._count

    const map = new Map<number, { error: number; warn: number; info: number }>()
    for (const r of recent) {
      const bucket = Math.floor(r.createdAt.getTime() / 3_600_000) * 3_600_000
      const entry = map.get(bucket) ?? { error: 0, warn: 0, info: 0 }
      if (r.level === 'error') entry.error += 1
      else if (r.level === 'warn') entry.warn += 1
      else if (r.level === 'info') entry.info += 1
      map.set(bucket, entry)
    }

    const series24h: ErrorLogStats['series24h'] = []
    const startBucket = Math.floor(dayAgo.getTime() / 3_600_000) * 3_600_000
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
      total,
      unresolved,
      last24h,
      errors24h,
      byLevel,
      bySource,
      series24h,
    }
  } catch (err) {
    console.error('[error-log] stats failed:', err)
    return {
      total: 0,
      unresolved: 0,
      last24h: 0,
      errors24h: 0,
      byLevel: {},
      bySource: {},
      series24h: [],
    }
  }
}

/** Set the resolved flag on one row (or every unresolved row). */
export async function setErrorResolved(
  id: string | 'all-unresolved',
  resolved: boolean
): Promise<number> {
  try {
    if (id === 'all-unresolved') {
      const res = await db.errorLog.updateMany({
        where: { resolved: !resolved },
        data: { resolved },
      })
      return res.count
    }
    const res = await db.errorLog.updateMany({
      where: { id },
      data: { resolved },
    })
    return res.count
  } catch (err) {
    console.error('[error-log] setErrorResolved failed:', err)
    return 0
  }
}

/** Delete rows; scope "resolved" (default) or "all". Returns deleted count. */
export async function clearErrorLogs(scope: 'resolved' | 'all'): Promise<number> {
  try {
    const res = await db.errorLog.deleteMany({
      where: scope === 'all' ? {} : { resolved: true },
    })
    return res.count
  } catch (err) {
    console.error('[error-log] clearErrorLogs failed:', err)
    return 0
  }
}
