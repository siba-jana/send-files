import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Admin console authentication (Task 16).
 *
 * Single admin user, password from env (ADMIN_PASSWORD). Sessions are
 * stateless: an HMAC-SHA256-signed expiry timestamp in an HttpOnly cookie.
 * The signing secret comes from ADMIN_SECRET, falling back to CODE_PEPPER,
 * falling back to a dev constant (same convention as lib/server/crypto.ts).
 *
 * There is deliberately no user model — this is a single-operator console.
 */

const COOKIE_NAME = 'ilovedoc_admin'
const SESSION_TTL_MS = 12 * 3_600_000

/** Dev default password — the login screen shows a hint while it is active. */
const DEFAULT_PASSWORD = 'ilovedoc-admin'

export function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD
}

export function usingDefaultAdminPassword(): boolean {
  return !process.env.ADMIN_PASSWORD
}

function signingSecret(): string {
  return (
    process.env.ADMIN_SECRET ||
    process.env.CODE_PEPPER ||
    'ilovedoc-dev-admin-secret'
  )
}

/** Timing-safe password check (hash both sides to equalize lengths first). */
export function verifyAdminPassword(candidate: string): boolean {
  const a = createHash('sha256').update(candidate, 'utf8').digest()
  const b = createHash('sha256').update(adminPassword(), 'utf8').digest()
  return timingSafeEqual(a, b)
}

function sign(payload: string): string {
  return createHmac('sha256', signingSecret()).update(payload, 'utf8').digest('hex')
}

/** New session token: "<expiry-ms>.<hmac(expiry-ms)>". */
export function createAdminSessionToken(): string {
  const exp = Date.now() + SESSION_TTL_MS
  return `${exp}.${sign(String(exp))}`
}

export function verifyAdminSessionToken(token: string | undefined | null): boolean {
  if (!token) return false
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const expStr = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (!/^\d{1,15}$/.test(expStr) || !/^[0-9a-f]{64}$/.test(sig)) return false
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp < Date.now() || exp > Date.now() + SESSION_TTL_MS + 60_000) {
    return false
  }
  const expected = sign(expStr)
  try {
    return timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expected, 'utf8'))
  } catch {
    return false
  }
}

export function adminCookieName(): string {
  return COOKIE_NAME
}

export function adminSessionMaxAgeSec(): number {
  return Math.floor(SESSION_TTL_MS / 1000)
}

/** Read the session cookie from a Request's Cookie header. */
function readCookie(req: Request): string | undefined {
  const header = req.headers.get('cookie')
  if (!header) return undefined
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const name = part.slice(0, eq).trim()
    if (name === COOKIE_NAME) {
      const value = part.slice(eq + 1).trim()
      return value ? decodeURIComponent(value) : undefined
    }
  }
  return undefined
}

/**
 * Route guard. Returns null when the request carries a valid admin session,
 * or a ready-to-return 401 NextResponse when it does not.
 */
export function requireAdmin(
  req: Request
): { ok: true; session: { expiresAt: number } } | { ok: false; response: Response } {
  const token = readCookie(req)
  if (verifyAdminSessionToken(token)) {
    return { ok: true, session: { expiresAt: Number(token!.slice(0, token!.indexOf('.'))) } }
  }
  return {
    ok: false,
    response: new Response(
      JSON.stringify({ error: 'unauthorized' }),
      { status: 401, headers: { 'content-type': 'application/json' } }
    ),
  }
}
