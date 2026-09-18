/**
 * Receiver-side transfer engine for ilovedoc.org.
 *
 * Accepts the sender's WebRTC offer, answers it, then receives a chunked
 * stream over the DataChannel: validates per-chunk CRC-32, writes chunks to
 * FileSinks (disk via File System Access when available, memory otherwise),
 * hashes incrementally, verifies SHA-256 at FILE_END, acks progress, and
 * drives reconnect/resume by re-joining the signaling room.
 */

import { Sha256 } from './sha256';
import { crc32 } from './crc32';
import {
  ACK_EVERY_CHUNKS,
  decodeMessage,
  encodeJsonMessage,
  encodePingMessage,
  MsgType,
  type DecodedMessage,
  type FileEndBody,
  type FileStartBody,
  type ResumeRequestBody,
  type TransferCancelBody,
  type TransferCompleteBody,
  type TransferErrorBody,
} from './protocol';
import { SignalingClient, type SignalEnvelope } from './signaling';
import { etaFromSpeed, SpeedTracker } from './stats';
import type { FileSink, SinkResult } from './sinks';
import type { ConnectionKind, FileProgressInfo } from './sender';

export type ReceiverPhase =
  | 'connecting' // signaling joined, waiting for the sender's offer
  | 'transferring'
  | 'reconnecting'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface ReceivedFileResult extends SinkResult {
  size: number;
  sha256: string | null;
  /** Sender-reported file modification time (epoch ms), when available. */
  mtime: number | null;
}

export interface ReceiverState {
  phase: ReceiverPhase;
  error: string | null;
  connectionKind: ConnectionKind;
  files: FileProgressInfo[];
  totalBytes: number;
  transferredBytes: number;
  speedBps: number | null;
  etaSeconds: number | null;
  /** Round-trip time of the selected candidate pair, refreshed by the stats probe. */
  rttMs: number | null;
  /** Negotiated DataChannel chunk size in bytes (protocol v1). */
  chunkSize: number | null;
  /** ICE candidate types of the selected pair — honest path detail. */
  candidateLocalType: string | null;
  candidateRemoteType: string | null;
  /** Wall-clock duration of the successful transfer (first byte → completion), set on completion. */
  durationMs: number | null;
  results: ReceivedFileResult[] | null;
}

interface FileState {
  id: number;
  name: string;
  size: number;
  totalChunks: number;
  chunksWritten: number;
  hasher: Sha256;
  sink: FileSink | null;
  started: boolean;
  verified: boolean;
  failed: boolean;
  sha256: string | null;
  mtime: number | null;
}

export interface ReceiverOptions {
  token: string;
  receiverToken: string;
  sinks: Map<number, FileSink>;
  onState: (state: ReceiverState) => void;
}

const PING_INTERVAL = 5000;
const SILENCE_TIMEOUT = 22000;
const OFFER_TIMEOUT = 45000;
const MAX_RECONNECTS = 6;

export class TransferReceiver {
  private readonly opts: ReceiverOptions;
  private signaling: SignalingClient | null = null;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private generation = 0;
  private phase: ReceiverPhase = 'connecting';
  private files = new Map<number, FileState>();
  private totalBytes = 0;
  private chunkSize = 65512;
  private connectionKind: ConnectionKind = 'unknown';
  private rttMs: number | null = null;
  private candidateLocalType: string | null = null;
  private candidateRemoteType: string | null = null;
  private transferStartMs: number | null = null;
  private durationMs: number | null = null;
  private speed = new SpeedTracker(6000);
  private results: ReceivedFileResult[] | null = null;
  private errorText: string | null = null;
  private cancelledByUs = false;
  private reconnects = 0;
  private lastActivity = Date.now();
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private offerWatchdog: ReturnType<typeof setTimeout> | null = null;
  private reconnectWatchdog: ReturnType<typeof setTimeout> | null = null;
  private lastEmit = 0;
  private emitScheduled = false;
  private gotAnyData = false;
  private initSeen = false;

  constructor(opts: ReceiverOptions) {
    this.opts = opts;
  }

  // ---------------------------------------------------------------- lifecycle

