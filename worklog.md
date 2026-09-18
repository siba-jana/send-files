# ilovedoc.org — Project Worklog

Shared handover document for all agents. Append sections with `---` separators; never overwrite.

---
Task ID: 1
Agent: main (Z.ai Code)
Task: Foundation for ilovedoc.org — P2P browser-to-browser file transfer platform

Work Log:
- Explored scaffold: Next 16 App Router, Tailwind 4, shadcn/ui (full set), Prisma 6 + SQLite at `db/custom.db`, zod v4, next-themes, sonner, framer-motion available. Dev server already running on port 3000 (dev.log).
- Installed `socket.io-client`, `qrcode`, `@types/qrcode`.
- Verified via bun:sqlite probe: Prisma stores DateTime as **epoch-ms INTEGER** in SQLite; BigInt columns read back as numbers. Signaling raw SQL must use `expiresAt > 1000 * CAST(strftime('%s','now') AS INTEGER)`.
- Wrote full engineering contract at `docs/SPEC.md` (REST API, signaling protocol, binary DataChannel protocol, security model, ownership map). ALL agents must follow it.
- Pushed Prisma schema (Transfer / TransferFile / TransferEvent — metadata only, no file content).

Stage Summary:
- Architecture: Next.js `/` single page (share links are `/?t=<token>` due to sandbox single-route rule) + REST API under `/api/*` + socket.io signaling mini-service on port 3003 (`path: '/'`, client `io('/?XTransformPort=3003')`).
- Design language: rose-600 primary / slate neutrals, NO indigo/blue, Geist font, rounded-2xl cards, light+dark via next-themes, sticky footer via `min-h-screen flex flex-col` + `mt-auto`.
- In flight: Task 2-a signaling service (subagent), Task 2-b REST API (subagent), Task 2-c static UI sections (subagent), then core WebRTC engine (me).

---
Task ID: 2-b
Agent: full-stack-developer (REST API)
Task: Transfer REST API routes + server utilities

