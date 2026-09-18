import { NextResponse } from 'next/server'
import { adminCookieName } from '@/lib/server/admin-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(adminCookieName(), '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return res
}
