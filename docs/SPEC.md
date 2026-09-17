# ilovedoc.org — Engineering Specification

**Product**: I Love Doc — direct browser-to-browser file transfer.
**Core principle**: file bytes travel over WebRTC DataChannels, peer-to-peer. The server only coordinates (signaling, sessions, metadata, rate limits). No permanent file storage.

```
             ┌─────────────────────────┐
             │      ilovedoc.org       │
             │  Next.js (3000) + API   │
             │  Signaling svc (3003)   │
             └────────────┬────────────┘
                          │  WSS signaling (offer/answer/ICE)
             ┌────────────┴────────────┐
             │                         │
        Sender Browser            Receiver Browser
             │                         │
             └── WebRTC DataChannel ───┘
                 (direct P2P, or TURN relay fallback)
```

## 1. Service topology & sandbox rules

| Service | Port | Tech | Role |
|---|---|---|---|
| Next.js app | 3000 | Next 16 App Router | UI + REST API (Prisma/SQLite) |
| Signaling | **3003** | Bun + socket.io (mini-service) | Rooms, offer/answer/ICE relay, limits, cleanup |

- **Only route**: `/` (src/app/page.tsx). Share links use `/?t=<publicToken>`. SEO content lives as sections + anchors on `/`.
- **Gateway rule**: browser → signaling MUST use `io('/?XTransformPort=3003', {...})`. Signaling server MUST set socket.io `path: '/'` (Caddy routes on the `XTransformPort` query param). Never write ports in URLs.
- DB file: `/home/z/my-project/db/custom.db` (SQLite, `DATABASE_URL` in `.env`).
- **SQLite storage facts (verified)**: Prisma stores `DateTime` as **epoch-ms INTEGER**; `BigInt` reads back as JS number via bun:sqlite. Expiry check in raw SQL: `expiresAt > 1000 * CAST(strftime('%s','now') AS INTEGER)`.

## 2. Database schema (already pushed — do not change)

```prisma
model Transfer {
  id                String   @id @default(cuid())
  publicToken       String   @unique   // 10 chars base62, in share link
  shareCodeHash     String   @unique   // sha256(`${code}:${CODE_PEPPER}`)
  senderTokenHash   String   @unique   // sha256(senderToken)
  receiverTokenHash String             // sha256(receiverToken)
  status            String   @default("waiting") // waiting|active|completed|cancelled|expired
  senderName        String?
  passwordHash      String?            // scrypt hex
  passwordSalt      String?
  passwordProtected Boolean  @default(false)
  maxDownloads      Int      @default(5)
  downloads         Int      @default(0)
  createdAt         DateTime @default(now())
  expiresAt         DateTime
  updatedAt         DateTime @updatedAt
  files  TransferFile[]
  events TransferEvent[]
  @@index([expiresAt]) @@index([status])
}
model TransferFile {
  id String @id @default(cuid())
  transferId String
  position Int          // 0-based order — used as fileId in the data protocol
  fileName String
  mimeType String @default("application/octet-stream")
  size BigInt
  sha256 String?
  transfer Transfer @relation(fields: [transferId], references: [id], onDelete: Cascade)
  @@index([transferId])
}
model TransferEvent {
  id String @id @default(cuid())
  transferId String
  eventType String      // created|receiver_joined|unlocked|connection|completed|cancelled|expired|state
  metadata String?      // JSON string, NO secrets/file content
  createdAt DateTime @default(now())
  transfer Transfer @relation(fields: [transferId], references: [id], onDelete: Cascade)
  @@index([transferId]) @@index([createdAt])
}
```

## 3. Security model

- **Tokens** (base62, `crypto.randomBytes`): `publicToken` 10 chars (~60 bits, in URL), `senderToken` 32 chars (~190 bits, grants sender role), `receiverToken` 32 chars (grants receiver role). Server stores only sha256 hashes.
- **Share code**: 6 digits (zero-padded), returned **once** at creation; DB stores `sha256(code + ':' + CODE_PEPPER)`. `CODE_PEPPER` from env (default `ilovedoc-dev-pepper-change-me`).
- **Password**: optional; `scryptSync(password, salt, 64)` hex + 16-byte hex salt; verify with `timingSafeEqual`. Never in URL. Unlock returns `receiverToken`.
- **Without password**: anyone holding `publicToken` (link) may receive — the link IS the capability. GET transfer returns `receiverToken` when `!passwordProtected && status ∈ {waiting, active}`.
- **Rate limits (in-memory)**: create 30/10min/IP; lookup 10/10min/IP + 20 failed attempts per codeHash → lock until expiry; unlock 10/10min/IP+token + 15 fails → transfer locked; GET 60/min/IP.
- **Expiry**: enforced server-side on every API + signaling join. Client shows countdown.
- **ICE**: `GET /api/ice` returns STUN list (Google + Cloudflare) + TURN from env (`TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL`) when set. No hard-coded credentials.

## 4. REST API contracts (Next.js route handlers)

All responses JSON. Error shape: `{ "error": "machine_code" }` (+ `"retryAfterSec"` for 429). BigInt sizes → JSON numbers.