  async start(iceServers: RTCIceServer[]): Promise<void> {
    this.iceServers = iceServers;
    this.signaling = await SignalingClient.connect({
      onSignal: (from, payload) => this.handleSignal(payload),
      onPeerJoined: (role) => {
        if (role === 'sender') {
          // Sender re-joined (or joined late) — expect an offer shortly.
          this.armOfferWatchdog();
        }
      },
      onPeerLeft: (role, reason) => {
        if (role !== 'sender') return;
        if (reason === 'replaced') {
          this.fail('This transfer was taken over from another device.');
          return;
        }
        if (this.gotAnyData && !this.isFinished()) {
          this.enterReconnecting();
        } else if (!this.isFinished()) {
          this.armOfferWatchdog('waiting');
        }
      },
      onCancelled: (from) => {
        this.cancelByRemote('The sender cancelled this transfer.');
      },
      onSocketDown: () => {
        if (this.gotAnyData && !this.isFinished()) this.enterReconnecting();
      },
      onSocketBack: () => {
        /* re-joined; sender will get peer:joined and send a fresh offer */
      },
      onJoinError: (err) => {
        if (['not_found', 'cancelled', 'expired', 'completed'].includes(err.code)) {
          this.fail('This transfer is no longer available.');
        }
      },
    });

    const { peers } = await this.signaling.joinRoom(this.opts.token, 'receiver', this.opts.receiverToken);
    this.setPhase('connecting');
    if (!peers.includes('sender')) {
      this.armOfferWatchdog('absent');
    } else {
      this.armOfferWatchdog();
    }
    this.startWatchdog();
    this.emit(true);
  }

  private iceServers: RTCIceServer[] = [];

  async cancel(reason = 'Stopped by recipient'): Promise<void> {
    if (this.isFinished()) return;
    this.cancelledByUs = true;
    try {
      this.dc?.send(encodeJsonMessage(MsgType.TRANSFER_CANCEL, { reason } satisfies TransferCancelBody));
    } catch {
      /* channel may be dead */
    }
    this.signaling?.sendCancel(this.opts.token, reason);
    await this.closeSinks(false);
    this.cleanupPeer();
    this.signaling?.disconnect();
    this.setPhase('cancelled');
    this.emit(true);
  }

  private isFinished(): boolean {
    return this.phase === 'completed' || this.phase === 'cancelled' || this.phase === 'failed';
  }

  private setPhase(phase: ReceiverPhase): void {
    this.phase = phase;
    this.emit(true);
  }

  private fail(message: string): void {
    if (this.isFinished()) return;
    this.errorText = message;
    void this.closeSinks(false);
    this.cleanupPeer();
    this.signaling?.disconnect();
    this.setPhase('failed');
  }

  private cancelByRemote(reason: string): void {
    if (this.isFinished()) return;
    void this.closeSinks(false);
    this.cleanupPeer();
    this.signaling?.disconnect();
    this.setPhase('cancelled');
    void reason;
  }

  // ---------------------------------------------------------------- watchdogs

  private armOfferWatchdog(mode: 'absent' | 'waiting' | undefined = undefined): void {
    if (this.offerWatchdog) clearTimeout(this.offerWatchdog);
    const wait = mode === 'absent' ? 15000 : OFFER_TIMEOUT;
    this.offerWatchdog = setTimeout(() => {
      if (this.phase !== 'connecting' || this.gotAnyData) return;
      this.fail(
        mode === 'absent'
          ? 'The sender is not connected. Ask them to keep their browser tab open, then try again.'
          : 'We could not connect to the sender. They may have gone offline.',
      );
    }, wait);
  }

  private startWatchdog(): void {
    this.stopWatchdog();
    this.watchdog = setInterval(() => {
      if (this.isFinished() || !this.gotAnyData) return;
      if (Date.now() - this.lastActivity > SILENCE_TIMEOUT) {
        this.enterReconnecting();
      }
    }, PING_INTERVAL);
  }

  private stopWatchdog(): void {
    if (this.watchdog) {
      clearInterval(this.watchdog);
      this.watchdog = null;
    }
  }

