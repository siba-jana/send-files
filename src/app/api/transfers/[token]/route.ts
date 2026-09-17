import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkRate, clientIp } from '@/lib/server/rate-limit'
import { rotateReceiverToken } from '@/lib/server/receiver-tokens'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Lazily flip a past-due transfer to status='expired' (idempotent, guarded so
 * concurrent requests don't double-write) and log the lifecycle event.
 */
async function markExpiredIfDue(
  transferId: string,
  status: string,
  expiresAt: Date
): Promise<void> {
  const now = Date.now()
  if (status === 'expired' || expiresAt.getTime() >= now) return
  try {
    const result = await db.transfer.updateMany({
      where: { id: transferId, status: { in: ['waiting', 'active'] } },
      data: { status: 'expired' },
    })
    if (result.count === 1) {
      await db.transferEvent.create({
        data: { transferId, eventType: 'expired', metadata: null },
      })
    }
  } catch (err) {
    console.error(
      'failed to mark transfer expired:',
      err instanceof Error ? err.message : err
    )
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  // Rate limit first: 60 metadata reads / min / IP.
  const rl = checkRate(`meta:${clientIp(req)}`, 60, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const { token } = await params
  if (!token || token.length > 64) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const transfer = await db.transfer.findUnique({
    where: { publicToken: token },
    include: { files: { orderBy: { position: 'asc' } } },
  })
  if (!transfer) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const expiresAtIso = transfer.expiresAt.toISOString()

  // 1) Past due => lazily expire.
  if (transfer.expiresAt.getTime() < Date.now()) {
    await markExpiredIfDue(transfer.id, transfer.status, transfer.expiresAt)
    return NextResponse.json(
      { error: 'expired', expiresAt: expiresAtIso },
      { status: 410 }
    )
  }
  if (transfer.status === 'expired') {
    return NextResponse.json(
      { error: 'expired', expiresAt: expiresAtIso },
      { status: 410 }
    )
  }

  // 2) Terminal states.
  if (transfer.status === 'cancelled') {
    return NextResponse.json({ error: 'cancelled' }, { status: 410 })
  }
  if (
    transfer.status === 'completed' ||
    transfer.downloads >= transfer.maxDownloads
  ) {
    return NextResponse.json({ error: 'completed' }, { status: 410 })
  }

  // 3) Live transfer (waiting | active): metadata for the recipient.
  const payload: Record<string, unknown> = {
    status: transfer.status,
    expiresAt: expiresAtIso,
    senderName: transfer.senderName,
    passwordProtected: transfer.passwordProtected,
    fileCount: transfer.files.length,
    totalBytes: transfer.files.reduce((acc, file) => acc + Number(file.size), 0),
    maxDownloads: transfer.maxDownloads,
    downloads: transfer.downloads,
    // Names stay locked behind the password until unlock.
    files: transfer.passwordProtected
      ? null
      : transfer.files.map((file) => ({
          name: file.fileName,
          size: Number(file.size),
          mimeType: file.mimeType,
        })),
  }

  // Non-password transfers: the share link IS the capability — hand out a
  // freshly rotated receiver token (stored as a hash; signaling validates
  // receiver auth against the DB).
  if (!transfer.passwordProtected) {
    try {
      payload.receiverToken = await rotateReceiverToken(token)
    } catch (err) {
      console.error(
        'failed to rotate receiver token:',
        err instanceof Error ? err.message : err
      )
      return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    }
  }

  return NextResponse.json(payload, { status: 200 })
}