Work Log:
- Read worklog + SPEC (§2/§3/§4 binding). Confirmed empty DB, zod v4, dev server healthy.
- Built `src/lib/server/crypto.ts`: randomBase62 + generateShareCode (rejection sampling, no modulo bias), sha256Hex, hashToken, hashCode (CODE_PEPPER env, dev default), scrypt hash/verify (16B hex salt, 64B key, timingSafeEqual), timingSafeEqualHex.
- Built `src/lib/server/rate-limit.ts`: fixed-window `checkRate` (globalThis-persisted buckets survive HMR, unref'd prune interval + lazy size-guard pruning, only allowed requests count) + `clientIp` (x-forwarded-for → x-real-ip → unknown).
- Built `src/lib/server/receiver-tokens.ts`: `rotateReceiverToken(publicToken)` — mints fresh 32-char receiver token, persists only sha256 in `Transfer.receiverTokenHash` (signaling validates against DB), returns plaintext once. Implements the binding receiver-capability correction: create does NOT return receiverToken; GET (non-password) + unlock rotate it on every call.
- POST /api/transfers: 30/10min/IP; zod validation (files 1..200, name≤255 sanitized — strip path separators/control chars, collapse whitespace, fallback "file"; size int 0..1e13; mimeType≤127 default octet-stream; password 4..128; expiresInHours 1|6|24|72|168 default 24; senderName≤40 trimmed, empty→null; maxDownloads 1..10 default 5); base62 tokens + 6-digit code with P2002 retry; atomic Transfer+files(position 0..n-1, BigInt)+`created` event; 201 `{token, code, senderToken, expiresAt, files:[{id,name,size,mimeType}]}`.
- GET /api/transfers/[token]: 60/min/IP; await params (Next 16); 404 → lazy-expired 410 (+`expired` event, guarded updateMany) → cancelled 410 → completed 410 (incl. downloads≥maxDownloads) → 200 `{status, expiresAt, senderName, passwordProtected, fileCount, totalBytes, maxDownloads, downloads, files|null, receiverToken?}` (files null when password-protected; receiverToken rotated when not).
- POST /api/transfers/lookup: 10/10min/IP; strip non-digits, require exactly 6; per-code lockout Map (codeHash→fails, ≥20 → 404 until restart, every miss counts); 200 `{token}` or 404 not_found (never reveals why).
- POST /api/transfers/[token]/unlock: 10/10min/IP; per-transfer failure Map (≥15 → 410 locked, reset on success); 404 → locked → expired → cancelled → completed → scrypt verify → 401 invalid_password or 200 `{receiverToken, status, expiresAt, senderName, fileCount, totalBytes, files}` + `unlocked` event; non-password transfers pass trivially (link = capability).
- GET /api/ice: 120/min/IP; 3 STUN urls; TURN entry only when TURN_URL+TURN_USERNAME+TURN_CREDENTIAL all set (no hard-coded credentials); `{iceServers, ttl:300}`.
- All routes: `dynamic='force-dynamic'`, `runtime='nodejs'`, error shape `{error}` (+retryAfterSec & Retry-After on 429), BigInt→Number, secrets never logged/returned.
- Verified: `bun run lint` clean; dev.log shows routes compiling/serving with no errors. curl smoke tests: create 201 (sanitization + >32-bit size ok), GET 200 (2nd GET returns rotated receiverToken), lookup ok/spaces/wrong×3/malformed, password flow (GET files:null → 401 → 200), ice 200, invalid-body 400s, 429 after 60 GETs/min with retryAfterSec, lazy expiry 410 on GET/unlock + 404 lookup. DB cross-checks: all stored values are hashes (sha256 matches returned plaintexts), events correct. Deleted all test rows (tables back to 0). Full record: `agent-ctx/2-b-full-stack-developer.md`.

Stage Summary:
- Files created (8): src/lib/server/crypto.ts, src/lib/server/rate-limit.ts, src/lib/server/receiver-tokens.ts, src/app/api/transfers/route.ts, src/app/api/transfers/[token]/route.ts, src/app/api/transfers/lookup/route.ts, src/app/api/transfers/[token]/unlock/route.ts, src/app/api/ice/route.ts (+ agent-ctx/2-b-full-stack-developer.md record).
- Endpoints live: POST /api/transfers (create, 201), GET /api/transfers/[token] (metadata + receiver token rotation), POST /api/transfers/lookup (code → token, brute-force lockout), POST /api/transfers/[token]/unlock (password → receiver token, 15-fail lockout), GET /api/ice (STUN/TURN).
- Verification: lint clean; every endpoint curl-tested incl. 429 rate limiting, lazy expiry (410), sanitization, hash-only storage; DB cleaned to zero rows. Dev server untouched (no restart/build).
- Deviations: none material — unlock rate limit keyed per-IP (stricter than or equal to SPEC §3 "IP+token"); `expired` lifecycle event logged on lazy transition; agent work records live in /home/z/my-project/agent-ctx/ because sandbox root / is read-only.

---
Task ID: 2-c
Agent: frontend-styling-expert (static UI)
Task: Static site sections (header/hero/how-it-works/security/faq/footer/logo)

Work Log:
- Read worklog + SPEC §8; inspected scaffold (globals.css primary is neutral black/white, layout.tsx has `suppressHydrationWarning`, dev server healthy). Design decision: use explicit `rose-600`/`dark:rose-500` classes (not `bg-primary`) so the mandated rose brand renders regardless of globals.css state.
- Built `src/components/site/logo.tsx`: original inline SVG mark (document + folded corner + filled rose heart) + "I Love Doc" wordmark with "Doc" in rose; props `className` / `markOnly`; crisp 16–40px.
- Built `header.tsx` (client): sticky h-16, `bg-background/80 backdrop-blur-md`, border-b; logo → `#top`; desktop nav (Send/How it works/Security/FAQ); "Send Files" sm button + theme toggle; mobile hamburger dropdown (min-h-11 targets, Escape closes). CTA dispatches `window.dispatchEvent(new CustomEvent('ilovedoc:mode', { detail: 'send' }))` then offset smooth-scrolls to `#transfer`. Theme toggle cycles `document.documentElement.classList` dark/light + `style.colorScheme`, persists to localStorage `theme`, initializes from localStorage/media-query in useEffect (no hydration mismatch; Sun/Moon crossfade is pure CSS via `dark:` variants).
- Built `hero.tsx` (client): id="top", rose pill badge (Sparkles, "No permanent cloud storage"), H1 with "browser to browser" in rose, sub, Send/Receive CTAs (h-12, both dispatch `ilovedoc:mode` + scroll), 4-item trust row (ShieldCheck/ArrowLeftRight/Clock/BadgeCheck), CSS-only background (rose radial glow + masked dotted grid, light+dark), and an aria-hidden SVG illustration: two browser windows + animated dashed path + rose heart hub + heart-branded file traveling sender→receiver (framer-motion, disabled under prefers-reduced-motion).
- Built `how-it-works.tsx` (client): 4 numbered step cards (FolderUp/Share2/Network/BadgeCheck) in responsive grid + pure-SVG connection diagram (role="img" + aria-label): sender⇄receiver direct encrypted path with rose lock badge vs dashed relay fallback path through "Secure relay" node; horizontally scrollable on mobile.
- Built `security-section.tsx` (client): "Privacy by design" + 6 feature cards (Lock/HardDrive/Eye/FileCheck2/Timer/UserX) on a `bg-muted/30 border-y` band + honest relay-fallback note.
- Built `faq.tsx` (server): 10 Q&As in shadcn Accordion (single collapsible) inside a rounded-2xl card; honest answers per spec.
- Built `footer.tsx` (server): `mt-auto border-t bg-muted/30`; logo + tagline + inline anchor links; © year + honesty line; compact on mobile.
- Accessibility: semantic header/section/footer, aria-labels on icon buttons/navs, `aria-labelledby` headings, focus-visible rings, ≥44px touch targets on mobile (h-11/h-12/min-h-11), `MotionConfig reducedMotion="user"` + `useReducedMotion` gating, all decorative SVG aria-hidden.
- Verified: `bun run lint` fully clean; `bunx tsc --noEmit` → 0 errors in components/site (4 pre-existing errors elsewhere: examples/, skills/, api route BigInt target — not mine); compiled CSS via @tailwindcss/cli to confirm every arbitrary utility (radial gradients, mask-image, dotted grid, min-w-[620px], fill-/stroke- theme colors, dark: variants) generates correctly.

Stage Summary:
- Files created (7) in `src/components/site/`: logo.tsx, header.tsx, hero.tsx, how-it-works.tsx, security-section.tsx, faq.tsx, footer.tsx. No files touched outside that directory.
- Exports for page assembly: `Logo` (props className/markOnly), `SiteHeader`, `Hero`, `HowItWorks`, `SecuritySection`, `Faq`, `Footer`. Suggested order: SiteHeader → Hero → [transfer widget, id="transfer"] → HowItWorks → SecuritySection → Faq → Footer.
- Integration contract: CTAs dispatch `ilovedoc:mode` (detail "send"|"receive") before scrolling to `#transfer`; theme = `.dark` class on <html> + localStorage `theme` (no next-themes — do not wire ThemeProvider); brand color comes from explicit rose-600/rose-500 classes, not `--primary`.
- Lint status: clean (whole repo). Typecheck: clean for all 7 files.

---
Task ID: 2-a
Agent: full-stack-developer (signaling) + main (verification)
Task: Build socket.io signaling mini-service on port 3003

Work Log:
- Subagent created mini-services/signaling/ (package.json with `bun --hot index.ts`, index.ts, src/{db,schemas,limits,cleanup,log}.ts), installed socket.io@4.8.3 + zod@4, started it once (timed out before finishing verification/worklog).
- Main agent reviewed all code against SPEC §5 — complete and correct: path '/' mandatory, epoch-ms expiry SQL, timingSafeEqual token auth, room model with same-role eviction, Zod validation of every event, per-IP + per-socket rate limits, room cap 200, 10-min cleanup job (expire + 7-day retention delete with explicit child deletes), TransferEvent audit logging (no secrets).
- Restarted service as single background instance (dupes killed): `cd mini-services/signaling && nohup bun run dev > signaling.log 2>&1 &`.
- Ran end-to-end smoke test (throwaway script): REST create → GET (receiverToken rotation) → sender+receiver socket.io join → bad-auth rejected `unauthorized` → receiver join ack `peers:["sender"]` + sender got `peer:joined` → offer signal routed → cancel routed → DB cleanup. ALL PASSED. (Note: initial "hang" was a test-script listener race, not a server bug.)
- Cleaned all test rows from DB.

Stage Summary:
- Signaling service RUNNING on 3003 (log: mini-services/signaling/signaling.log). Restart with: `cd /home/z/my-project/mini-services/signaling && nohup bun run dev > signaling.log 2>&1 &`
- Backend stack now fully operational: REST API (2-b) + signaling (2-a) + shared SQLite DB.
- Static UI sections done (2-c): src/components/site/{logo,header,hero,how-it-works,security-section,faq,footer}.tsx — integration contract: CTAs dispatch `ilovedoc:mode` CustomEvent (detail 'send'|'receive') + scroll to #transfer; theme = .dark class + localStorage 'theme'; explicit rose-600/rose-500 classes.
- Next: Task 3 (main agent) — WebRTC transfer engine + hooks in src/lib/transfer/.

---
Task ID: 3
Agent: main (Z.ai Code)
Task: WebRTC transfer engine + React hooks (core P2P machinery)

Work Log:
- src/lib/transfer/protocol.ts: binary v1 protocol — 13 message types, 23-byte big-endian FILE_CHUNK header (fileId u16, chunkIndex u32, byteOffset u64, byteLength u32, crc32 u32), JSON control messages as [type][utf8], PING/PONG with u64 timestamps, chunk-size negotiation from pc.sctp.maxMessageSize (verified: 262144→65536, 65536→65512).
- src/lib/transfer/sha256.ts: pure-TS incremental SHA-256 (streaming, no full-file memory). Verified against node:crypto for sizes 0..1,000,000 incl. 55/56/63/64/65 block boundaries + known vectors.
- src/lib/transfer/crc32.ts: CRC-32/IEEE table impl (vector 0xCBF43926 verified).
- src/lib/transfer/stats.ts: SpeedTracker sliding window + formatBytes/formatSpeed/formatEta (real values only).
- src/lib/transfer/browser.ts: capability detection (WebRTC, File System Access, dir picker, touch).
- src/lib/transfer/client-api.ts: typed REST client + ApiError with human messages.
- src/lib/transfer/signaling.ts: SignalingClient — dynamic socket.io import, io('/?XTransformPort=3003'), auto re-join room after socket.io reconnection, typed acks.
- src/lib/transfer/sinks.ts: MemorySink (Blob parts) + FileSystemSink (streams to disk via File System Access pickers, user-gesture-safe), sanitize/unique naming.
- src/lib/transfer/sender.ts: TransferSender — offer side, per-generation RTCPeerConnection, 64KB chunk streaming with bufferedAmount backpressure (512KB low / 4MB high water + event+poll drain), incremental hashing on send, FILE_ACK tracking, uniform RESUME_REQUEST handshake (fresh receiver = all nextChunk 0), rehash-prefix on resume, heartbeat PING/PONG 5s/16s, connection-kind probe via getStats (direct vs relay, reported honestly), reconnect machinery driven by receiver re-join, MAX 6 reconnects, generation guards everywhere.
- src/lib/transfer/receiver.ts: TransferReceiver — answer side, per-chunk CRC validation + strict order check, sink writes, incremental hash, SHA-256 verify at FILE_END (mismatch → TRANSFER_ERROR hash_mismatch, never serves corrupt files), ACK every 128 chunks, RESUME_REQUEST from chunksWritten, silence watchdog 22s, reconnect via room re-join.
- src/hooks/use-send.ts + use-receive.ts: React state machines (phases, files, options, expiry watchdogs, beforeunload guards, URL param handling helpers, download helpers with URL lifecycle).
- Fixed 3 reconnect edge-case bugs found in self-review (loop unwind deadlock, stale waiter, stale resume timeout), BigInt literal, File System Access typings, tsconfig excludes for mini-services/examples/skills/tests.
- tsc --noEmit: CLEAN. eslint: CLEAN.

Stage Summary:
- HOOK APIs for the UI (Task 4 must consume these EXACTLY):
  - useSendTransfer() → { supported, files[{key,file}], totalBytes, options{usePassword,password,expiresInHours,senderName,maxDownloads}, phase: idle|ready|creating|waiting|connecting|transferring|reconnecting|completed|cancelled|failed|expired, info{token,code,senderToken,expiresAt,files[]}|null, progress: SenderState|null, error, shareLink, addFiles(FileList|File[]), removeFile(key), clearFiles(), setOption(k,v), create(), cancel(reason?), reset() }
  - SenderState = { phase, error, connectionKind: direct|relay|unknown, files[{fileId,name,size,transferred,status:pending|active|done|verified|error}], totalBytes, transferredBytes, speedBps|null, etaSeconds|null }
  - useReceiveTransfer() → { supported, fsSupported, phase: idle|resolving|confirm|unlocking|connecting|transferring|reconnecting|completed|cancelled|failed, meta{token,expiresAt,senderName,passwordProtected,fileCount,totalBytes,files[]|null}|null, progress: ReceiverState|null, error, unlocked, saveMode, startByToken(t), startByCode(code), submitPassword(pw), accept(preferDisk:boolean)=>Promise<boolean> (MUST be called directly in click handler), decline(), cancel(reason?), reset(), downloadFile(item), downloadAll(items) }
  - ReceiverState = like SenderState + results[{name,size,sha256,savedToDisk,blob?}]|null
  - helpers exported: normalizeCode('482-917'→'482917'), extractToken(urlOrToken)
- Formatting helpers: formatBytes/formatSpeed/formatEta from '@/lib/transfer/stats'.
- Next: Task 4 UI panels (subagent) → Task 5 page assembly + browser E2E.

---
Task ID: 4
Agent: full-stack-developer (transfer UI)
Task: Transfer flow UI panels wired to hooks

Work Log:
- Read worklog (Task 3 hook contracts) + SPEC, inspected hooks (use-send/use-receive), engine state types (SenderState/ReceiverState/FileProgressInfo), stats helpers, all shadcn/ui primitives, and site design language (rose-600/slate, rounded-2xl, .dark class theme).
- Built src/components/transfer/file-icon.tsx: name+mime classifier (ext table + mime-prefix fallback) → FileText/FileImage/FileVideo/FileAudio/FileArchive/FileCode/FileSpreadsheet/Presentation/File with muted non-blue colors, light+dark variants.
- Built connection-badge.tsx: direct → emerald "Direct P2P" (Zap), relay → amber "Secure relay" (Shield) with honest tooltip copy, unknown → muted "Connecting…" spinner; tooltips via shadcn Tooltip.
- Built progress-panel.tsx: shared live progress (overall % + bytes + big Progress bar + speed/ETA only when real, per-file rows with mini bars + Waiting/%/Sent|Received/Verified/Error states, ConnectionBadge header, max-h-72 custom-scrollbar lists) + exported ConnectionSteps (animated connecting checklist, aria-hidden, cycling heartbeat). Progress bars restyled to rose/emerald/destructive via data-slot arbitrary variants; Radix provides role=progressbar + aria-valuenow.
- Built qr-dialog.tsx (default export for next/dynamic): lazy `(await import('qrcode')).default.toDataURL(url, {margin:2, width:480, color:{dark:'#0f172a', light:'#ffffff'}})` in useEffect with cancel guard, loading + error states, img alt "QR code for the transfer link", caption "Scan to receive files", Download QR anchor + Close (DialogClose).
- Built send-panel.tsx: full sender flow — DropZone (dashed, drag-over rose glow, Select Files/Folder via focusable buttons + sr-only inputs, webkitdirectory set via ref, folder button hidden where unsupported), file list with remove/clear + footer totals + 8GB amber warning, Collapsible options (password switch + input w/ min-4 validation, expiry select 1h/6h/24h/3d/7d, sender name, max downloads 1-10), Create Transfer (rose lg, spinner while creating), waiting card (pulsing dot, "482 917" code display, share-link readonly input + copy, Copy Link/Copy Code/Show QR/Cancel, keep-tab-open note, live expiry countdown), connecting card + steps, transferring/reconnecting (amber banner + ProgressPanel + cancel), completed (SHA-256 verified ✓), cancelled/failed(expired) state cards with reset, unsupported-browser blocking alert. Clipboard helper with execCommand fallback + sonner toasts.
- Built receive-panel.tsx: idle (big 6-digit code input — tracking-[0.5em] tabular-nums, digit normalize on change + paste, Enter submits; Receive Files button; "or" divider; link input via extractToken; notes), resolving spinner, confirm/unlocking (sender line, file rows or locked summary when files===null, total + expiry countdown, password form → submitPassword with inline error, save-to-disk switch when fsSupported (default on), Accept Files onClick calls void accept(disk? saveToDisk : false) directly with nothing awaited before it, Back → decline), connecting steps, transferring/reconnecting (banner + ProgressPanel + Stop Receiving), completed (per-file rows: SHA-256 verified ✓ with short-hash Tooltip + full-hash title attr, "Saved to disk" badge or per-file Download + Download All from progress.results, Receive More Files), cancelled/failed cards, unsupported alert. Exposes ReceiveControllerApi {startByToken, startByCode} to the widget via registerController prop (single hook instance lives in the panel).
- Built transfer-widget.tsx: section id="transfer" scroll-mt-24, h2 + sub, shadcn Tabs (Send/Receive, h-13 list, ≥44px triggers) with BOTH TabsContent forceMount (+ data-[state=inactive]:hidden belt-and-braces) so active transfers survive tab switches; listens for window 'ilovedoc:mode' CustomEvent (send|receive); on mount (once, ref-guarded) reads URLSearchParams — ?t=<token> (validated ^[A-Za-z0-9]{6,32}$) → startByToken, ?code=<6 digits> → startByCode, switching to receive via the same ilovedoc:mode channel + smooth scroll; mounts sonner <Toaster richColors position="top-center /> whose theme tracks the manual .dark class via useSyncExternalStore+MutationObserver; sr-only aria-live mode announcement.
- Hydration-safety: all browser-capability gating (webrtc/fs/webkitdirectory/dark class) reads via useSyncExternalStore with server snapshots; countdowns start null. No setState-in-effect (repo eslint rule react-hooks/set-state-in-effect) — restructured all probes/counters accordingly; lucide 0.525 uses new names (LoaderCircle/CircleCheckBig/TriangleAlert/CloudUpload/CircleX).
- Verified: react-dom/server renderToString smoke test of TransferWidget (both panels present in HTML, #transfer section, dropzone + code input); bun run lint CLEAN; bunx tsc --noEmit CLEAN; dev.log shows no new errors (only pre-existing Geist font-download warnings from layout.tsx).

Stage Summary:
- Files created (7), all in src/components/transfer/: transfer-widget.tsx, send-panel.tsx, receive-panel.tsx, progress-panel.tsx, connection-badge.tsx, qr-dialog.tsx, file-icon.tsx. Nothing outside that directory touched (page.tsx/layout.tsx/globals.css/hooks/lib untouched).
- Exports: TransferWidget (props: className?) — renders <section id="transfer" class="scroll-mt-24 …"> with Tabs + Toaster; SendPanel () and ReceivePanel (props: registerController?: (api: ReceiveControllerApi) => void, ReceiveControllerApi = { startByToken(token), startByCode(code) }); ProgressPanel (props: progress: SenderState | ReceiverState, variant: 'sending' | 'receiving', className?); ConnectionSteps (props: steps: readonly string[], className?) from progress-panel.tsx; ConnectionBadge (props: kind: 'direct' | 'relay' | 'unknown', className?); FileIcon (props: name, mimeType?, className?); QrDialog default export (props: open, onOpenChange, url) for next/dynamic ssr:false.
- Widget wiring: hero/header CTAs dispatch 'ilovedoc:mode' → widget switches tabs; URL params on mount (?t= → startByToken, ?code= → startByCode) switch to receive + scroll; both panels always mounted (forceMount) so transfers survive tab switches; sonner Toaster mounted once in widget, theme follows .dark class.
- Lint: CLEAN (whole repo). tsc --noEmit: CLEAN. SSR smoke test passed. Design: rose-600/dark:rose-500 primaries, slate neutrals, rounded-2xl cards, ≥44px touch targets, aria labels/live regions/progressbars, light+dark verified via classes.
- Ready for Task 5 (page assembly): import { TransferWidget } from '@/components/transfer/transfer-widget' and place as <TransferWidget /> between Hero and HowItWorks (it carries its own id="transfer" + scroll-mt-24 + heading).

---
Task ID: 5
Agent: main (Z.ai Code)
Task: Page assembly, security headers, and full browser E2E verification

Work Log:
- Assembled src/app/page.tsx: SiteHeader → Hero → TransferWidget → HowItWorks → SecuritySection → Faq → Footer inside `min-h-screen flex flex-col` (footer mt-auto, flex-1 main). generateMetadata returns robots noindex/nofollow/noarchive for `?t=`/`?code=` transfer URLs (verified in HTML output).
- Rewrote src/app/layout.tsx: full brand metadata (title template, description, keywords, OG/Twitter, metadataBase https://ilovedoc.org), viewport with themeColor, pre-paint theme bootstrap script (matches header's .dark + localStorage mechanism).
- next.config.ts: security headers on all routes — CSP (self + ws/wss + blob, dev-compatible), X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS. Deliberately NO X-Frame-Options/frame-ancestors restrictions so the sandbox preview iframe works.
- Added src/app/icon.svg (rose doc + heart favicon, served at /icon.svg).
- E2E VERIFIED with agent-browser through the Caddy gateway (http://localhost:81 — direct :3000 bypasses XTransformPort routing):
  * Small multi-file transfer (3 files incl. unicode name + 0-byte edge case): BOTH sides complete, all SHA-256 verified ✓
  * 500MB single-file transfer: completed end-to-end (~4.5MB/s, live progress/speed/ETA, Direct P2P badge, ~7600 chunks) — memory mode stayed bounded
  * Code-entry flow: receiver joined via 6-digit code ✓
  * Password flow: names locked before unlock, wrong password rejected, correct password unlocks + transfer completes ✓
  * QR dialog: renders QR image + Download QR + Scan to receive files ✓
  * Cancel flow: sender cancel → "Transfer cancelled | No files were shared." ✓
  * Invalid link → "This transfer is no longer available." + Try Again ✓
  * Sticky footer verified (flex layout + footerAtViewportBottom=true), dark mode toggle ✓, mobile 390px ✓
  * VLM visual QA: desktop light PASS ("production-ready"), mobile dark PASS with minor polish notes (icon alignment nits; the "N" badge is the dev-only Next.js indicator)
- DEBUGGING SAGA (important learnings): transfers appeared to "freeze" mid-flight with the sender tab unresponsive + socket ping-timeouts. Root cause: **headless Chrome suspends hidden background tabs** — when sender and receiver shared one browser and the sender tab was hidden, headless froze it. NOT an engine bug: running sender and receiver in two separate agent-browser sessions (`--session sender/--session receiver`, both tabs "active") transfers 500MB flawlessly. Real Chrome exempts WebRTC-active pages from freezing and the engine uses non-throttled primitives (bufferedamountlow events, MessageChannel yields).
- Hardening applied during the hunt (kept, all good engineering): macrotaskYield() via MessageChannel every 16 chunks (~1MB) in the sender chunk loop to guarantee timers/heartbeats/drain events fire even when file reads resolve as microtasks.
- Cleanup: removed debug instrumentation, cleaned 11 test transfer rows, lint + tsc clean.

Stage Summary:
- ALL CORE FLOWS BROWSER-VERIFIED. The product works: select files → create → code/link/QR → recipient accepts → direct P2P WebRTC chunked transfer with CRC32+SHA-256 verification → both sides confirm completion.
- Services running: Next.js :3000 (dev), signaling :3003 (`mini-services/signaling`, restart: `cd mini-services/signaling && nohup bun run dev > signaling.log 2>&1 &`).
- E2E testing method for future agents: use TWO agent-browser sessions (sender + receiver) so neither tab is backgrounded; access via http://localhost:81 (gateway), NOT :3000 directly (XTransformPort routing needs the gateway).
- Known environment notes: sandbox blocks Google Fonts (graceful fallback), headless can't use save pickers (uncheck "Save directly to disk" in tests), unicode file paths via CDP upload can arrive as 0-byte files (agent-browser quirk, not an app bug).
- Next-phase ideas (for the review agent): VLM polish nits (icon vertical alignment, badge contrast), sender-page "Send More Files" should scroll widget into view after reset (sticky header can cover the button), consider re-send of transfer:done robustness, add TURN env example in README, per-transfer event log viewer for admins, WebRTC stats shown to user (RTT).

---
Task ID: 6
Agent: main (Z.ai Code)
Task: Scheduled review job + project wrap-up

Work Log:
- Created cron job (webDevReview, every 15 min at :00/:15/:30/:45, tz Asia/Calcutta, ID 393803) with the mandated task description plus project-specific testing notes (gateway URL, two-session E2E method, service restart commands).
- Final state verified: Next.js dev :3000 running, signaling :3003 running, lint clean, tsc clean, DB clean of test rows.

Stage Summary:
- PROJECT COMPLETE for this phase: ilovedoc.org is a fully functional, browser-verified P2P file transfer platform.
- Delivered: single-page premium UI (hero/how-it-works/security/FAQ/footer, light+dark, mobile-first, accessible), send flow (dropzone/folder picker/options/password/expiry/nickname/max-downloads → waiting card with code/link/QR/copy/cancel), receive flow (code entry/link/confirm/unlock/accept with disk-streaming or memory sinks), WebRTC engine (64KB chunked binary protocol, CRC32 per chunk, incremental SHA-256 file verification, bufferedAmount backpressure, heartbeat, reconnect+resume, honest Direct P2P / Secure relay detection), REST API with rate limiting + token rotation, socket.io signaling service with Zod validation + rooms + retention cleanup, security headers + noindex on transfer URLs.
- Priority recommendations for next phase (for the review agent): 1) VLM polish nits (icon vertical alignment, hero badge contrast); 2) auto-scroll widget into view after "Send More Files"/reset (sticky header covers the button at some scroll positions); 3) surface RTT/protocol stats in the UI; 4) an /admin-ish event-log viewer (TransferEvent) for observability; 5) README/DEPLOY notes (coturn + TURN env vars, production nginx/Caddy + Postgres/Redis migration path per SPEC §infrastructure).

