import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

/**
 * Server-side crypto helpers for ilovedoc.org (node:crypto only).
 *
 * SECURITY: never log or return password hashes, token hashes, or the pepper.
 * Only plaintext secrets created here are handed to the caller exactly once;
 * the database persists hashes only.
 */

const BASE62_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/**
 * Cryptographically random base62 string.
 * Uses rejection sampling so the modulo mapping stays unbiased.
 */
export function randomBase62(length: number): string {
  if (length <= 0) return ''
  // Byte values >= this limit would bias `byte % 62`; reject them.
  const limit = 256 - (256 % BASE62_ALPHABET.length) // 248
  const out: string[] = []
  while (out.length < length) {
    const buf = randomBytes(length * 2)
    for (let i = 0; i < buf.length && out.length < length; i++) {
      const b = buf[i]
      if (b < limit) out.push(BASE62_ALPHABET[b % BASE62_ALPHABET.length])
    }
  }
  return out.join('')
}

/**
 * 6-digit zero-padded share code, uniform over 0..999999
 * (uint32 read + rejection sampling => no modulo bias).
 */
export function generateShareCode(): string {
  const modulus = 1_000_000
  const limit = 0x1_0000_0000 - (0x1_0000_0000 % modulus) // 4_294_000_000
  for (;;) {
    const value = randomBytes(4).readUInt32BE(0)
    if (value < limit) return String(value % modulus).padStart(6, '0')
  }
}

/** SHA-256 of a UTF-8 string, hex encoded. */
export function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex')
}

/** Hash of a secret token (sender/receiver capability) — store only this. */
export function hashToken(token: string): string {
  return sha256Hex(token)
}

/** Peppered hash of the 6-digit share code (pepper from env, dev default). */
export function hashCode(code: string): string {
  return sha256Hex(
    `${code}:${process.env.CODE_PEPPER || 'ilovedoc-dev-pepper-change-me'}`
  )
}

/** scrypt password hash with a fresh random 16-byte hex salt. */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return { hash, salt }
}

/** Constant-time scrypt password verification against stored hex hash+salt. */
export function verifyPassword(
  password: string,
  hash: string,
  salt: string
): boolean {
  try {
    const expected = Buffer.from(hash, 'hex')
    if (expected.length !== 64) return false
    const actual = scryptSync(password, salt, 64)
    return timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

/** Constant-time comparison of two hex-encoded digests. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'hex')
    const bufB = Buffer.from(b, 'hex')
    if (bufA.length !== bufB.length || bufA.length === 0) return false
    return timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}
