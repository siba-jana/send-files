import { NextResponse } from 'next/server'
import { requireAdmin, usingDefaultAdminPassword } from '@/lib/server/admin-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const guard = requireAdmin(req)
  return NextResponse.json({
    authenticated: guard.ok,
    usingDefaultPassword: usingDefaultAdminPassword(),
    session: guard.ok ? { expiresAt: guard.session.expiresAt } : null,
  })
}
