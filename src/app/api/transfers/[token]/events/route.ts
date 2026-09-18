import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { hashToken, timingSafeEqualHex } from '@/lib/server/crypto'
import { checkRate, clientIp } from '@/lib/server/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const querySchema = z
  .object({
    senderToken: z.string().min(1).max(256).optional(),
    receiverToken: z.string().min(1).max(256).optional(),
  })
  .refine(
    (v) =>
      (v.senderToken !== undefined && v.receiverToken === undefined) ||
      (v.senderToken === undefined && v.receiverToken !== undefined),
    { message: 'exactly one of senderToken or receiverToken' },
  )

/**
 * Party observability: the lifecycle event log for one transfer (what
 * happened and when — receiver joined, unlocked, connection kind, delivery
 * confirmations). Authenticated by the secret sender OR receiver token; a
 * party can only read the log of a transfer they took part in. Only safe
 * metadata fields are returned (kind / role / state), never raw blobs.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  // The waiting-card UI polls this while waiting — allow a comfortable cadence.
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
    senderToken: url.searchParams.get('senderToken') ?? undefined,
    receiverToken: url.searchParams.get('receiverToken') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const isSender = parsed.data.senderToken !== undefined
  const transfer = await db.transfer.findUnique({
    where: { publicToken: token },
    select: {
      id: true,
      senderTokenHash: true,
      receiverTokenHash: true,
    },
  })
  if (!transfer) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Timing-safe token check against the role-appropriate hash (same answer
  // shape for wrong token and unknown transfer — no existence oracle).
  const presented = isSender ? parsed.data.senderToken! : parsed.data.receiverToken!
  const expectedHash = isSender ? transfer.senderTokenHash : transfer.receiverTokenHash
  if (
    !expectedHash ||
    !timingSafeEqualHex(hashToken(presented), expectedHash)
  ) {
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
