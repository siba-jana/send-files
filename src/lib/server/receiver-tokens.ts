import { db } from '@/lib/db'
import { hashToken, randomBase62 } from './crypto'

/**
 * Rotate the receiver capability for a transfer.
 *
 * Mints a fresh 32-char receiver token, persists ONLY its sha256 hash
 * (`Transfer.receiverTokenHash`) so the signaling service can validate
 * receiver auth straight from the DB, and returns the plaintext exactly once
 * to the caller. Every rotation invalidates any previously issued receiver
 * token for that transfer.
 *
 * Used by:
 *  - GET  /api/transfers/[token]        (non-password transfers: the share
 *    link itself is the capability, a fresh receiver token is handed out)
 *  - POST /api/transfers/[token]/unlock (password transfers: issued after a
 *    successful password verification)
 */
export async function rotateReceiverToken(publicToken: string): Promise<string> {
  const receiverToken = randomBase62(32)
  await db.transfer.update({
    where: { publicToken },
    data: { receiverTokenHash: hashToken(receiverToken) },
  })
  return receiverToken
}
