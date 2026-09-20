/**
 * ilovedoc.org — signaling mini-service (Task 2-a, SPEC §5).
 *
 * Socket.io relay for WebRTC offer/answer/ICE plus transfer-room bookkeeping.
 * File bytes NEVER pass through this service — peers exchange them directly over
 * WebRTC DataChannels; this service only coordinates.
 *
 *  - Port 3003, socket.io path '/' (MANDATORY: the Caddy gateway routes requests
 *    carrying ?XTransformPort=3003 to this port, browsers connect with
 *    io('/?XTransformPort=3003')).
 *  - Rooms: Map<publicToken, { sender?: socketId, receiver?: socketId }>.
 *  - Every client → server event is acknowledged:
 *      ack = { ok: true, data? } | { ok: false, error: { code, message } }
 *  - Server → client events: signal, peer:joined, peer:left, transfer:cancelled,
 *    transfer:done, transfer:state.
 */
import { createServer } from 'node:http'
import { createHash, timingSafeEqual } from 'node:crypto'
import { Server } from 'socket.io'
import type { DefaultEventsMap, Socket } from 'socket.io'
import {
  cancelSchema,
  doneSchema,
  joinSchema,
  signalSchema,
  stateSchema,
  type AckResult,
  type JoinAckData,
  type Role,
  type SignalEnvelope,
} from './src/schemas'
import {
  activateIfWaiting,
  cancelTransfer,
  closeDb,
  completeTransfer,
  getDownloadCounts,
  getTransferByToken,
  incrementDownloads,
  logEvent,
  markTransferExpired,
  type TransferRow,
} from './src/db'
import {
  countMessage,
  ipOf,
  limitsSnapshot,
  LIMITS,
  newMessageWindow,
  releaseConnection,
  startLimitsSweep,
  tryConnection,
} from './src/limits'
import { startCleanupJob, stopCleanupJob } from './src/cleanup'
import { log, logError, takeRecentErrors } from './src/log'

const PORT = 3003
const ROOM_PREFIX = 't:'

// ---------------------------------------------------------------- socket.io typing

interface ClientToServerEvents {
  'transfer:join': (payload: unknown, ack: (res: AckResult<JoinAckData>) => void) => void
  signal: (payload: unknown, ack: (res: AckResult) => void) => void
  'transfer:state': (payload: unknown, ack: (res: AckResult) => void) => void
  'transfer:done': (payload: unknown, ack: (res: AckResult) => void) => void
  'transfer:cancel': (payload: unknown, ack: (res: AckResult) => void) => void
}

interface ServerToClientEvents {
  signal: (payload: { from: Role; payload: SignalEnvelope }) => void
  'peer:joined': (payload: { role: Role }) => void
  'peer:left': (payload: { role: Role; reason: 'disconnected' | 'replaced' }) => void
  'transfer:cancelled': (payload: { from: Role; reason?: string }) => void
  'transfer:done': (payload: { from: 'receiver' }) => void
  'transfer:state': (payload: { from: Role; state: string }) => void
}

interface SocketData {
  ip: string
  /** true once this connection has counted toward the per-IP concurrent limit */
  counted: boolean
  token?: string
  role?: Role
  transferId?: string
  msgWindow: { start: number; count: number }
  iceCounts: Map<string, number>
}

type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>
type AckFn<T = undefined> = (res: AckResult<T>) => void

const httpServer = createServer()
const io = new Server<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>(httpServer, {
  // DO NOT change path '/' — Caddy routes on the XTransformPort query param and the
  // sandbox demo pattern requires it.
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 20000,
  pingInterval: 25000,
  maxHttpBufferSize: 200000,
  serveClient: false,
})

// ---------------------------------------------------------------- internal stats (Task 16)

const STARTED_AT = Date.now()

