import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { hashCode } from '@/lib/server/crypto'
import { checkRate, clientIp } from '@/lib/server/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** After this many failed lookups, a code stays not_found until restart. */
const CODE_FAILURE_LOCK = 20

const lookupSchema = z.object({
  code: z.string().min(1).max(128),
})

// Per-code failure counters (module-level, persisted across dev hot-reloads).
// Keys are peppered code hashes; only failures are counted. Key space is
// naturally bounded by the 10^6 possible share codes.
const globalForLookup = globalThis as unknown as {
  __ilovedocCodeFailures?: Map<string, number>
}
const codeFailures: Map<string, number> =
  globalForLookup.__ilovedocCodeFailures ?? new Map<string, number>()
globalForLookup.__ilovedocCodeFailures = codeFailures

export async function POST(req: Request) {
  // Rate limit first: 10 lookups / 10 min / IP.
  const rl = checkRate(`lookup:${clientIp(req)}`, 10, 10 * 60 * 1000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const parsed = lookupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  // Strip non-digits, require exactly 6. Malformed input gets the same
  // answer as an unknown code — never reveal why a lookup failed.
  const code = parsed.data.code.replace(/\D/g, '')
  if (code.length !== 6) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const codeHash = hashCode(code)
  if ((codeFailures.get(codeHash) ?? 0) >= CODE_FAILURE_LOCK) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const transfer = await db.transfer.findUnique({
    where: { shareCodeHash: codeHash },
    select: { publicToken: true, status: true, expiresAt: true },
  })

  if (
    transfer &&
    (transfer.status === 'waiting' || transfer.status === 'active') &&
    transfer.expiresAt.getTime() > Date.now()
  ) {
    return NextResponse.json({ token: transfer.publicToken }, { status: 200 })
  }

  // Every miss counts toward the per-code lockout (brute-force protection).
  codeFailures.set(codeHash, (codeFailures.get(codeHash) ?? 0) + 1)
  return NextResponse.json({ error: 'not_found' }, { status: 404 })
}
