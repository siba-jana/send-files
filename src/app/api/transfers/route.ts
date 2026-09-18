import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  generateShareCode,
  hashCode,
  hashPassword,
  hashToken,
  randomBase62,
} from '@/lib/server/crypto'
import { checkRate, clientIp } from '@/lib/server/rate-limit'
import { logServerError } from '@/lib/server/error-log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_FILE_BYTES = 1e13 // 10 TB per file

const fileSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().min(0).max(MAX_FILE_BYTES),
  mimeType: z.string().max(127).optional(),
})

const createSchema = z.object({
  files: z.array(fileSchema).min(1).max(200),
  password: z.string().min(4).max(128).optional(),
  expiresInHours: z
    .union([
      z.literal(1),
      z.literal(6),
      z.literal(24),
      z.literal(72),
      z.literal(168),
    ])
    .optional(),
  senderName: z.string().max(40).optional(),
  maxDownloads: z.number().int().min(1).max(10).optional(),
})

/** Strip path separators + control chars, collapse whitespace, cap length. */
function sanitizeFileName(raw: string): string {
  const name = raw
    .replace(/[/\\]/g, '') // path separators
    .replace(/\p{Cc}/gu, '') // control characters (C0 + DEL)
    .replace(/\s+/g, ' ') // collapse whitespace runs
    .trim()
    .slice(0, 255)
  return name.length > 0 ? name : 'file'
}

/** Prisma unique-constraint violation (retryable with fresh random values). */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'P2002'
  )
}

export async function POST(req: Request) {
  // Rate limit first: 30 creates / 10 min / IP.
  const rl = checkRate(`create:${clientIp(req)}`, 30, 10 * 60 * 1000)
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

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  const input = parsed.data

  const expiresInHours = input.expiresInHours ?? 24
  const maxDownloads = input.maxDownloads ?? 5
  const senderName = (input.senderName ?? '').trim().slice(0, 40)
  const passwordHashData = input.password ? hashPassword(input.password) : null

  // Sanitized file rows; `position` preserves the client's order (0-based,
  // doubles as the fileId used in the binary data protocol).
  const files = input.files.map((file, index) => ({
    position: index,
    fileName: sanitizeFileName(file.name),
    mimeType: file.mimeType?.trim() || 'application/octet-stream',
    size: BigInt(file.size),
  }))
  const totalBytes = files.reduce((acc, file) => acc + file.size, BigInt(0))

  // Retry loop: astronomically unlikely token collisions + share-code space
  // (10^6) make P2002 possible; regenerate everything and retry.
  for (let attempt = 0; attempt < 8; attempt++) {
    const publicToken = randomBase62(10)
    const senderToken = randomBase62(32)
    // Initial receiver token: plaintext is intentionally never returned —
    // non-password flows rotate it on the first GET, password flows on unlock.
    const receiverToken = randomBase62(32)
    const code = generateShareCode()
    const expiresAt = new Date(Date.now() + expiresInHours * 3_600_000)

    try {
      const transfer = await db.transfer.create({
        data: {
          publicToken,
          shareCodeHash: hashCode(code),
          senderTokenHash: hashToken(senderToken),
          receiverTokenHash: hashToken(receiverToken),
          status: 'waiting',
          senderName: senderName.length > 0 ? senderName : null,
          passwordHash: passwordHashData?.hash ?? null,
          passwordSalt: passwordHashData?.salt ?? null,
          passwordProtected: passwordHashData !== null,
          maxDownloads,
          downloads: 0,
          expiresAt,
          files: { create: files },
          events: {
            create: {
              eventType: 'created',
              metadata: JSON.stringify({
                files: files.length,
                totalBytes: Number(totalBytes),
                expiresInHours,
                passwordProtected: passwordHashData !== null,
              }),
            },
          },
        },
        include: { files: true },
      })

      // Plain `code` + `senderToken` are returned EXACTLY ONCE, here.
      return NextResponse.json(
        {
          token: transfer.publicToken,
          code,
          senderToken,
          expiresAt: transfer.expiresAt.toISOString(),
          files: transfer.files
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((file) => ({
              id: file.position,
              name: file.fileName,
              size: Number(file.size),
              mimeType: file.mimeType,
            })),
        },
        { status: 201 }
      )
    } catch (err) {
      if (isUniqueViolation(err)) continue // regenerate token/code, retry
      console.error(
        'create transfer failed:',
        err instanceof Error ? err.message : err
      )
      logServerError(err, { route: 'POST /api/transfers', url: req.url })
      return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    }
  }

  console.error('create transfer: exhausted unique-value generation attempts')
  logServerError('exhausted unique-value generation attempts', {
    route: 'POST /api/transfers',
    url: req.url,
  })
  return NextResponse.json({ error: 'internal_error' }, { status: 500 })
}
