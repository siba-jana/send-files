import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/server/admin-auth'
import { logServerError } from '@/lib/server/error-log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STATUSES = new Set([
  'waiting',
  'active',
  'completed',
  'cancelled',
  'expired',
])

export async function GET(req: Request) {
  const guard = requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    const url = new URL(req.url)
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1)
    const limit = Math.min(50, Math.max(5, Number(url.searchParams.get('limit') ?? '15') || 15))
    const statusParam = url.searchParams.get('status') ?? ''
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, 64)

    const where: Prisma.TransferWhereInput = {}
    if (STATUSES.has(statusParam)) where.status = statusParam
    if (q) {
      // Prefix search on the public token — tokens are the admin-visible handle.
      where.OR = [
        { publicToken: { startsWith: q } },
        { senderName: { contains: q } },
      ]
    }

    const [total, rows] = await Promise.all([
      db.transfer.count({ where }),
      db.transfer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          publicToken: true,
          status: true,
          senderName: true,
          passwordProtected: true,
          downloads: true,
          maxDownloads: true,
          createdAt: true,
          expiresAt: true,
          files: { select: { size: true } },
          events: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true, eventType: true },
          },
        },
      }),
    ])

    return NextResponse.json({
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      rows: rows.map((t) => {
        let bytes = BigInt(0)
        for (const f of t.files) bytes += f.size
        return {
          id: t.id,
          publicToken: t.publicToken,
          status: t.status,
          senderName: t.senderName,
          passwordProtected: t.passwordProtected,
          downloads: t.downloads,
          maxDownloads: t.maxDownloads,
          createdAt: t.createdAt.toISOString(),
          expiresAt: t.expiresAt.toISOString(),
          fileCount: t.files.length,
          totalBytes: String(bytes),
          lastEventAt: t.events[0]?.createdAt.toISOString() ?? null,
          lastEventType: t.events[0]?.eventType ?? null,
        }
      }),
    })
  } catch (err) {
    logServerError(err, { route: 'GET /api/admin/transfers', url: req.url })
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