---

Task ID: 7
Agent: main (Z.ai Code)
Task: Scheduled review round — QA assessment + feature/styling expansion round

Work Log:
- Read worklog + SPEC; found signaling :3003 dead (dev server :3000 healthy). Restarted signaling (`cd mini-services/signaling && nohup bun run dev > signaling.log 2>&1 &`); killed a duplicate failed instance; verified socket.io handshake 200 + Next 200.
- QA Round 1 (agent-browser, gateway :81, two sessions): 3-file E2E transfer (code entry flow) — both sides completed, all SHA-256 verified ✓; code-entry, confirm view, waiting card all healthy; no console errors; no horizontal overflow; page structure intact. VLM visual audit attempted but unavailable (vision endpoint requires X-Token we don't have — 401) → substituted rigorous DOM-based checks.
- Feature: live connection stats — engines (sender.ts + receiver.ts) now expose `rttMs` + `chunkSize` in SenderState/ReceiverState, sourced from `probeConnectionKind()` reading `pair.currentRoundTripTime` (seconds→ms) on the existing 10s stats probe (emits when rtt changes ≥5ms). ProgressPanel renders honest chips: `NN ms RTT` (Radio icon, tooltip "measured by WebRTC"), `64 KB chunks`, `Protocol v1` — real values only, hidden until known.
- Feature: /api/stats endpoint (src/app/api/stats/route.ts) — aggregate metadata only: transfersCreated (Transfer count), deliveriesCompleted (TransferEvent 'completed' count = receiver-confirmed handoffs — more honest than Transfer.status which only flips at maxDownloads), filesDelivered + bytesDelivered (files/sum-size across transfers having ≥1 completed event; BigInt sent as string). 60s globalThis cache, 60/min/IP rate limit, Cache-Control public 30s. NOTE: prisma `distinct: true` is invalid — must use `distinct: ['transferId']`.
- Feature: StatsStrip landing section (src/components/site/stats-strip.tsx) between TransferWidget and HowItWorks — 4 stat blocks (ArrowLeftRight/PackageCheck/FileCheck2/HardDriveDownload icons), rAF count-up with easeOutCubic (setState only inside rAF callbacks — satisfies react-hooks/set-state-in-effect), reduced-motion probe via useSyncExternalStore shows final values, hidden entirely on API failure, "Live counts from this deployment" honest caption, gradient-rule + rose wash decorations.
- Feature: recent-transfers history — src/lib/transfer/recent.ts (localStorage `ilovedoc:recent-v1`, max 6, privacy-safe fields only: code/fileCount/totalBytes/createdAt/status, external-store subscribe pattern so React reads it without setState-in-effect). SendPanel records once per transfer via recordedTokenRef guard when phase hits terminal; renders "Recent transfers • this browser only" list in idle state with status dots (emerald/destructive/amber/muted), relative time, clear button.
- Feature: share row in waiting card — email (mailto), Telegram (t.me/share), WhatsApp (wa.me) icon buttons + Web Share API button when supported (hydration-safe probe via useSyncExternalStore, NOT render-time navigator check).
- Feature: image thumbnails in send file list — FileThumb component (image/* ≤32MB get 36px object-cover img; objectURL created in effect, revoked on cleanup, src set via ref — no setState-in-effect); non-images fall back to FileIcon.
- Fix: auto-scroll to #transfer (−80px sticky header offset) after ALL reset CTAs (Send More Files / Try Again / Start New Transfer / Enter Another Code / Receive More Files) via shared scrollToTransfer() in scroll-utils.ts — fixes "sticky header covers button" worklog nit; verified in browser (widgetTop −417 → 80).
- Styling: globals.css — .shimmer-bar (animated diagonal highlight sliding across active progress indicator, reduced-motion safe), .code-glow (soft pulsing rose radial behind waiting-card transfer code), .gradient-rule (rose hairline divider, used on stats strip + footer top), rose ::selection colors. Hero badge contrast boost (shadow + ring). Reveal wrapper (framer-motion whileInView, once, reduced-motion→no animation) applied to FAQ section (other sections already had whileInView). Footer gradient hairline.
- VERIFIED in browser: stats strip live numbers ("2 transfers, 1 delivery, 3 files, 195 KB" → grew with each E2E), chips during live 80MB transfer ("0 ms RTT | 64 KB chunks | Protocol v1" + 5.0 MB/s progress + shimmer PNG thumb in send list), share buttons (3 + web share), recent list after reset ("664 269 · 1 file · 76.3 MB · just now" + older entry), scroll-after-reset behavior, 80MB E2E transfer completed both sides SHA-256 verified, final 2-file E2E PASS, mobile 2-col stats grid, no h-overflow, tsc CLEAN, lint CLEAN, dev.log no errors.
- GOTCHA discovered: Turbopack dev served a STALE CSS chunk after globals.css edits (renamed class didn't appear in served CSS; `touch` insufficient). Fix: append a real content change to force recompile, then verify via the served chunk. Also Prisma `distinct: true` throws — use field array.
- QA test files at /tmp/e2e/ (alpha.txt, beta.dat 200KB, gamma.json, delta.png 179B, epsilon.txt, zeta.bin 80MB).

Stage Summary:
- Services: Next dev :3000 (do NOT restart/build), signaling :3003 (restart cmd above if dead). Both verified healthy this round.
- All previous functionality regressed clean + new features browser-verified: connection stats chips, /api/stats + StatsStrip, recent-transfers history, share buttons, image thumbnails, scroll-after-reset, shimmer/code-glow/gradient-rule styling, FAQ reveal animations.
- Stats semantics documented: "deliveriesCompleted" counts TransferEvent 'completed' (each receiver confirmation); Transfer.status='completed' only at maxDownloads — future agents must not conflate them.
- Next-phase ideas: 1) transfer event timeline (TransferEvent per-transfer log viewer for observability); 2) README/DEPLOY notes (coturn TURN env, production Postgres/Redis/nginx per SPEC); 3) resumable downloads list on receiver (Download All as zip via client-side zip streaming — no server storage); 4) keyboard shortcut hints (C copy code, L copy link); 5) PWA manifest + installable app icon; 6) connection stats tooltip could add packetsLost/retransmits from getStats.
