# Task 2-b — full-stack-developer (REST API)

Work record for the transfer REST API + server utilities of ilovedoc.org.
Binding contract: `docs/SPEC.md` (§2 DB schema, §3 security model, §4 REST API).
Prior work visible in `/home/z/my-project/worklog.md` (Task 1: foundation).
NOTE: sandbox root `/` is not writable, so agent records live in
`/home/z/my-project/agent-ctx/` (this file).

## Files created (sole ownership)

- `src/lib/server/crypto.ts` — randomBase62 (rejection sampling, no modulo bias),
  generateShareCode (6 zero-padded digits, unbiased uint32), sha256Hex,
  hashToken, hashCode (peppered via `CODE_PEPPER` env, dev default),
  hashPassword/verifyPassword (scryptSync, 16-byte hex salt, 64-byte key,
  timingSafeEqual), timingSafeEqualHex.
- `src/lib/server/rate-limit.ts` — in-memory fixed-window limiter
  `checkRate(key, limit, windowMs)` (counts allowed requests only; buckets on
  `globalThis` to survive dev HMR; unref'd prune interval + lazy size-guard
  pruning) and `clientIp(req)` (x-forwarded-for → x-real-ip → 'unknown').
- `src/lib/server/receiver-tokens.ts` — `rotateReceiverToken(publicToken)`:
  mints a fresh 32-char base62 receiver token, persists ONLY its sha256 in
  `Transfer.receiverTokenHash` (keeps signaling validation DB-driven), returns
  plaintext exactly once. Used by GET metadata (non-password) + unlock.
- `src/app/api/transfers/route.ts` — POST create.
- `src/app/api/transfers/[token]/route.ts` — GET metadata.
- `src/app/api/transfers/lookup/route.ts` — POST code lookup.
- `src/app/api/transfers/[token]/unlock/route.ts` — POST password unlock.
- `src/app/api/ice/route.ts` — GET ICE servers.

## Endpoint behavior (as implemented)

- **POST /api/transfers** — 30/10min/IP. Zod v4 body validation (files 1..200,
  name ≤255 sanitized: strip `/` `\` + `\p{Cc}` control chars, collapse
  whitespace, fallback `file`; size int 0..1e13; mimeType ≤127 default
  `application/octet-stream`; password 4..128; expiresInHours ∈ {1,6,24,72,168}
  default 24; senderName ≤40 trimmed, empty → null; maxDownloads 1..10 default 5).
  publicToken=base62(10), sender/receiverToken=base62(32), code=6 digits; P2002
  → regenerate + retry (≤8). Creates Transfer+TransferFile(position 0..n-1,
  BigInt size)+TransferEvent `created` `{files,totalBytes,expiresInHours,passwordProtected}`
  atomically. 201 `{token, code, senderToken, expiresAt, files:[{id,name,size,mimeType}]}`
  (code + senderToken returned exactly once).
- **GET /api/transfers/[token]** — 60/min/IP. Next16 `await params`. 404
  not_found; past-due → lazy `status='expired'` (guarded updateMany) + `expired`
  event → 410 `{error:'expired',expiresAt}`; cancelled → 410; completed or
  downloads≥maxDownloads → 410 completed. waiting|active → 200 with files
  (null when passwordProtected) + totalBytes + freshly rotated `receiverToken`
  only when !passwordProtected.
- **POST /api/transfers/lookup** — 10/10min/IP. Strips non-digits, requires
  exactly 6 (else 404). Per-code lockout: globalThis Map codeHash→fails,
  ≥20 → 404 until restart; every miss counts. Found+waiting|active+unexpired →
  200 `{token}`, else 404 not_found (never reveals why).
- **POST /api/transfers/[token]/unlock** — 10/10min/IP (stricter than or equal
  to the SPEC §3 "IP+token" wording since it also bounds per-token). Per-transfer
  failure Map publicToken→fails, ≥15 → 410 `locked` (reset on success). 404 →
  locked → expired (lazy) → cancelled → completed → verify scrypt → 401
  `invalid_password` (increments transfer failure counter; the IP counter was
  already consumed by checkRate) or 200 `{receiverToken, status, expiresAt,
  senderName, fileCount, totalBytes, files}` + `unlocked` event (no secrets).
  Non-password transfers pass trivially (link = capability).
- **GET /api/ice** — 120/min/IP. `{iceServers:[{urls:[3 STUN]}], ttl:300}` +
  TURN entry only when `TURN_URL`+`TURN_USERNAME`+`TURN_CREDENTIAL` all set
  (comma-split TURN_URL). No hard-coded credentials.
- All routes: `export const dynamic='force-dynamic'`, `runtime='nodejs'`,
  errors `{"error":code}` (+`retryAfterSec` and `Retry-After` header on 429),
  BigInt → Number, no hashes/pepper/passwords ever logged or returned.

## Verification results

- `bun run lint` — clean (exit 0).
- curl smoke tests (all passed):
  - create (3 files incl. sanitization cases) → 201, correct shape; names
    sanitized (`"report   v2  final.pdf"`→`"report v2 final.pdf"`,
    `../../etc/passwd`→`....etcpasswd`), size 9876543210 stored as INTEGER.
  - GET by token → 200 full metadata; 2nd GET returned a DIFFERENT
    receiverToken (rotation confirmed, DB hash updated — cross-checked).
  - lookup correct code → 200 `{token}`; code with spaces → 200 (strip);
    wrong codes ×3 → 404; malformed (5 digits) → 404; `{}` → 400 invalid_body.
  - password transfer: GET → `files:null`, no receiverToken key; wrong
    password → 401 invalid_password; right password → 200 + receiverToken + files.
  - GET /api/ice → 200 STUN-only (no TURN env set).
  - create validation: bad JSON / empty files / short password / bad
    expiresInHours / negative size → all 400 invalid_body.
  - unknown token GET → 404.
  - rate limit: 62 rapid GETs → 404s then 429 `{"error":"rate_limited",
    "retryAfterSec":16}` + `Retry-After: 16` header (limit reached at exactly
    60 allowed in the window incl. earlier calls).
  - lazy expiry (set expiresAt 60s in past via SQL): GET → 410 expired,
    lookup → 404, unlock → 410 expired; DB status='expired' + `expired` event.
- DB verification (bun:sqlite + Prisma scripts): only hashes stored
  (sha256(senderToken)=senderTokenHash, sha256(code:pepper)=shareCodeHash,
  sha256(unlock receiverToken)=receiverTokenHash); no plaintext
  tokens/codes/passwords anywhere; events `created`/`unlocked`/`expired` correct.
- Cleanup: both test transfers deleted via Prisma (cascade) —
  transfers/files/events all back to 0 rows.

## Deviations / decisions

- Receiver-capability model implemented per the binding "IMPORTANT correction":
  create response does NOT include receiverToken; GET (non-password) and unlock
  rotate it (fresh token, hash persisted) on every call.
- Unlock rate limit keyed per-IP only (task 2-b wording); this is strictly
  stricter than SPEC §3's "IP+token", so both are satisfied.
- `expired` lifecycle event logged on the lazy transition (guarded against
  double-writes via `updateMany` status filter) — SPEC §2 lists the event type.
- `timingSafeEqualHex` requires equal, non-empty lengths (safe for digests).
- No code touched outside the ownership list; dev server never restarted;
  `bun run build` never run.
