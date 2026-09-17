import { NextResponse } from 'next/server'
import { checkRate, clientIp } from '@/lib/server/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Public STUN servers (no credentials needed). */
const STUN_URLS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun.cloudflare.com:3478',
]

interface IceServer {
  urls: string[]
  username?: string
  credential?: string
}

export async function GET(req: Request) {
  // Generous limit: 120 requests / min / IP (clients refresh every ttl secs).
  const rl = checkRate(`ice:${clientIp(req)}`, 120, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const iceServers: IceServer[] = [{ urls: STUN_URLS }]

  // TURN relay is opt-in via env — never ship hard-coded credentials.
  const turnUrls = (process.env.TURN_URL ?? '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)
  const turnUsername = process.env.TURN_USERNAME?.trim() ?? ''
  const turnCredential = process.env.TURN_CREDENTIAL?.trim() ?? ''

  if (turnUrls.length > 0 && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrls,
      username: turnUsername,
      credential: turnCredential,
    })
  }

  return NextResponse.json({ iceServers, ttl: 300 })
}