  private enterReconnecting(): void {
    if (this.isFinished()) return;
    this.teardownPeer();
    this.reconnects += 1;
    if (this.reconnects > MAX_RECONNECTS) {
      this.fail('The connection was interrupted too many times. Please ask the sender to retry.');
      return;
    }
    this.setPhase('reconnecting');
    if (this.reconnectWatchdog) clearTimeout(this.reconnectWatchdog);
    this.reconnectWatchdog = setTimeout(() => {
      if (this.phase === 'reconnecting') {
        this.fail('We could not re-establish the connection to the sender.');
      }
    }, 45000);
    // Re-join the room: the server notifies the sender (peer:joined) which
    // triggers a fresh offer → answer → resume cycle.
    if (this.signaling?.connected) {
      this.signaling
        .joinRoom(this.opts.token, 'receiver', this.opts.receiverToken)
        .then(({ peers }) => {
          if (peers.includes('sender')) this.armOfferWatchdog();
          else this.armOfferWatchdog('absent');
        })
        .catch((err) => {
          const code = (err as { code?: string }).code;
          if (code && ['not_found', 'cancelled', 'expired', 'completed'].includes(code)) {
            this.fail('This transfer is no longer available.');
          }
        });
    }
  }

  // ---------------------------------------------------------------- WebRTC answer side

