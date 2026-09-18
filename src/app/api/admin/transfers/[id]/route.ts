import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/server/admin-auth'
import { logServerError } from '@/lib/server/error-log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    const { id } = await params
    const transfer = await db.transfer.findUnique({
      where: { id },
      include: {
        files: { orderBy: { position: 'asc' } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!transfer) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    return NextResponse.json({
      transfer: {
        id: transfer.id,
        publicToken: transfer.publicToken,
        status: transfer.status,
        senderName: transfer.senderName,
        passwordProtected: transfer.passwordProtected,
        downloads: transfer.downloads,
        maxDownloads: transfer.maxDownloads,
        createdAt: transfer.createdAt.toISOString(),
        expiresAt: transfer.expiresAt.toISOString(),
        updatedAt: transfer.updatedAt.toISOString(),
      },
      files: transfer.files.map((f) => ({
        id: f.id,
        position: f.position,
        fileName: f.fileName,
        mimeType: f.mimeType,
        size: String(f.size),
      })),
      events: transfer.events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        metadata: e.metadata,
        createdAt: e.createdAt.toISOString(),
      })),
    })
  } catch (err) {
    logServerError(err, { route: 'GET /api/admin/transfers/[id]', url: req.url })
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
