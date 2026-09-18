import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/server/admin-auth'
import {
  clearErrorLogs,
  ERROR_LEVELS,
  queryErrorLogs,
  setErrorResolved,
  type ErrorLevel,
} from '@/lib/server/error-log'
import { logServerError } from '@/lib/server/error-log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function parseLevel(value: string | null): ErrorLevel | undefined {
  return ERROR_LEVELS.find((l) => l === value)
}

export async function GET(req: Request) {
  const guard = requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    const url = new URL(req.url)
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1)
    const limit = Math.min(100, Math.max(5, Number(url.searchParams.get('limit') ?? '25') || 25))
    const level = parseLevel(url.searchParams.get('level'))
    const source = (url.searchParams.get('source') ?? '').trim().slice(0, 32) || undefined
    const resolvedParam = url.searchParams.get('resolved')
    const resolved =
      resolvedParam === 'true' ? true : resolvedParam === 'false' ? false : undefined
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100)

    const { rows, total } = await queryErrorLogs({
      level,
      source,
      resolved,
      q: q || undefined,
      limit,
      offset: (page - 1) * limit,
    })

    return NextResponse.json({
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      rows,
    })
  } catch (err) {
    logServerError(err, { route: 'GET /api/admin/logs', url: req.url })
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

const patchSchema = z.object({
  id: z.union([z.string().min(1).max(64), z.literal('all-unresolved')]),
  resolved: z.boolean(),
})

export async function PATCH(req: Request) {
  const guard = requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
    }
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
    }

    const updated = await setErrorResolved(parsed.data.id, parsed.data.resolved)
    return NextResponse.json({ ok: true, updated })
  } catch (err) {
    logServerError(err, { route: 'PATCH /api/admin/logs', url: req.url })
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const guard = requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    const url = new URL(req.url)
    const scope = url.searchParams.get('scope') === 'all' ? 'all' : 'resolved'
    const deleted = await clearErrorLogs(scope)
    return NextResponse.json({ ok: true, deleted, scope })
  } catch (err) {
    logServerError(err, { route: 'DELETE /api/admin/logs', url: req.url })
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
