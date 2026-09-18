import { NextResponse } from 'next/server'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/server/admin-auth'
import { errorLogStats } from '@/lib/server/error-log'
import { readStatsCounters } from '@/lib/server/cleanup'
import { rateLimitSnapshot } from '@/lib/server/rate-limit'
import { logServerError } from '@/lib/server/error-log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DAY_MS = 24 * 3_600_000

/** Live snapshot of the signaling mini-service (server-to-server, loopback). */
async function signalingSnapshot(): Promise<unknown> {
  try {
    // Port 3004 = signaling's internal stats server (loopback-only, header-
    // guarded). Port 3003 is engine.io with path '/' and 400s plain requests.
    const res = await fetch('http://127.0.0.1:3004/internal/stats', {
      signal: AbortSignal.timeout(2500),
      cache: 'no-store',
      headers: { 'x-ilovedoc-internal': '1' },
    })
    if (!res.ok) return { ok: false, status: res.status }
    return await res.json()
  } catch {
    return { ok: false, status: 0 }
  }
}

/** Last N lines of the dev server log (bounded read). */
async function serverLogTail(): Promise<{ lines: string[]; bytes: number }> {
  try {
    const file = path.join(process.cwd(), 'dev.log')
    const info = await stat(file)
    const { open } = await import('node:fs/promises')
    const handle = await open(file, 'r')
    try {
      const maxBytes = 96 * 1024
      const start = Math.max(0, info.size - maxBytes)
      const buffer = Buffer.alloc(info.size - start)
      await handle.read(buffer, 0, buffer.length, start)
      const text = buffer.toString('utf8')
      const lines = text.split('\n').filter((l) => l.trim().length > 0)
      return { lines: lines.slice(-250), bytes: info.size }
    } finally {
      await handle.close()
    }
  } catch {
    return { lines: [], bytes: 0 }
  }
}

export async function GET(req: Request) {
  const guard = requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    const dayAgo = Date.now() - DAY_MS

    const [
      statusGroups,
      fileAgg,
      created24h,
      completedBuckets,
      recentEvents,
      counters,
      errors,
      signaling,
      serverLog,
    ] = await Promise.all([
      db.transfer.groupBy({ by: ['status'], _count: true }),
      db.transferFile.aggregate({ _count: true, _sum: { size: true } }),
      db.transfer.findMany({
        where: { createdAt: { gte: new Date(dayAgo) } },
        select: { createdAt: true },
      }),
      db.transferEvent.findMany({
        where: { eventType: 'completed', createdAt: { gte: new Date(dayAgo) } },
        select: { createdAt: true },
      }),
      db.transferEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 14,
        include: { transfer: { select: { publicToken: true, status: true } } },
      }),
      readStatsCounters(),
      errorLogStats(),
      signalingSnapshot(),
      serverLogTail(),
    ])

    const byStatus: Record<string, number> = {}
    for (const g of statusGroups) byStatus[g.status] = g._count

    // Merge the three 24 h series into aligned hourly buckets, oldest first.
    const hourly = new Map<number, { created: number; completed: number; errors: number }>()
    const bucketOf = (ms: number) => Math.floor(ms / 3_600_000) * 3_600_000
    for (const row of created24h) {
      const b = bucketOf(row.createdAt.getTime())
      const e = hourly.get(b) ?? { created: 0, completed: 0, errors: 0 }
      e.created += 1
      hourly.set(b, e)
    }
    for (const row of completedBuckets) {
      const b = bucketOf(row.createdAt.getTime())
      const e = hourly.get(b) ?? { created: 0, completed: 0, errors: 0 }
      e.completed += 1
      hourly.set(b, e)
    }
    for (const b of errors.series24h) {
      const e = hourly.get(b.t) ?? { created: 0, completed: 0, errors: 0 }
      e.errors += b.error + b.warn
      hourly.set(b.t, e)
    }
    const startBucket = bucketOf(dayAgo)
    const series24h: Array<{ t: number; created: number; completed: number; errors: number }> = []
    for (let t = startBucket; t <= Date.now(); t += 3_600_000) {
      series24h.push({ t, ...(hourly.get(t) ?? { created: 0, completed: 0, errors: 0 }) })
    }

    const mem = process.memoryUsage()
    let dbBytes = 0
    try {
      dbBytes = (await stat(path.join(process.cwd(), 'db', 'custom.db'))).size
    } catch {
      /* non-fatal */
    }

    return NextResponse.json({
      transfers: {
        total: Object.values(byStatus).reduce((a, b) => a + b, 0),
        byStatus,
        files: fileAgg._count,
        bytes: String(fileAgg._sum.size ?? 0),
        allTime: {
          transfersCreated: String(counters.transfersCreated),
          deliveriesCompleted: String(counters.deliveriesCompleted),
          filesDelivered: String(counters.filesDelivered),
          bytesDelivered: String(counters.bytesDelivered),
        },
        created24h: created24h.length,
        completed24h: completedBuckets.length,
      },
      series24h,
      errors: {
        total: errors.total,
        unresolved: errors.unresolved,
        last24h: errors.last24h,
        errors24h: errors.errors24h,
        byLevel: errors.byLevel,
        bySource: errors.bySource,
        series24h: errors.series24h,
      },
      recentEvents: recentEvents.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        metadata: e.metadata,
        createdAt: e.createdAt.toISOString(),
        token: e.transfer.publicToken,
        transferStatus: e.transfer.status,
      })),
      signaling,
      rateLimits: rateLimitSnapshot(),
      system: {
        uptimeSec: Math.floor(process.uptime()),
        rssBytes: mem.rss,
        heapUsedBytes: mem.heapUsed,
        nodeVersion: process.version,
        platform: `${process.platform} ${process.arch}`,
        nodeEnv: process.env.NODE_ENV ?? 'development',
        pid: process.pid,
        dbBytes,
        turnConfigured: Boolean(process.env.TURN_URL),
        pepperSet: Boolean(process.env.CODE_PEPPER),
      },
      serverLog,
      session: { expiresAt: guard.session.expiresAt },
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    logServerError(err, { route: 'GET /api/admin/overview', url: req.url })
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
