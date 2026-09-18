import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkRate, clientIp } from '@/lib/server/rate-limit'
import { readStatsCounters, sweepExpiredTransfers } from '@/lib/server/cleanup'
import { logServerError } from '@/lib/server/error-log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface StatsPayload {
  transfersCreated: number
  deliveriesCompleted: number
  filesDelivered: number
  bytesDelivered: string
}

interface CachedStats {
  at: number
  payload: StatsPayload
}

// Module-level cache (globalThis to survive dev hot-reloads): aggregate
// queries are cheap but this endpoint is hit by every landing-page view.
const CACHE_TTL_MS = 60_000
const globalForStats = globalThis as unknown as {
  __ilovedocStatsCache?: CachedStats
}

export async function GET(req: Request) {
  // Generous public limit: 60 requests / min / IP (the client fetches once
  // per page view; the cache makes repeat hits nearly free).
  const rl = checkRate(`stats:${clientIp(req)}`, 60, 60 * 1000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  // Opportunistic retention sweep (throttled to hourly; fire-and-forget —
  // expired-transfer metadata is purged 7 days past expiry per the Privacy
  // Policy, with its stats contribution folded into base counters first).
  sweepExpiredTransfers()

  const cached = globalForStats.__ilovedocStatsCache
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json(cached.payload, {
      headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=30' },
    })
  }

  try {
    // Honest, metadata-only aggregates — nothing here can identify a
    // transfer. A "delivery" is one receiver-confirmed handoff (the
    // signaling service logs a `completed` TransferEvent each time a
    // receiver confirms via transfer:done).
    const [transfersCreated, completedEvents, deliveredTransfers] =
      await Promise.all([
        db.transfer.count(),
        db.transferEvent.count({ where: { eventType: 'completed' } }),
        db.transferEvent.findMany({
          where: { eventType: 'completed' },
          select: { transferId: true },
          distinct: ['transferId'],
        }),
      ])

    const transferIds = deliveredTransfers.map((t) => t.transferId)
    const fileAgg =
      transferIds.length > 0
        ? await db.transferFile.aggregate({
            where: { transferId: { in: transferIds } },
            _count: true,
            _sum: { size: true },
          })
        : { _count: 0, _sum: { size: null as bigint | null } }

    const sumBytes = fileAgg._sum.size ?? BigInt(0)
    // Totals = monotonic base counters (folded-in by the retention sweep)
    // + live rows. Public numbers therefore never decrease when expired
    // transfers are purged.
    const base = await readStatsCounters()
    const payload: StatsPayload = {
      transfersCreated: Number(base.transfersCreated + BigInt(transfersCreated)),
      deliveriesCompleted: Number(
        base.deliveriesCompleted + BigInt(completedEvents)
      ),
      filesDelivered: Number(base.filesDelivered + BigInt(fileAgg._count)),
      // BigInt is not JSON-serializable — send as string; the total can
      // legitimately exceed Number.MAX_SAFE_INTEGER.
      bytesDelivered: (base.bytesDelivered + sumBytes).toString(),
    }

    globalForStats.__ilovedocStatsCache = { at: Date.now(), payload }

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=30' },
    })
  } catch (err) {
    logServerError(err, { route: 'GET /api/stats' })
    return NextResponse.json({ error: 'stats_unavailable' }, { status: 500 })
  }
}