  private handleSignal(payload: SignalEnvelope): void {
    if (payload.kind === 'offer') {
      const desc = payload.data as RTCSessionDescriptionInit;
      if (desc?.type !== 'offer') return;
      void this.acceptOffer(desc);
    } else if (payload.kind === 'ice') {
      const cand = payload.data as RTCIceCandidateInit;
      if (this.pc) {
        this.pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {
          /* stale candidate */
        });
      }
    }
  }

  private async acceptOffer(desc: RTCSessionDescriptionInit): Promise<void> {
    if (this.isFinished()) return;
    if (this.offerWatchdog) {
      clearTimeout(this.offerWatchdog);
      this.offerWatchdog = null;
    }
    this.teardownPeer();
    const generation = ++this.generation;

    let pc: RTCPeerConnection;
    try {
      pc = new RTCPeerConnection({ iceServers: this.iceServers, bundlePolicy: 'max-bundle' });
    } catch {
      this.fail('Your browser could not start a peer connection.');
      return;
    }
    this.pc = pc;

    pc.ondatachannel = (ev) => {
      if (generation !== this.generation) return;
      const dc = ev.channel;
      dc.binaryType = 'arraybuffer';
      this.dc = dc;
      dc.onmessage = (e) => {
        if (generation !== this.generation) return;
        this.lastActivity = Date.now();
        this.onChannelMessage(e.data as ArrayBuffer);
      };
      dc.onclose = () => {
        if (generation !== this.generation) return;
        this.onChannelClosed();
      };
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.signaling?.sendSignal(this.opts.token, { kind: 'ice', data: ev.candidate.toJSON() });
      }
    };
    pc.onconnectionstatechange = () => {
      if (generation !== this.generation) return;
      if (pc.connectionState === 'connected') {
        void this.probeConnectionKind();
      } else if (pc.connectionState === 'failed') {
        this.onChannelClosed();
      }
    };

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(desc));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (generation !== this.generation || !this.signaling) return;
      this.signaling.sendSignal(this.opts.token, { kind: 'answer', data: { type: answer.type, sdp: answer.sdp } });
    } catch {
      if (generation === this.generation && !this.isFinished()) {
        this.fail('We could not negotiate the peer connection.');
      }
    }
  }

  private onChannelClosed(): void {
    if (this.isFinished() || this.cancelledByUs) return;
    if (!this.gotAnyData) {
      // Offer accepted but the channel died before any data — try a fresh
      // round only if the sender is still around.
      this.teardownPeer();
      this.armOfferWatchdog();
      return;
    }
    this.enterReconnecting();
  }

  // ---------------------------------------------------------------- channel protocol

  private onChannelMessage(data: ArrayBuffer): void {
    const msg = typeof data === 'string' ? null : decodeMessage(data);
    if (!msg) return;
    switch (msg.type) {
      case MsgType.TRANSFER_INIT:
        this.handleInit(msg.body as { v: number; transferId: string; chunkSize: number; files: { id: number; name: string; size: number; mime: string }[] });
        break;
      case MsgType.FILE_START:
        this.handleFileStart(msg.body as FileStartBody);
        break;
      case MsgType.FILE_CHUNK:
        this.handleChunk(msg.chunk);
        break;
      case MsgType.FILE_END:
        void this.handleFileEnd(msg.body as FileEndBody);
        break;
      case MsgType.PING:
        try {
          this.dc?.send(encodePingMessage(MsgType.PONG, msg.timestamp));
        } catch {
          /* closing */
        }
        break;
      case MsgType.TRANSFER_COMPLETE:
        void this.handleTransferComplete(msg.body as TransferCompleteBody);
        break;
      case MsgType.TRANSFER_CANCEL:
        this.cancelByRemote('The sender cancelled this transfer.');
        break;
      case MsgType.TRANSFER_ERROR: {
        const body = msg.body as TransferErrorBody;
        this.fail(body.message || 'The sender reported a transfer error.');
        break;
      }
      default:
        break;
    }
  }

  private handleInit(body: { v: number; transferId: string; chunkSize: number; files: { id: number; name: string; size: number; mime: string; mtime?: number }[] }): void {
    if (body.v !== 1) {
      this.sendError('protocol_version', 'Unsupported transfer protocol version.');
      this.fail('Unsupported transfer protocol version.');
      return;
    }
    this.gotAnyData = true;
    if (this.phase !== 'transferring') {
      if (this.transferStartMs === null) this.transferStartMs = Date.now();
      this.setPhase('transferring');
    }
    this.chunkSize = body.chunkSize || this.chunkSize;

    if (!this.initSeen) {
      this.initSeen = true;
      this.totalBytes = body.files.reduce((acc, f) => acc + f.size, 0);
      for (const f of body.files) {
        if (!this.files.has(f.id)) {
          this.files.set(f.id, {
            id: f.id,
            name: f.name,
            size: f.size,
            totalChunks: Math.max(f.size === 0 ? 0 : 1, Math.ceil(f.size / this.chunkSize)),
            chunksWritten: 0,
            hasher: new Sha256(),
            sink: this.opts.sinks.get(f.id) ?? null,
            started: false,
            verified: false,
            failed: false,
            sha256: null,
            mtime: typeof f.mtime === 'number' && Number.isFinite(f.mtime) ? f.mtime : null,
          });
        }
      }
    }

    // Uniform handshake: ask the sender to (re)start from our last written
    // chunk; omit files we have already verified.
    const resume: ResumeRequestBody = {
      files: [...this.files.values()]
        .filter((f) => !f.verified && !f.failed)
        .map((f) => ({ id: f.id, nextChunk: f.chunksWritten })),
    };
    this.sendJson(MsgType.RESUME_REQUEST, resume);
    if (this.reconnectWatchdog) {
      clearTimeout(this.reconnectWatchdog);
      this.reconnectWatchdog = null;
    }
    this.emit(true);
  }

  private handleFileStart(body: FileStartBody): void {
    let f = this.files.get(body.id);
    if (!f) {
      f = {
        id: body.id,
        name: body.name,
        size: body.size,
        totalChunks: body.totalChunks,
        chunksWritten: 0,
        hasher: new Sha256(),
        sink: this.opts.sinks.get(body.id) ?? null,
        started: false,
        verified: false,
        failed: false,
        sha256: null,
        mtime: null,
      };
      this.files.set(body.id, f);
    }
    f.totalChunks = body.totalChunks;
    f.started = true;
    if (this.totalBytes === 0) {
      this.totalBytes = [...this.files.values()].reduce((acc, x) => acc + x.size, 0);
    }
    this.emit(true);
  }

  private handleChunk(chunk: { fileId: number; chunkIndex: number; byteOffset: number; byteLength: number; crc32: number; data: Uint8Array }): void {
    const f = this.files.get(chunk.fileId);
    if (!f || !f.started || f.verified) return;
    if (chunk.chunkIndex !== f.chunksWritten) {
      // Ordered reliable channel — a mismatch means real corruption/loss.
      this.sendError('chunk_mismatch', `Unexpected chunk order in file ${f.name}.`);
      this.fail('Data arrived out of order — the transfer was corrupted. Please retry.');
      return;
    }
    if (crc32(chunk.data) !== chunk.crc32) {
      this.sendError('chunk_corrupted', `CRC mismatch in file ${f.name}.`);
      this.fail('A corrupted chunk was detected. Please retry the transfer.');
      return;
    }
    const sink = f.sink;
    if (!sink) {
      this.sendError('write_failed', `No destination for file ${f.name}.`);
      this.fail('Could not save the received files.');
      return;
    }
    f.hasher.update(chunk.data);
    sink.write(chunk.data).catch((err) => {
      this.sendError('write_failed', `Could not write file ${f.name} to disk.`);
      this.fail('Could not save the received files (disk write error).');
      void err;
    });
    f.chunksWritten = chunk.chunkIndex + 1;
    const done = f.chunksWritten >= f.totalChunks;
    if (done || f.chunksWritten % ACK_EVERY_CHUNKS === 0) {
      this.sendJson(MsgType.FILE_ACK, { id: f.id, received: f.chunksWritten });
    }
    this.speed.observe(this.computeReceivedBytes());
    this.emit(false);
  }

  private async handleFileEnd(body: FileEndBody): Promise<void> {
    const f = this.files.get(body.id);
    if (!f || f.verified) return;
    const actual = f.hasher.digestHex();
    if (actual !== body.sha256) {
      f.failed = true;
      this.sendJson(MsgType.FILE_COMPLETE, { id: f.id, verified: false, sha256: actual });
      this.sendError('hash_mismatch', `SHA-256 verification failed for ${f.name}.`);
      this.fail('File verification failed. Please retry the transfer.');
      return;
    }
    f.sha256 = actual;
    f.verified = true;
    this.sendJson(MsgType.FILE_COMPLETE, { id: f.id, verified: true, sha256: actual });
    this.speed.observe(this.computeReceivedBytes());
    this.emit(true);
  }

  private async handleTransferComplete(body: TransferCompleteBody): Promise<void> {
    // All files the sender intended have been delivered + verified.
    for (const f of this.files.values()) {
      if (!f.failed) f.verified = true;
    }
    await this.closeSinks(true);
    const shaById = new Map(body.files.map((x) => [x.id, x.sha256]));
    this.results = [...this.files.values()].map((f) => ({
      ...(f.sink?.getResult() ?? { kind: 'memory' as const, name: f.name, savedToDisk: false, blob: new Blob() }),
      size: f.size,
      sha256: f.sha256 ?? shaById.get(f.id) ?? null,
      mtime: f.mtime,
    }));
    this.signaling?.sendDone(this.opts.token);
    this.cleanupPeer();
    this.signaling?.disconnect();
    if (this.transferStartMs !== null && this.durationMs === null) {
      this.durationMs = Math.max(0, Date.now() - this.transferStartMs);
    }
    this.setPhase('completed');
  }

  private async closeSinks(graceful: boolean): Promise<void> {
    for (const f of this.files.values()) {
      const sink = f.sink;
      if (!sink) continue;
      try {
        if (graceful && !f.failed) await sink.close();
        else await sink.abort();
      } catch {
        /* best effort */
      }
      if (!graceful) f.sink = null;
    }
  }

  // ---------------------------------------------------------------- stats / teardown

  private async probeConnectionKind(): Promise<void> {
    const pc = this.pc;
    if (!pc || this.isFinished()) return;
    try {
      const stats = await pc.getStats();
      let pairId: string | undefined;
      let pair: Record<string, unknown> | undefined;
      stats.forEach((report: Record<string, unknown>) => {
        if (report.type === 'transport' && typeof report.selectedCandidatePairId === 'string') {
          pairId = report.selectedCandidatePairId;
        }
      });
      if (pairId) pair = stats.get(pairId) as Record<string, unknown> | undefined;
      if (!pair) {
        stats.forEach((report: Record<string, unknown>) => {
          if (report.type === 'candidate-pair' && (report.selected === true || report.nominated === true)) {
            pair = pair ?? (report as Record<string, unknown>);
          }
        });
      }
      if (!pair) return;
      const local = pair.localCandidateId ? stats.get(pair.localCandidateId as string) : undefined;
      const remote = pair.remoteCandidateId ? stats.get(pair.remoteCandidateId as string) : undefined;
      const localType = (local as { candidateType?: string } | undefined)?.candidateType ?? null;
      const remoteType = (remote as { candidateType?: string } | undefined)?.candidateType ?? null;
      const relay = localType === 'relay' || remoteType === 'relay';
      const kind: ConnectionKind = relay ? 'relay' : 'direct';
      const crtt = pair.currentRoundTripTime;
      const rtt = typeof crtt === 'number' && Number.isFinite(crtt) && crtt >= 0
        ? Math.round(crtt * 1000)
        : null;
      const kindChanged = kind !== this.connectionKind;
      const rttChanged = rtt !== null && (this.rttMs === null || Math.abs(rtt - this.rttMs) >= 5);
      const pathChanged = localType !== this.candidateLocalType || remoteType !== this.candidateRemoteType;
      this.connectionKind = kind;
      this.rttMs = rtt ?? this.rttMs;
      this.candidateLocalType = localType ?? this.candidateLocalType;
      this.candidateRemoteType = remoteType ?? this.candidateRemoteType;
      if (kindChanged) {
        this.signaling?.sendState(this.opts.token, kind === 'relay' ? 'connected-relay' : 'connected-direct');
      }
      if (kindChanged || rttChanged || pathChanged) this.emit(true);
    } catch {
      /* stats unavailable */
    }
  }

  private computeReceivedBytes(): number {
    let total = 0;
    for (const f of this.files.values()) {
      total += f.verified ? f.size : Math.min(f.chunksWritten * this.chunkSize, f.size);
    }
    return total;
  }

  private buildState(): ReceiverState {
    const transferred = this.computeReceivedBytes();
    const speedBps = this.speed.bps;
    return {
      phase: this.phase,
      error: this.errorText,
      connectionKind: this.connectionKind,
      files: [...this.files.values()].map((f) => ({
        fileId: f.id,
        name: f.name,
        size: f.size,
        transferred: f.verified ? f.size : Math.min(f.chunksWritten * this.chunkSize, f.size),
        status: f.failed ? 'error' : f.verified ? 'verified' : f.started ? 'active' : 'pending',
        error: f.failed ? 'verification failed' : undefined,
      })),
      totalBytes: this.totalBytes,
      transferredBytes: transferred,
      speedBps,
      etaSeconds: this.phase === 'transferring' ? etaFromSpeed(speedBps, this.totalBytes - transferred) : null,
      rttMs: this.rttMs,
      chunkSize: this.dc ? this.chunkSize : null,
      candidateLocalType: this.candidateLocalType,
      candidateRemoteType: this.candidateRemoteType,
      durationMs: this.phase === 'completed' ? this.durationMs : null,
      results: this.results,
    };
  }

  private emit(immediate: boolean): void {
    const fire = () => {
      this.lastEmit = Date.now();
      this.emitScheduled = false;
      this.opts.onState(this.buildState());
    };
    if (immediate) {
      fire();
      return;
    }
    if (this.emitScheduled) return;
    const elapsed = Date.now() - this.lastEmit;
    if (elapsed >= 250) fire();
    else {
      this.emitScheduled = true;
      setTimeout(fire, 250 - elapsed);
    }
  }

  private sendJson(type: number, body: unknown): void {
    const dc = this.dc;
    if (dc && dc.readyState === 'open') {
      try {
        dc.send(encodeJsonMessage(type as never, body));
      } catch {
        /* closing */
      }
    }
  }

  private sendError(code: string, message: string): void {
    this.sendJson(MsgType.TRANSFER_ERROR, { code, message } satisfies TransferErrorBody);
  }

  private teardownPeer(): void {
    const dc = this.dc;
    const pc = this.pc;
    this.dc = null;
    this.pc = null;
    this.generation += 1;
    if (dc) {
      try {
        dc.close();
      } catch {
        /* ignore */
      }
    }
    if (pc) {
      try {
        pc.close();
      } catch {
        /* ignore */
      }
    }
  }

  private cleanupPeer(): void {
    this.teardownPeer();
    this.stopWatchdog();
    if (this.offerWatchdog) {
      clearTimeout(this.offerWatchdog);
      this.offerWatchdog = null;
    }
    if (this.reconnectWatchdog) {
      clearTimeout(this.reconnectWatchdog);
      this.reconnectWatchdog = null;
    }
  }
}
