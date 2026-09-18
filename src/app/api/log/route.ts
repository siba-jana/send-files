import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRate, clientIp } from '@/lib/server/rate-limit'
import {
  ERROR_LEVELS,
  insertErrorLog,
  sanitizeText,
} from '@/lib/server/error-log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Public client-side error ingestion (Task 16).
 *
 * Called by the app's error boundaries (error.tsx / global-error.tsx).
 * Heavily rate-limited and sanitized: level whitelisted, source forced to
 * "client", every string capped. Always answers 200 on valid input so the
 * endpoint can't be used to probe; rejects are generic 400s.
 */

const bodySchema = z.object({
  level: z.enum(['error', 'warn', 'info']),
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional(),
  url: z.string().max(500).optional(),
  userAgent: z.string().max(400).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(req: Request) {
  const rl = checkRate(`clientlog:${clientIp(req)}`, 12, 60 * 1000)
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

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const ip = clientIp(req)
  await insertErrorLog({
    level: parsed.data.level as (typeof ERROR_LEVELS)[number],
    source: 'client',
    message: sanitizeText(parsed.data.message, 2000) ?? '(empty message)',
    stack: sanitizeText(parsed.data.stack, 8000),
    url: sanitizeText(parsed.data.url, 500),
    userAgent: sanitizeText(parsed.data.userAgent, 400),
    ip,
    context: {
      ...parsed.data.context,
      ip,
    },
  })

  return NextResponse.json({ ok: true })
}