/** Lifetime counters for the admin console (survive bun --hot reloads). */
interface SigCounters {
  connections: number
  refused: number
  joins: number
  signals: number
  transfersDone: number
  transfersCancelled: number
}
const globalForCounters = globalThis as unknown as {
  __ilovedocSigCounters?: SigCounters
  __ilovedocSigStartedAt?: number
}
const counters: SigCounters = (globalForCounters.__ilovedocSigCounters ??= {
  connections: 0,
  refused: 0,
  joins: 0,
  signals: 0,
  transfersDone: 0,
  transfersCancelled: 0,
})
if (globalForCounters.__ilovedocSigStartedAt === undefined) {
  globalForCounters.__ilovedocSigStartedAt = STARTED_AT
}
const SERVICE_STARTED_AT = globalForCounters.__ilovedocSigStartedAt ?? STARTED_AT

/**
 * Loopback-only HTTP server exposing /internal/stats to the Next.js admin
 * API (server-to-server). It CANNOT share port 3003: engine.io with path '/'
 * intercepts every request there (verified — plain GET /internal/stats on
 * 3003 answers 400 from engine.io). Bound to 127.0.0.1 and additionally
 * guarded: requests arriving through the Caddy gateway always carry
 * x-forwarded-for, direct loopback calls never do.
 */
const INTERNAL_PORT = 3004

function isLoopback(remote: string | undefined): boolean {
  return remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1'
}

function handleInternalRequest(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  if (url.pathname !== '/internal/stats') {
    res.statusCode = 404
    res.end('not found')
    return
  }
  // Three guards: loopback socket, no gateway hop (XFF absent), marker header.
  if (
    !isLoopback(req.socket.remoteAddress) ||
    req.headers['x-forwarded-for'] !== undefined ||
    req.headers['x-ilovedoc-internal'] !== '1'
  ) {
    res.statusCode = 403
    res.end('forbidden')
    return
  }

  const mem = process.memoryUsage()
  const roomsDetail = Array.from(rooms.entries())
    .slice(0, 50)
    .map(([token, room]) => ({
      token,
      sender: Boolean(room.sender),
      receiver: Boolean(room.receiver),
    }))

  res.statusCode = 200
  res.setHeader('content-type', 'application/json')
  res.setHeader('cache-control', 'no-store')
  res.end(
    JSON.stringify({
      ok: true,
      service: 'signaling',
      pid: process.pid,
      startedAt: SERVICE_STARTED_AT,
      uptimeSec: Math.floor((Date.now() - SERVICE_STARTED_AT) / 1000),
      sockets: io.engine.clientsCount,
      rooms: rooms.size,
      roomsDetail,
      counters,
      perIp: limitsSnapshot(),
      recentErrors: takeRecentErrors(),
      limits: LIMITS,
      memory: { rss: mem.rss, heapUsed: mem.heapUsed },
    })
  )
}

const internalServer = createServer(handleInternalRequest)

// ---------------------------------------------------------------- rooms

interface RoomEntry {
  sender?: string
  receiver?: string
}

const rooms = new Map<string, RoomEntry>()

const roomKey = (token: string): string => ROOM_PREFIX + token

function peerSocketId(token: string, myRole: Role): string | undefined {
  const room = rooms.get(token)
  if (!room) return undefined
  return myRole === 'sender' ? room.receiver : room.sender
}

/** Remove a socket from its room; notify the remaining peer when requested. */
function leaveRoom(socket: ClientSocket, notifyPeer: boolean): void {
  const { token, role } = socket.data
  if (!token || !role) return
  const room = rooms.get(token)
  if (room && room[role] === socket.id) {
    delete room[role]
    const remaining = room.sender ?? room.receiver
    if (!remaining) rooms.delete(token)
    else if (notifyPeer) io.to(remaining).emit('peer:left', { role, reason: 'disconnected' })
  }
  socket.leave(roomKey(token))
}

/** Drop rooms with no sockets left (safety net — disconnects already do this). */
function gcEmptyRooms(): number {
  let removed = 0
  for (const [token, room] of rooms) {
    if (!room.sender && !room.receiver) {
      rooms.delete(token)
      removed += 1
    }
  }
  return removed
}

// ---------------------------------------------------------------- helpers

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

