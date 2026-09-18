import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/server/crypto'
import { checkRate, clientIp } from '@/lib/server/rate-limit'
import { rotateReceiverToken } from '@/lib/server/receiver-tokens'
import { insertErrorLog, logServerError } from '@/lib/server/error-log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** After this many wrong passwords, the transfer stays locked. */
const TRANSFER_FAILURE_LOCK = 15

const unlockSchema = z.object({
  password: z.string().min(1).max(128),
})

// Per-transfer failure counters keyed by publicToken (module-level,
// persisted across dev hot-reloads; cleared on success, until restart).
const globalForUnlock = globalThis as unknown as {
  __ilovedocUnlockFailures?: Map<string, number>
}
const unlockFailures: Map<string, number> =
  globalForUnlock.__ilovedocUnlockFailures ?? new Map<string, number>()
globalForUnlock.__ilovedocUnlockFailures = unlockFailures

/** Lazily flip a past-due transfer to status='expired' + log lifecycle event. */
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
    void insertErrorLog({
      level: 'warn',
      source: 'api',
      message: 'Lazy expiry update failed',
      context: { route: 'POST /api/transfers/[token]/unlock' },
    })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  // Rate limit first: 10 unlock attempts / 10 min / IP (covers per IP+token).
  const rl = checkRate(`unlock:${clientIp(req)}`, 10, 10 * 60 * 1000)
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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const parsed = unlockSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  const password = parsed.data.password

  const transfer = await db.transfer.findUnique({
    where: { publicToken: token },
    include: { files: { orderBy: { position: 'asc' } } },
  })
  if (!transfer) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Too many wrong passwords for this transfer => locked.
  if ((unlockFailures.get(token) ?? 0) >= TRANSFER_FAILURE_LOCK) {
    return NextResponse.json({ error: 'locked' }, { status: 410 })
  }

  const expiresAtIso = transfer.expiresAt.toISOString()

  // Past due or already expired.
  if (
    transfer.expiresAt.getTime() < Date.now() ||
    transfer.status === 'expired'
  ) {
    await markExpiredIfDue(transfer.id, transfer.status, transfer.expiresAt)
    return NextResponse.json(
      { error: 'expired', expiresAt: expiresAtIso },
      { status: 410 }
    )
  }
  if (transfer.status === 'cancelled') {
    return NextResponse.json({ error: 'cancelled' }, { status: 410 })
  }
  if (
    transfer.status === 'completed' ||
    transfer.downloads >= transfer.maxDownloads
  ) {
    return NextResponse.json({ error: 'completed' }, { status: 410 })
  }
  if (transfer.status !== 'waiting' && transfer.status !== 'active') {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  // Verify the password. Non-password transfers: the link itself is the
  // capability, so any unlock request passes trivially.
  const passwordOk = transfer.passwordProtected
    ? verifyPassword(
        password,
        transfer.passwordHash ?? '',
        transfer.passwordSalt ?? ''
      )
    : true

  if (!passwordOk) {
    unlockFailures.set(token, (unlockFailures.get(token) ?? 0) + 1)
    return NextResponse.json({ error: 'invalid_password' }, { status: 401 })
  }

  // Success: mint a fresh receiver capability + reveal the file names.
  let receiverToken: string
  try {
    receiverToken = await rotateReceiverToken(token)
  } catch (err) {
    console.error(
      'failed to rotate receiver token:',
      err instanceof Error ? err.message : err
    )
    logServerError(err, {
      route: 'POST /api/transfers/[token]/unlock',
      url: req.url,
      extra: { stage: 'rotate-receiver-token' },
    })
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  unlockFailures.delete(token)
  try {
    await db.transferEvent.create({
      data: {
        transferId: transfer.id,
        eventType: 'unlocked',
        // No secrets, no password material — ever.
        metadata: null,
      },
    })
  } catch (err) {
    console.error(
      'failed to log unlock event:',
      err instanceof Error ? err.message : err
    )
  }

  return NextResponse.json(
    {
      receiverToken,
      status: transfer.status,
      expiresAt: expiresAtIso,
      senderName: transfer.senderName,
      fileCount: transfer.files.length,
      totalBytes: transfer.files.reduce(
        (acc, file) => acc + Number(file.size),
        0
      ),
      files: transfer.files.map((file) => ({
        name: file.fileName,
        size: Number(file.size),
        mimeType: file.mimeType,
      })),
    },
    { status: 200 }
  )
}