### POST /api/transfers — create session
Body: `{ files: [{ name: string(≤255), size: int(0..1e13), mimeType?: string(≤127) }], password?: string(4..128), expiresInHours?: 1|6|24|72|168 (default 24), senderName?: string(≤40), maxDownloads?: 1..10 (default 5) }` — `files` 1..200 items.
**201**: `{ token, code, senderToken, expiresAt, files: [{ id, name, size, mimeType }] }`
- `token` = publicToken; `code` = 6 digits, plain (client displays "482 917"); `files[].id` = position (0-based, matches data-protocol fileId).
Errors: 400 `invalid_body`; 429 `rate_limited`. Logs TransferEvent `created`.

### GET /api/transfers/:token — metadata for recipient
**200** (status waiting|active): `{ status, expiresAt, senderName, passwordProtected, fileCount, totalBytes, maxDownloads, downloads, files: [{name,size,mimeType}] | null, receiverToken?: string }` — `files` is `null` when passwordProtected (names locked until unlock); `receiverToken` present only when `!passwordProtected`.
**410**: `{ error: "expired" | "cancelled" | "completed" }` (+ expiresAt when expired). **404**: `not_found`.

### POST /api/transfers/lookup — resolve 6-digit code
Body: `{ code: string }` (server strips non-digits, requires exactly 6).
**200**: `{ token }`. **404**: `not_found` (never reveal why). **429**: `rate_limited`.

### POST /api/transfers/:token/unlock — password → receiver token
Body: `{ password: string(≤128) }`.
**200**: `{ receiverToken, status, expiresAt, senderName, fileCount, totalBytes, files: [{name,size,mimeType}] }`.
**401** `invalid_password`; **410** `expired|cancelled|completed|locked`; **404** `not_found`; **429** `rate_limited`. Logs event `unlocked` (no password ever logged).

### GET /api/ice — ICE servers
**200**: `{ iceServers: [{ urls: string | string[], username?: string, credential?: string }], ttl: 300 }`

**Next 16 note**: dynamic route context is async — `{ params }: { params: Promise<{ token: string }> }`, `const { token } = await params`. Export `export const dynamic = 'force-dynamic'` on DB-backed routes. IP = first value of `x-forwarded-for` (Caddy sets it), fallback `x-real-ip`, else `unknown`.

Files (owned by API subagent): `src/app/api/transfers/route.ts`, `src/app/api/transfers/[token]/route.ts`, `src/app/api/transfers/[token]/unlock/route.ts`, `src/app/api/transfers/lookup/route.ts`, `src/app/api/ice/route.ts`, `src/lib/server/rate-limit.ts`, `src/lib/server/crypto.ts`. Use `import { db } from '@/lib/db'`. Do NOT touch anything else.

## 5. Signaling service (mini-services/signaling, port 3003)

Bun project: `package.json` (`"dev": "bun --hot index.ts"`, deps `socket.io@^4.8.3`, `zod@^4`), `index.ts`, `src/db.ts`, `src/schemas.ts`, `src/limits.ts`, `src/cleanup.ts`.

- socket.io Server: **`path: '/'`** (mandatory), `cors: { origin: '*', methods: ['GET','POST'] }`, `pingTimeout: 20000`, `pingInterval: 25000`, `maxHttpBufferSize: 200000`.
- DB: `bun:sqlite` at `process.env.DB_PATH || '/home/z/my-project/db/custom.db'`; open with `PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000`. Read-only queries + tiny UPDATEs.
- Rooms: `Map<publicToken, { sender?: socketId, receiver?: socketId }>`; each socket remembers `{ token, role }`.

### Client → server events (all use socket.io acks; ack = `{ ok: true, data? } | { ok: false, error: { code, message } }`)

1. **`transfer:join`** `{ token(≤32), role: 'sender'|'receiver', auth(≤64) }`
   - Validate via Zod. DB row by publicToken → `not_found` / expired (mark status='expired' lazily, code `expired`) / status ∉ {waiting,active} → error code = status.
   - `sha256(auth)` must equal `senderTokenHash` (role sender) or `receiverTokenHash` (role receiver), `timingSafeEqual`. Else `unauthorized`.
   - receiver: reject `completed` when `downloads >= maxDownloads`.
   - Same-role rejoin: evict previous socket (`peer:left { role, reason: 'replaced' }`).
   - Join room; if other role present, ack `data: { peers: [otherRole] }` and emit to the other socket `peer:joined { role }`. Receiver joining sets transfer status `active` + event `receiver_joined`.
2. **`signal`** `{ token, payload: { kind: 'offer'|'answer'|'ice', data: unknown } }` — must have joined `token`; size caps: offer/answer ≤ 64KB, ice ≤ 2KB, ≤ 200 ice candidates/socket/room. Forward to peer socket as **`signal`** `{ from: role, payload }`. No peer → ack error `peer_absent`.
3. **`transfer:state`** `{ token, state(≤32) }` — forward `transfer:state { from, state }` to peer; log TransferEvent `state` metadata `{state, role}` (log `connection` metadata `{kind:'direct'|'relay'}` when state is `connected-direct`/`connected-relay`).
4. **`transfer:done`** `{ token }` — receiver only. `UPDATE Transfer SET downloads = downloads + 1`; if `downloads >= maxDownloads` set `status='completed'`. Forward `transfer:done { from: 'receiver' }`. Log `completed`.
5. **`transfer:cancel`** `{ token, reason?(≤200) }` — either role. Forward `transfer:cancelled { from, reason }`; if sender → `status='cancelled'` (when waiting/active). Log `cancelled`.

