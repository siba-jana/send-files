import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRate, clientIp } from '@/lib/server/rate-limit'
import {
  adminCookieName,
  adminSessionMaxAgeSec,
  createAdminSessionToken,
  usingDefaultAdminCredentials,
  verifyAdminCredentials,
} from '@/lib/server/admin-auth'
import { insertErrorLog } from '@/lib/server/error-log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const loginSchema = z.object({
  username: z.string().min(1).max(256).default('admin'),
  password: z.string().min(1).max(256),
})

/** 5 attempts / 15 min / IP — brute-force protection. */
const LOGIN_RATE = { limit: 5, windowMs: 15 * 60 * 1000 }

export async function POST(req: Request) {
  const ip = clientIp(req)
  const rl = checkRate(`admin-login:${ip}`, LOGIN_RATE.limit, LOGIN_RATE.windowMs)
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

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  if (!verifyAdminCredentials(parsed.data.username, parsed.data.password)) {
    await insertErrorLog({
      level: 'warn',
      source: 'admin',
      message: 'Failed admin login attempt',
      ip,
      url: '/admin',
      context: { reason: 'bad_credentials', username: parsed.data.username },
    })
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 })
  }

  await insertErrorLog({
    level: 'info',
    source: 'admin',
    message: 'Admin signed in',
    ip,
    url: '/admin',
    context: { username: parsed.data.username },
  })

  const res = NextResponse.json({
    ok: true,
    usingDefaultPassword: usingDefaultAdminCredentials(),
  })
  res.cookies.set(adminCookieName(), createAdminSessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: adminSessionMaxAgeSec(),
    secure: process.env.NODE_ENV === 'production',
  })
  return res
}