/** Constant-time comparison of sha256(auth) against the stored hex hash. */
function hashMatchesHex(input: string, expectedHex: string): boolean {
  const a = Buffer.from(sha256Hex(input), 'utf8')
  const b = Buffer.from(expectedHex, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

function ackOk<T>(ack: AckFn<T> | undefined, data?: T): void {
  if (typeof ack !== 'function') return
  ack(data !== undefined ? { ok: true, data } : { ok: true })
}

function ackFail<T>(ack: AckFn<T> | undefined, code: string, message: string): void {
  if (typeof ack !== 'function') return
  ack({ ok: false, error: { code, message } })
}

interface Session {
  role: Role
  transferId: string
}

function requireJoined(socket: ClientSocket, token: string): Session | null {
  const { token: joinedToken, role, transferId } = socket.data
  if (!joinedToken || !role || !transferId || joinedToken !== token) return null
  return { role, transferId }
}

function overMessageLimit(socket: ClientSocket): boolean {
  return !countMessage(socket.data.msgWindow)
}

// ---------------------------------------------------------------- event handlers

async function handleJoin(socket: ClientSocket, raw: unknown, ack: AckFn<JoinAckData> | undefined): Promise<void> {
  if (overMessageLimit(socket)) return ackFail(ack, 'rate_limited', 'Too many messages; slow down.')

  const parsed = joinSchema.safeParse(raw)
  if (!parsed.success) return ackFail(ack, 'invalid_body', 'Invalid join payload.')
  const { token, role, auth } = parsed.data

  // Room cap — only when this join would create a NEW room.
  if (!rooms.has(token) && rooms.size >= LIMITS.maxRooms) {
    return ackFail(ack, 'server_busy', 'Too many active rooms; try again shortly.')
  }

  let row: TransferRow | null
  try {
    row = await getTransferByToken(token)
  } catch (err) {
    logError('db', 'failed to load transfer for join', err)
    return ackFail(ack, 'internal', 'Temporary database error.')
  }
  if (!row) return ackFail(ack, 'not_found', 'This transfer is no longer available.')

  if (row.isExpired) {
    try {
      await markTransferExpired(row.id)
      await logEvent(row.id, 'expired', { source: 'signaling' })
    } catch (err) {
      logError('db', 'lazy expiry update failed', err)
    }
    return ackFail(ack, 'expired', 'This transfer has expired.')
  }

  if (row.status !== 'waiting' && row.status !== 'active') {
    return ackFail(ack, row.status, `This transfer is ${row.status}.`)
  }

  const expectedHash = role === 'sender' ? row.senderTokenHash : row.receiverTokenHash
  if (!hashMatchesHex(auth, expectedHash)) {
    return ackFail(ack, 'unauthorized', 'Invalid transfer credentials.')
  }

  if (role === 'receiver' && row.downloads >= row.maxDownloads) {
    return ackFail(ack, 'completed', 'This transfer has reached its download limit.')
  }

  // A socket participates in one transfer at a time — leave any previous room first.
  const prevToken = socket.data.token
  const prevRole = socket.data.role
  if (prevToken && !(prevToken === token && prevRole === role)) leaveRoom(socket, true)

  // Same-role rejoin: evict the socket that previously held this role.
  const room = rooms.get(token) ?? {}
  const previousId = room[role]
  if (previousId && previousId !== socket.id) {
    const previous = io.sockets.sockets.get(previousId)
    if (previous) {
      previous.emit('peer:left', { role, reason: 'replaced' })
      previous.data.token = undefined
      previous.data.role = undefined
      previous.data.transferId = undefined
      previous.leave(roomKey(token))
    }
  }

  room[role] = socket.id
  rooms.set(token, room)
  socket.data.token = token
  socket.data.role = role
  socket.data.transferId = row.id
  socket.join(roomKey(token))

  const otherRole: Role | null =
    role === 'sender' ? (room.receiver ? 'receiver' : null) : room.sender ? 'sender' : null

  if (otherRole) {
    const peerId = room[otherRole]
    if (peerId) io.to(peerId).emit('peer:joined', { role })
    ackOk(ack, { peers: [otherRole] })
  } else {
    ackOk(ack, { peers: [] })
  }
  counters.joins += 1

  if (role === 'receiver') {
    try {
      await activateIfWaiting(token)
      await logEvent(row.id, 'receiver_joined', { role: 'receiver' })
    } catch (err) {
      logError('db', 'receiver_joined bookkeeping failed', err)
    }
  }

  log('join', `role=${role} joined transfer (peer ${otherRole ? 'present' : 'absent'}, rooms=${rooms.size})`)
}

async function handleSignal(socket: ClientSocket, raw: unknown, ack: AckFn | undefined): Promise<void> {
  if (overMessageLimit(socket)) return ackFail(ack, 'rate_limited', 'Too many messages; slow down.')

  const parsed = signalSchema.safeParse(raw)
  if (!parsed.success) return ackFail(ack, 'invalid_body', 'Invalid signal payload.')
  const { token, payload } = parsed.data

  const session = requireJoined(socket, token)
  if (!session) return ackFail(ack, 'not_joined', 'Join the transfer before signaling.')

  const peerId = peerSocketId(token, session.role)
  if (!peerId) return ackFail(ack, 'peer_absent', 'The other peer is not connected.')

  let encoded: string | null
  try {
    encoded = JSON.stringify(payload.data) ?? 'null'
  } catch {
    encoded = null
  }
  if (encoded === null) return ackFail(ack, 'payload_too_large', 'Signal payload is not serializable.')
  const byteLength = Buffer.byteLength(encoded, 'utf8')

  if (payload.kind === 'ice') {
    if (byteLength > LIMITS.maxIceSignalBytes) {
      return ackFail(ack, 'payload_too_large', 'ICE candidate exceeds the 2 KB limit.')
    }
    const count = (socket.data.iceCounts.get(token) ?? 0) + 1
    socket.data.iceCounts.set(token, count)
    if (count > LIMITS.maxIcePerSocketPerRoom) {
      return ackFail(ack, 'ice_limit', 'Too many ICE candidates for this session.')
    }
  } else if (byteLength > LIMITS.maxSdpSignalBytes) {
    return ackFail(ack, 'payload_too_large', 'Signal payload exceeds the 64 KB limit.')
  }

  io.to(peerId).emit('signal', { from: session.role, payload })
  counters.signals += 1
  ackOk(ack)
}

async function handleState(socket: ClientSocket, raw: unknown, ack: AckFn | undefined): Promise<void> {
  if (overMessageLimit(socket)) return ackFail(ack, 'rate_limited', 'Too many messages; slow down.')

  const parsed = stateSchema.safeParse(raw)
  if (!parsed.success) return ackFail(ack, 'invalid_body', 'Invalid state payload.')
  const { token, state } = parsed.data

  const session = requireJoined(socket, token)
  if (!session) return ackFail(ack, 'not_joined', 'Join the transfer first.')

  const peerId = peerSocketId(token, session.role)
  if (peerId) io.to(peerId).emit('transfer:state', { from: session.role, state })

  try {
    if (state === 'connected-direct' || state === 'connected-relay') {
      await logEvent(session.transferId, 'connection', { kind: state.slice('connected-'.length) })
    } else {
      await logEvent(session.transferId, 'state', { state, role: session.role })
    }
  } catch (err) {
    logError('db', 'state event log failed', err)
  }

  ackOk(ack)
}

async function handleDone(socket: ClientSocket, raw: unknown, ack: AckFn | undefined): Promise<void> {
  if (overMessageLimit(socket)) return ackFail(ack, 'rate_limited', 'Too many messages; slow down.')

  const parsed = doneSchema.safeParse(raw)
  if (!parsed.success) return ackFail(ack, 'invalid_body', 'Invalid done payload.')
  const { token } = parsed.data

  const session = requireJoined(socket, token)
  if (!session) return ackFail(ack, 'not_joined', 'Join the transfer first.')
  if (session.role !== 'receiver') {
    return ackFail(ack, 'forbidden', 'Only the receiver can confirm a completed transfer.')
  }

  try {
    await incrementDownloads(token)
    const counts = await getDownloadCounts(token)
    if (counts && counts.downloads >= counts.maxDownloads) await completeTransfer(token)
    await logEvent(session.transferId, 'completed', { role: 'receiver' })
  } catch (err) {
    logError('db', 'done bookkeeping failed', err)
    return ackFail(ack, 'internal', 'Temporary database error.')
  }

  const senderId = peerSocketId(token, 'receiver')
  if (senderId) io.to(senderId).emit('transfer:done', { from: 'receiver' })
  counters.transfersDone += 1
  ackOk(ack)
  log('transfer', 'receiver confirmed download (transfer done)')
}

async function handleCancel(socket: ClientSocket, raw: unknown, ack: AckFn | undefined): Promise<void> {
  if (overMessageLimit(socket)) return ackFail(ack, 'rate_limited', 'Too many messages; slow down.')

  const parsed = cancelSchema.safeParse(raw)
  if (!parsed.success) return ackFail(ack, 'invalid_body', 'Invalid cancel payload.')
  const { token, reason } = parsed.data

  const session = requireJoined(socket, token)
  if (!session) return ackFail(ack, 'not_joined', 'Join the transfer first.')

  const peerId = peerSocketId(token, session.role)
  if (peerId) {
    io.to(peerId).emit(
      'transfer:cancelled',
      reason !== undefined ? { from: session.role, reason } : { from: session.role }
    )
  }

  if (session.role === 'sender') {
    try {
      await cancelTransfer(token)
    } catch (err) {
      logError('db', 'cancel status update failed', err)
    }
  }

  try {
    await logEvent(session.transferId, 'cancelled', { role: session.role })
  } catch (err) {
    logError('db', 'cancelled event log failed', err)
  }

  counters.transfersCancelled += 1
  ackOk(ack)
  log('transfer', `transfer cancelled by ${session.role}`)
}

// ---------------------------------------------------------------- wiring

io.on('connection', (socket: ClientSocket) => {
  const ip = ipOf(socket.handshake.headers)
  socket.data.ip = ip
  socket.data.counted = false
  socket.data.msgWindow = newMessageWindow()
  socket.data.iceCounts = new Map()

  if (!tryConnection(ip)) {
    counters.refused += 1
    log('net', `connection refused (per-IP limit) ip=${ip}`)
    socket.disconnect(true)
    return
  }
  socket.data.counted = true
  counters.connections += 1
  log('net', `connected ip=${ip} sockets=${io.engine.clientsCount}`)

  socket.on('transfer:join', (raw, ack) => handleJoin(socket, raw, ack))
  socket.on('signal', (raw, ack) => handleSignal(socket, raw, ack))
  socket.on('transfer:state', (raw, ack) => handleState(socket, raw, ack))
  socket.on('transfer:done', (raw, ack) => handleDone(socket, raw, ack))
  socket.on('transfer:cancel', (raw, ack) => handleCancel(socket, raw, ack))

  socket.on('disconnect', (reason) => {
    if (socket.data.counted) releaseConnection(socket.data.ip)
    leaveRoom(socket, true)
    log('net', `disconnected ip=${socket.data.ip} reason=${reason} sockets=${io.engine.clientsCount}`)
  })
})

io.on('connection_error', (err) => {
  logError('net', 'connection error', err)
})

// ---------------------------------------------------------------- lifecycle

startLimitsSweep()
startCleanupJob(gcEmptyRooms)

httpServer.listen(PORT, () => {
  log('boot', `ilovedoc signaling listening on port ${PORT} (path=/)`)
})

internalServer.listen(INTERNAL_PORT, '127.0.0.1', () => {
  log('boot', `internal stats listening on 127.0.0.1:${INTERNAL_PORT}`)
})

let shuttingDown = false
function shutdown(signal: string): void {
  if (shuttingDown) return
  shuttingDown = true
  log('boot', `${signal} received — shutting down`)
  stopCleanupJob()
  io.close()
  internalServer.close()
  httpServer.close(async () => {
    try {
      await closeDb()
    } catch {
      /* already closed */
    }
    log('boot', 'ilovedoc signaling stopped')
    process.exit(0)
  })
  // Force-exit fallback in case close() hangs on a lingering connection.
  setTimeout(() => process.exit(0), 5000).unref?.()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
