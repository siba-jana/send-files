import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { hashToken, timingSafeEqualHex } from '@/lib/server/crypto'
import { checkRate, clientIp } from '@/lib/server/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const querySchema = z.object({
  senderToken: z.string().min(1).max(256),
})

/**
 * Sender-only observability: the lifecycle event log for one transfer
 * (what happened and when — receiver joined, unlocked, connection kind,
 * delivery confirmations). Authenticated by the secret sender token; the
 * receiver can never read another party's log. Only safe metadata fields
 * are returned (kind / role booleans), never raw metadata blobs.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  // The sender UI polls this while waiting — allow a comfortable cadence.
  const rl = checkRate(`events:${clientIp(req)}`, 60, 60_000)
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

  const url = new URL(req.url)
  const parsed = querySchema.safeParse({
    senderToken: url.searchParams.get('senderToken') ?? '',
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const transfer = await db.transfer.findUnique({
    where: { publicToken: token },
    select: { id: true, senderTokenHash: true },
  })
  if (!transfer) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Timing-safe sender-token check (same answer shape for wrong token and
  // unknown transfer — no existence oracle).
  if (!timingSafeEqualHex(hashToken(parsed.data.senderToken), transfer.senderTokenHash)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const events = await db.transferEvent.findMany({
    where: { transferId: transfer.id },
    orderBy: { createdAt: 'asc' },
    select: { eventType: true, createdAt: true, metadata: true },
    take: 200,
  })

  // Metadata is a small JSON blob written by the signaling service
  // ({ role, kind, state }). Surface only whitelisted safe fields.
  const safeEvents = events.map((event) => {
    let kind: string | null = null
    let role: string | null = null
    let state: string | null = null
    try {
      const meta = event.metadata ? (JSON.parse(event.metadata) as Record<string, unknown>) : null
      if (meta) {
        if (typeof meta.kind === 'string' && meta.kind.length <= 16) kind = meta.kind
        if (typeof meta.role === 'string' && meta.role.length <= 16) role = meta.role
        if (typeof meta.state === 'string' && meta.state.length <= 32) state = meta.state
      }
    } catch {
      /* malformed metadata — ignore */
    }
    return {
      eventType: event.eventType,
      createdAt: event.createdAt.toISOString(),
      kind,
      role,
      state,
    }
  })

  return NextResponse.json(
    { events: safeEvents },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
