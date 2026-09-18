import { db } from '@/lib/db'

/**
 * Retention sweep for expired transfers (privacy policy: metadata is purged
 * within 7 days of expiry).
 *
 * Before deleting, each purged transfer's contribution to the public stats
 * (transfers created, deliveries completed, files + bytes delivered) is
 * folded into the monotonic `StatsCounter` table, so the numbers shown on
 * the home page never decrease. Counters are read/written via raw SQL — the
 * table was added after the long-running dev server booted, and raw SQL
 * sidesteps any stale Prisma-client regeneration race.
 */

const RETENTION_MS = 7 * 24 * 3_600_000 // purge 7 days after expiry
// Sweep at most once a minute: the cutoff query is an indexed range scan on
// `expiresAt` (rows older than 7 days are few), so a sub-minute check is
// effectively free while keeping the retention promise tight. The throttle
// guard itself is a single timestamp compare per request.
const SWEEP_INTERVAL_MS = 60_000

const COUNTER_KEYS = [
  'transfersCreated',
  'deliveriesCompleted',
  'filesDelivered',
  'bytesDelivered',
] as const
type CounterKey = (typeof COUNTER_KEYS)[number]

const globalForCleanup = globalThis as unknown as {
  __ilovedocSweep?: { at: number; running: boolean }
}

const ZERO = BigInt(0)

/** Normalize a raw SQLite counter value (bigint | number) to BigInt. */
function toBig(value: unknown): bigint {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(value)
  return ZERO
}

/**
 * Fire-and-forget, throttled purge. Call cheaply from a frequently hit route
 * (e.g. /api/stats) — the per-minute guard makes extra calls nearly free.
 */
export function sweepExpiredTransfers(): void {
  const state = (globalForCleanup.__ilovedocSweep ??= { at: 0, running: false })
  const now = Date.now()
  if (state.running || now - state.at < SWEEP_INTERVAL_MS) return
  state.at = now
  state.running = true

  void (async () => {
    try {
      const cutoff = new Date(now - RETENTION_MS)
      const expired = await db.transfer.findMany({
        where: { expiresAt: { lt: cutoff } },
        select: { id: true },
      })
      if (expired.length === 0) return
      const ids = expired.map((t) => t.id)

      // Fold the rows' stats contributions into base counters BEFORE the
      // delete (same aggregate definitions as /api/stats uses live).
      const [completedEvents, deliveredTransfers] = await Promise.all([
        db.transferEvent.count({
          where: { transferId: { in: ids }, eventType: 'completed' },
        }),
        db.transferEvent.findMany({
          where: { transferId: { in: ids }, eventType: 'completed' },
          select: { transferId: true },
          distinct: ['transferId'],
        }),
      ])
      const deliveredIds = deliveredTransfers.map((t) => t.transferId)
      const fileAgg =
        deliveredIds.length > 0
          ? await db.transferFile.aggregate({
              where: { transferId: { in: deliveredIds } },
              _count: true,
              _sum: { size: true },
            })
          : { _count: 0, _sum: { size: null as bigint | null } }

      const deltas: Record<CounterKey, bigint> = {
        transfersCreated: BigInt(expired.length),
        deliveriesCompleted: BigInt(completedEvents),
        filesDelivered: BigInt(fileAgg._count),
        bytesDelivered: fileAgg._sum.size ?? ZERO,
      }

      // Upsert-and-increment each counter, then delete the transfers
      // (cascade removes their file + event rows) — atomically.
      await db.$transaction([
        ...COUNTER_KEYS.map((key) =>
          db.$executeRaw`
            INSERT INTO "StatsCounter" ("key", "value")
            VALUES (${key}, ${deltas[key]})
            ON CONFLICT("key") DO UPDATE SET "value" = "value" + excluded."value"
          `
        ),
        db.transfer.deleteMany({ where: { id: { in: ids } } }),
      ])

      console.log(
        `[cleanup] purged ${expired.length} expired transfers ` +
          `(retention: ${RETENTION_MS / 3_600_000}h past expiry)`
      )
    } catch (err) {
      console.error(
        '[cleanup] sweep failed:',
        err instanceof Error ? err.message : err
      )
    } finally {
      state.running = false
    }
  })()
}

/** Read the monotonic base counters (raw SQL; missing table/rows → zeros). */
export async function readStatsCounters(): Promise<Record<CounterKey, bigint>> {
  const base: Record<CounterKey, bigint> = {
    transfersCreated: ZERO,
    deliveriesCompleted: ZERO,
    filesDelivered: ZERO,
    bytesDelivered: ZERO,
  }
  try {
    const rows = await db.$queryRaw<
      { key: string; value: unknown }[]
    >`SELECT "key", "value" FROM "StatsCounter"`
    for (const row of rows) {
      if ((COUNTER_KEYS as readonly string[]).includes(row.key)) {
        base[row.key as CounterKey] = toBig(row.value)
      }
    }
  } catch (err) {
    // Table not migrated yet (or transient) — live counts still work.
    console.error(
      '[cleanup] counter read failed:',
      err instanceof Error ? err.message : err
    )
  }
  return base
}