### Server → client events
`signal { from, payload }`, `peer:joined { role }`, `peer:left { role, reason: 'disconnected'|'replaced' }`, `transfer:cancelled { from, reason }`, `transfer:done { from }`, `transfer:state { from, state }`.

### Limits & cleanup
- Per IP: ≤ 15 concurrent sockets, ≤ 30 connections/min. Per socket: ≤ 80 messages/10s. Room cap 200 → `server_busy`.
- Cleanup every 10 min: mark `expired` where due; delete transfers (+files/events via cascade… note: raw SQLite has no FK cascade by default — delete children explicitly) older than **7 days past expiry**.
- Log to stdout (lifecycle + errors only). Graceful SIGTERM/SIGINT.

## 6. WebRTC DataChannel protocol (v1)

Reliable + ordered channel (`pc.createDataChannel('ilovedoc', { ordered: true })`), `binaryType = 'arraybuffer'`. Every message is binary; byte 0 = type.

| Type | Hex | Direction | Encoding |
|---|---|---|---|
| TRANSFER_INIT | 0x01 | S→R | `[1][json {v, transferId, chunkSize, files:[{id,name,size,mime}]}]` |
| FILE_START | 0x02 | S→R | `[1][json {id,name,size,mime,totalChunks,chunkSize}]` |
| FILE_CHUNK | 0x03 | S→R | 23-byte header + payload (below) |
| FILE_END | 0x04 | S→R | `[1][json {id, sha256}]` |
| FILE_ACK | 0x05 | R→S | `[1][json {id, received}]` — every 128 chunks + at FILE_END |
| FILE_COMPLETE | 0x06 | R→S | `[1][json {id, verified, sha256}]` |
| TRANSFER_COMPLETE | 0x07 | S→R | `[1][json {files:[{id,sha256}]}]` |
| TRANSFER_CANCEL | 0x08 | both | `[1][json {reason}]` |
| TRANSFER_ERROR | 0x09 | both | `[1][json {code, message}]` |
| PING | 0x0A | S→R | `[1][8-byte BE uint64 epoch-ms]` every 5s |
| PONG | 0x0B | R→S | echo |
| RESUME_REQUEST | 0x0C | R→S | `[1][json {files:[{id,nextChunk}]}]` incomplete files only |
| RESUME_RESPONSE | 0x0D | S→R | `[1][json {resume, files:[{id,fromChunk}]}]` |

**FILE_CHUNK header (23 B, big-endian)**: `[0]=0x03`, `[1..2] fileId u16`, `[3..6] chunkIndex u32`, `[7..14] byteOffset u64`, `[15..18] byteLength u32`, `[19..22] crc32 (CRC-32/IEEE of payload)`, `[23..] payload`.

- **Chunk size**: `min(65536, (pc.sctp?.maxMessageSize ?? 65536) - 24)`, floor to /4, min 16384. Announced in TRANSFER_INIT.
- **Backpressure**: pause enqueue while `bufferedAmount > 8 * chunkSize` (max 8 MB); `bufferedAmountLowThreshold = 2 * chunkSize`; resume on `bufferedamountlow`. Wait `bufferedAmount === 0` before FILE_END.
- **Hashing**: incremental SHA-256 (`src/lib/transfer/sha256.ts`) over chunk payloads in order, both sides. Receiver verifies at FILE_END; mismatch → TRANSFER_ERROR `hash_mismatch`, never serve corrupt files.
- **Resume**: on reconnect + channel open, R sends RESUME_REQUEST `{id, nextChunk: chunksWritten}`; S re-hashes prefix 0..nextChunk (read-only) if needed and continues. Verified files are skipped.
- **Connection kind**: resolve via `pc.getStats()` selected candidate pair — `relay` candidate ⇒ "Secure relay", else "Direct P2P". UI must not claim direct when relayed.

## 7. Environment variables

`DATABASE_URL` (set), `CODE_PEPPER` (default dev pepper), `TURN_URL`/`TURN_USERNAME`/`TURN_CREDENTIAL` (optional), `DB_PATH` (signaling, default `/home/z/my-project/db/custom.db`), `SIGNALING_LOG` (optional).

## 8. Ownership map

- **API subagent**: files in §4.
- **Signaling subagent**: `mini-services/signaling/**`.
- **Static UI subagent**: `src/components/site/**` (header, hero, how-it-works, security, faq, footer, logo).
- **Core (me)**: `src/lib/transfer/**` (protocol, crc32, sha256, stats, browser, client-api, signaling, sinks, sender, receiver), `src/hooks/use-send.ts`, `src/hooks/use-receive.ts`, `src/components/transfer/**`, `src/app/page.tsx`, `src/app/layout.tsx`, `next.config.ts`.
