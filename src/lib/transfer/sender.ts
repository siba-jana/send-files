/**
 * Sender-side transfer engine for ilovedoc.org.
 *
 * Owns the WebRTC offer side: one RTCPeerConnection + DataChannel per
 * connection generation, a chunked streaming file loop with proper
 * DataChannel backpressure (bufferedAmount), incremental SHA-256 hashing,
 * ACK tracking, heartbeat, automatic resume after reconnects, and clean
 * cancellation. File bytes go browser → browser; the signaling service only
 * ever sees SDP/ICE.
 */

import { Sha256 } from './sha256';
import { crc32 } from './crc32';
import {
  decodeMessage,
  encodeChunkMessage,
  encodeJsonMessage,
  encodePingMessage,
  MsgType,
  negotiateChunkSize,
  PROTOCOL_VERSION,
  type FileAckBody,
  type FileCompleteBody,
  type FileStartBody,
  type ResumeRequestBody,
  type ResumeResponseBody,
  type TransferCancelBody,
  type TransferCompleteBody,
  type TransferErrorBody,
  type DecodedMessage,
} from './protocol';
import { SignalingClient, type SignalEnvelope } from './signaling';
import { etaFromSpeed, SpeedTracker } from './stats';
import type { TransferFileMeta } from './client-api';

export type ConnectionKind = 'direct' | 'relay' | 'unknown';

export type SenderPhase =
  | 'waiting' // session created, signaling joined, waiting for recipient
  | 'connecting' // offer/answer/ICE in progress
  | 'transferring'
  | 'reconnecting' // channel lost, waiting for the peer to re-join
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface FileProgressInfo {
  fileId: number;
  name: string;
  size: number;
  transferred: number;
  status: 'pending' | 'active' | 'done' | 'verified' | 'error';
  error?: string;
}

export interface SenderState {
  phase: SenderPhase;
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
}

interface FileEntry {
  meta: TransferFileMeta;
  file: File;
  totalChunks: number;
  /** chunks fed into the hasher (prefix invariant, see rehashPrefix) */
  hashedChunks: number;
  hasher: Sha256;
  /** receiver-confirmed chunk count (for resume bookkeeping) */
  ackedChunks: number;
  /** display progress: bytes accounted as sent */
  progressBytes: number;
  verified: boolean;
  failed: boolean;
}

export interface SenderOptions {
  token: string;
  senderToken: string;
  files: File[];
  fileMetas: TransferFileMeta[];
  iceServers: RTCIceServer[];
  onState: (state: SenderState) => void;
}

/** bufferedAmount below this resumes chunk production */
const LOW_WATER = 512 * 1024;
/** pause chunk production above this */
const HIGH_WATER = 4 * 1024 * 1024;
const PING_INTERVAL = 5000;
const PONG_TIMEOUT = 16000;
const MAX_RECONNECTS = 6;
const DC_OPEN_TIMEOUT = 30000;
const RESUME_TIMEOUT = 30000;
const FILE_COMPLETE_TIMEOUT = 120000;

export class TransferSender {
  private readonly opts: SenderOptions;
  private signaling: SignalingClient | null = null;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private generation = 0;
  private phase: SenderPhase = 'waiting';
  private finished = false;
  private cancelledByUs = false;
  private transferStarted = false;
  private reconnects = 0;
  private chunkSize = 65512;
  private entries: FileEntry[] = [];
  private readonly totalBytes: number;
  private speed = new SpeedTracker(6000);
  private connectionKind: ConnectionKind = 'unknown';
  private rttMs: number | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastPong = Date.now();
  private lastEmit = 0;
  private emitScheduled = false;
  private offerTimer: ReturnType<typeof setTimeout> | null = null;
  private setupInFlight = false;
  private reconnectWatchdog: ReturnType<typeof setTimeout> | null = null;
  private errorText: string | null = null;
  private pendingResume: ((body: ResumeRequestBody) => void) | null = null;
  private fileCompleteWaiters = new Map<number, (ok: boolean) => void>();
  private transferLoopRunning = false;
  private kindProbeTimer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: SenderOptions) {
    this.opts = opts;
    if (opts.files.length !== opts.fileMetas.length) {
      throw new Error('TransferSender: files and fileMetas must align');
    }
    this.entries = opts.fileMetas.map((meta, i) => ({
      meta,
      file: opts.files[i],
      totalChunks: Math.max(1, Math.ceil(meta.size / 65536)), // provisional; recomputed after negotiation
      hashedChunks: 0,
      hasher: new Sha256(),
      ackedChunks: 0,
      progressBytes: 0,
      verified: false,
      failed: false,
    }));
    this.totalBytes = opts.fileMetas.reduce((acc, m) => acc + m.size, 0);
  }

  // ---------------------------------------------------------------- lifecycle

  async start(): Promise<void> {
    this.signaling = await SignalingClient.connect({
      onSignal: (from, payload) => this.handleSignal(payload),
      onPeerJoined: (role) => {
        if (role === 'receiver') this.maybeOffer();
      },
      onPeerLeft: (role, reason) => {
        if (role !== 'receiver') return;
        if (reason === 'replaced') {
          this.fail('Another recipient took over this transfer.');
          return;
        }
        if (this.transferStarted && !this.isFinished()) {
          this.enterReconnecting('The recipient went away');
        } else if (this.phase === 'connecting' && !this.isFinished()) {
          this.teardownPeer();
          this.setPhase('waiting');
        }
      },
      onCancelled: (from) => {
        this.cancelByRemote('The recipient stopped the transfer.');
      },
      onDone: () => {
        this.complete();
      },
      onSocketDown: () => {
        if (this.transferStarted && !this.isFinished()) this.enterReconnecting('Signaling connection lost');
      },
      onSocketBack: () => {
        /* room re-joined; receiver will re-join too and trigger peer:joined */
      },
      onJoinError: (err) => {
        if (err.code === 'not_found' || err.code === 'cancelled' || err.code === 'expired') {
          this.fail('This transfer is no longer available.');
        }
      },
    });

    const { peers } = await this.signaling.joinRoom(this.opts.token, 'sender', this.opts.senderToken);
    this.setPhase('waiting');
    if (peers.includes('receiver')) this.maybeOffer();
    this.emit(true);
  }

  async cancel(reason = 'Cancelled by sender'): Promise<void> {
    if (this.isFinished()) return;
    this.cancelledByUs = true;
    try {
      this.dc?.send(encodeJsonMessage(MsgType.TRANSFER_CANCEL, { reason } satisfies TransferCancelBody));
    } catch {
      /* channel may be dead */
    }
    this.signaling?.sendCancel(this.opts.token, reason);
    this.cleanupPeer();
    this.signaling?.disconnect();
    this.setPhase('cancelled');
    this.emit(true);
  }

  private isFinished(): boolean {
    return this.phase === 'completed' || this.phase === 'cancelled' || this.phase === 'failed';
  }

  /** Helper (not an inline compare) so TS control-flow narrowing can't hide
   *  the 'reconnecting' case inside catch blocks. */
  private isReconnecting(): boolean {
    return this.phase === 'reconnecting';
  }

  private setPhase(phase: SenderPhase): void {
    this.phase = phase;
    this.emit(true);
  }

  private fail(message: string): void {
    if (this.isFinished()) return;
    this.errorText = message;
    this.cleanupPeer();
    this.signaling?.disconnect();
    this.setPhase('failed');
  }

  private cancelByRemote(reason: string): void {
    if (this.isFinished()) return;
    this.cleanupPeer();
    this.signaling?.disconnect();
    this.errorText = null;
    this.setPhase('cancelled');
    this.emit(true);
    void reason;
  }

  private complete(): void {
    if (this.isFinished()) return;
    this.cleanupPeer();
    this.signaling?.disconnect();
    for (const e of this.entries) {
      if (!e.failed) {
        e.verified = true;
        e.progressBytes = e.meta.size;
      }
    }
    this.setPhase('completed');
  }

  // ---------------------------------------------------------------- signaling / peer setup

  private maybeOffer(): void {
    if (this.isFinished() || this.setupInFlight) return;
    if (this.phase !== 'waiting' && this.phase !== 'reconnecting' && this.phase !== 'connecting') return;
    if (this.offerTimer) clearTimeout(this.offerTimer);
    // Debounce: a re-join burst (socket reconnect + receiver rejoin) must not
    // create multiple offers.
    this.offerTimer = setTimeout(() => {
      this.offerTimer = null;
      if (!this.isFinished() && !this.setupInFlight) void this.setupPeerConnection();
    }, 200);
  }

  private async setupPeerConnection(): Promise<void> {
    if (this.setupInFlight || this.isFinished()) return;
    this.setupInFlight = true;
    this.teardownPeer();
    const generation = ++this.generation;

    let pc: RTCPeerConnection;
    try {
      pc = new RTCPeerConnection({ iceServers: this.opts.iceServers, bundlePolicy: 'max-bundle' });
    } catch (err) {
      this.setupInFlight = false;
      this.fail('Your browser could not start a peer connection.');
      return;
    }
    this.pc = pc;

    const dc = pc.createDataChannel('ilovedoc', { ordered: true });
    dc.binaryType = 'arraybuffer';
    this.dc = dc;

    dc.onopen = () => {
      if (generation !== this.generation) return;
      this.setupInFlight = false;
      this.onChannelOpen();
    };
    dc.onmessage = (ev) => {
      if (generation !== this.generation) return;
      this.onChannelMessage(ev.data as ArrayBuffer);
    };
    dc.onclose = () => {
      if (generation !== this.generation) return;
      this.setupInFlight = false;
      this.onChannelClosed();
    };
    dc.onerror = () => {
      if (generation !== this.generation) return;
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.signaling?.sendSignal(this.opts.token, { kind: 'ice', data: ev.candidate.toJSON() });
      }
    };
    pc.onconnectionstatechange = () => {
      if (generation !== this.generation) return;
      if (pc.connectionState === 'failed') {
        this.setupInFlight = false;
        this.onChannelClosed();
      }
    };

    this.setPhase('connecting');

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (generation !== this.generation || !this.signaling) return;
      this.signaling.sendSignal(this.opts.token, { kind: 'offer', data: { type: offer.type, sdp: offer.sdp } });
    } catch {
      this.setupInFlight = false;
      if (generation === this.generation) this.fail('Could not create the WebRTC offer.');
      return;
    }

    // Watchdog: if the channel never opens, fall back to waiting/reconnecting.
    setTimeout(() => {
      if (generation !== this.generation) return;
      if (dc.readyState !== 'open') {
        this.setupInFlight = false;
        this.teardownPeer();
        if (!this.isFinished()) {
          if (this.transferStarted) this.enterReconnecting('Connection attempt timed out');
          else this.setPhase('waiting');
        }
      }
    }, DC_OPEN_TIMEOUT);
  }

  private handleSignal(payload: SignalEnvelope): void {
    const pc = this.pc;
    if (!pc) return;
    if (payload.kind === 'answer') {
      const desc = payload.data as RTCSessionDescriptionInit;
      if (desc?.type === 'answer') {
        pc.setRemoteDescription(new RTCSessionDescription(desc)).catch(() => {
          /* stale answer for an older generation — ignore */
        });
      }
    } else if (payload.kind === 'ice') {
      const cand = payload.data as RTCIceCandidateInit;
      pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {
        /* stale candidate — ignore */
      });
    }
  }

  // ---------------------------------------------------------------- channel lifecycle

  private onChannelOpen(): void {
    const pc = this.pc;
    const dc = this.dc;
    if (!pc || !dc) return;
    if (this.reconnectWatchdog) {
      clearTimeout(this.reconnectWatchdog);
      this.reconnectWatchdog = null;
    }
    this.chunkSize = negotiateChunkSize(pc.sctp?.maxMessageSize);
    for (const e of this.entries) e.totalChunks = Math.max(e.meta.size === 0 ? 0 : 1, Math.ceil(e.meta.size / this.chunkSize));
    dc.bufferedAmountLowThreshold = LOW_WATER;
    this.setPhase('transferring');
    this.transferStarted = true;
    this.startHeartbeat();
    void this.probeConnectionKind();
    this.kindProbeTimer = setInterval(() => void this.probeConnectionKind(), 10000);

    // Announce the session, then wait for the receiver's RESUME_REQUEST (fresh
    // receivers ask for chunk 0 of every file — uniform protocol).
    this.sendJson(MsgType.TRANSFER_INIT, {
      v: PROTOCOL_VERSION,
      transferId: this.opts.token,
      chunkSize: this.chunkSize,
      files: this.entries.map((e) => ({ id: e.meta.id, name: e.meta.name, size: e.meta.size, mime: e.meta.mimeType })),
    });

    const resumeGeneration = this.generation;
    const resumePromise = new Promise<ResumeRequestBody>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('resume-timeout')), RESUME_TIMEOUT);
      this.pendingResume = (body) => {
        clearTimeout(t);
        resolve(body);
      };
    });

    resumePromise
      .then((body) => {
        this.pendingResume = null;
        this.applyResume(body);
      })
      .catch(() => {
        this.pendingResume = null;
        // A stale generation's timeout must not fail the live connection.
        if (resumeGeneration === this.generation && !this.isFinished() && this.phase !== 'reconnecting') {
          this.fail('The recipient did not respond in time.');
        }
      });
  }

  private applyResume(body: ResumeRequestBody): void {
    const wanted = new Map(body.files.map((f) => [f.id, f.nextChunk]));
    const response: ResumeResponseBody = { resume: true, files: [] };
    for (const e of this.entries) {
      const next = wanted.has(e.meta.id) ? Math.min(wanted.get(e.meta.id)!, e.totalChunks) : null;
      if (next === null) {
        // Receiver omitted the file → already verified; skip it. Also release
        // any stale FILE_COMPLETE waiter from a pre-reconnect attempt.
        const waiter = this.fileCompleteWaiters.get(e.meta.id);
        if (waiter) {
          this.fileCompleteWaiters.delete(e.meta.id);
          waiter(true);
        }
        response.files.push({ id: e.meta.id, fromChunk: e.totalChunks });
        e.verified = true;
        e.progressBytes = e.meta.size;
      } else {
        response.files.push({ id: e.meta.id, fromChunk: next });
      }
    }
    this.sendJson(MsgType.RESUME_RESPONSE, response);
    void this.runTransferLoop(wanted);
  }

  private onChannelClosed(): void {
    if (this.isFinished()) return;
    this.stopHeartbeat();
    this.teardownPeer();
    if (this.cancelledByUs) return;
    this.enterReconnecting('The connection was interrupted');
  }

  private enterReconnecting(reason: string): void {
    if (this.isFinished()) return;
    this.stopHeartbeat();
    this.teardownPeer();
    this.reconnects += 1;
    if (this.reconnects > MAX_RECONNECTS) {
      this.fail('The connection was interrupted too many times. Please create a new transfer.');
      return;
    }
    this.setPhase('reconnecting');
    if (this.reconnectWatchdog) clearTimeout(this.reconnectWatchdog);
    this.reconnectWatchdog = setTimeout(() => {
      if (this.isReconnecting()) {
        this.fail('We could not re-establish the connection. Please retry the transfer.');
      }
    }, 45000);
    void reason;
  }

  // ---------------------------------------------------------------- transfer loop

  private async runTransferLoop(resumePoints: Map<number, number>): Promise<void> {
    if (this.transferLoopRunning) return;
    this.transferLoopRunning = true;
    try {
      for (const entry of this.entries) {
        if (this.isFinished() || this.isReconnecting()) return;
        if (this.dc?.readyState !== 'open') return;
        if (entry.verified || entry.failed) continue;
        await this.sendFile(entry, resumePoints.get(entry.meta.id) ?? 0);
        if (this.isFinished() || this.isReconnecting()) return;
      }
      if (this.dc?.readyState === 'open') {
        this.sendJson(MsgType.TRANSFER_COMPLETE, {
          files: this.entries.filter((e) => !e.failed).map((e) => ({ id: e.meta.id, sha256: e.hasher.digestHex() })),
        } satisfies TransferCompleteBody);
        // Receiver confirms via signaling (transfer:done); fallback timer.
        setTimeout(() => this.complete(), 30000);
      }
    } catch (err) {
      // A dropped channel unwinds the loop with "Connection lost" — that is
      // the reconnect machinery's business, not a failure.
      if (this.isReconnecting() || this.isFinished()) return;
      this.fail(err instanceof Error ? err.message : 'Transfer failed.');
    } finally {
      this.transferLoopRunning = false;
    }
  }

  /**
   * Yield to the MACROtask queue (MessageChannel is not throttled in hidden
   * tabs, unlike setTimeout). Without this, a tight chunk loop whose awaits
   * resolve as microtasks can starve timers, painting, socket.io heartbeats
   * and DataChannel drain events — freezing the whole tab.
   */
  private macrotaskYield(): Promise<void> {
    return new Promise((resolve) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = () => {
        ch.port1.close();
        resolve();
      };
      ch.port2.postMessage(0);
    });
  }

  private async sendFile(entry: FileEntry, startChunk: number): Promise<void> {
    const dc = this.dc;
    if (!dc || dc.readyState !== 'open') throw new Error('Connection lost.');

    // Resume bookkeeping: our hasher may be ahead of the receiver's state.
    if (startChunk < entry.hashedChunks) {
      await this.rehashPrefix(entry, startChunk);
    }

    this.sendJson(MsgType.FILE_START, {
      id: entry.meta.id,
      name: entry.meta.name,
      size: entry.meta.size,
      mime: entry.meta.mimeType,
      totalChunks: entry.totalChunks,
      chunkSize: this.chunkSize,
    } satisfies FileStartBody);

    entry.progressBytes = Math.max(entry.progressBytes, Math.min(startChunk * this.chunkSize, entry.meta.size));

    for (let index = startChunk; index < entry.totalChunks; index++) {
      if (this.isFinished() || dc.readyState !== 'open') throw new Error('Connection lost.');
      // Yield to the event loop every ~1 MB so timers, drains and heartbeats
      // keep firing even when file reads resolve as microtasks.
      if ((index - startChunk) % 16 === 0 && index > startChunk) {
        await this.macrotaskYield();
        if (this.isFinished() || dc.readyState !== 'open') throw new Error('Connection lost.');
      }
      if (dc.bufferedAmount > HIGH_WATER) {
        await this.waitForDrain(dc);
      }
      const offset = index * this.chunkSize;
      const end = Math.min(offset + this.chunkSize, entry.meta.size);
      let buffer: ArrayBuffer;
      try {
        buffer = await entry.file.slice(offset, end).arrayBuffer();
      } catch {
        throw new Error('Could not read the file from your device. It may have moved or been deleted.');
      }
      const payload = new Uint8Array(buffer);
      const frame = encodeChunkMessage(entry.meta.id, index, offset, payload, crc32(payload));
      try {
        dc.send(frame);
      } catch {
        throw new Error('Connection lost.');
      }
      entry.hasher.update(payload);
      entry.hashedChunks = index + 1;
      entry.progressBytes = Math.max(entry.progressBytes, end);
      this.speed.observe(this.computeSentBytes());
      this.emit(false);
    }

    // Flush everything for this file before announcing its end + hash.
    await this.waitForFullDrain(dc);
    const sha = entry.hasher.digestHex();
    this.sendJson(MsgType.FILE_END, { id: entry.meta.id, sha256: sha });

    const verified = await this.waitFileComplete(entry, sha);
    if (!verified) {
      entry.failed = true;
      throw new Error('The recipient could not verify this file (SHA-256 mismatch). Please retry the transfer.');
    }
    entry.progressBytes = entry.meta.size;
    this.speed.observe(this.computeSentBytes());
    this.emit(true);
  }

  private async rehashPrefix(entry: FileEntry, startChunk: number): Promise<void> {
    // The receiver has fewer chunks than we hashed (in-flight loss at
    // disconnect) — rebuild the hash state by re-reading the confirmed prefix.
    const hasher = new Sha256();
    for (let index = 0; index < startChunk; index++) {
      const offset = index * this.chunkSize;
      const end = Math.min(offset + this.chunkSize, entry.meta.size);
      const buffer = await entry.file.slice(offset, end).arrayBuffer();
      hasher.update(new Uint8Array(buffer));
    }
    entry.hasher = hasher;
    entry.hashedChunks = startChunk;
  }

  private waitFileComplete(entry: FileEntry, sha: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const t = setTimeout(() => {
        this.fileCompleteWaiters.delete(entry.meta.id);
        resolve(false);
      }, FILE_COMPLETE_TIMEOUT);
      this.fileCompleteWaiters.set(entry.meta.id, (ok) => {
        clearTimeout(t);
        resolve(ok);
        void sha;
      });
    });
  }

  private waitForDrain(dc: RTCDataChannel): Promise<void> {
    return new Promise((resolve) => {
      const onLow = () => {
        cleanup();
        resolve();
      };
      const cleanup = () => {
        dc.removeEventListener('bufferedamountlow', onLow);
        clearInterval(poll);
      };
      const poll = setInterval(() => {
        if (dc.readyState !== 'open' || dc.bufferedAmount <= LOW_WATER) {
          cleanup();
          resolve();
        }
      }, 30);
      if (dc.bufferedAmount <= LOW_WATER) {
        cleanup();
        resolve();
        return;
      }
      dc.addEventListener('bufferedamountlow', onLow);
    });
  }

  private waitForFullDrain(dc: RTCDataChannel): Promise<void> {
    const deadline = Date.now() + 120000;
    return new Promise((resolve, reject) => {
      const poll = setInterval(() => {
        if (dc.readyState !== 'open') {
          clearInterval(poll);
          reject(new Error('Connection lost.'));
          return;
        }
        if (dc.bufferedAmount === 0) {
          clearInterval(poll);
          resolve();
        } else if (Date.now() > deadline) {
          clearInterval(poll);
          reject(new Error('The connection stalled while sending.'));
        }
      }, 25);
    });
  }

  // ---------------------------------------------------------------- channel messages

  private onChannelMessage(data: ArrayBuffer): void {
    const msg: DecodedMessage | null = typeof data === 'string' ? null : decodeMessage(data);
    if (!msg) return;
    switch (msg.type) {
      case MsgType.PONG:
        this.lastPong = Date.now();
        break;
      case MsgType.PING:
        this.dc?.send(encodePingMessage(MsgType.PONG, msg.timestamp));
        break;
      case MsgType.RESUME_REQUEST:
        this.pendingResume?.(msg.body);
        break;
      case MsgType.FILE_ACK: {
        const body = msg.body as FileAckBody;
        const entry = this.entries.find((e) => e.meta.id === body.id);
        if (entry) entry.ackedChunks = Math.max(entry.ackedChunks, body.received);
        break;
      }
      case MsgType.FILE_COMPLETE: {
        const body = msg.body as FileCompleteBody;
        const waiter = this.fileCompleteWaiters.get(body.id);
        if (waiter) {
          this.fileCompleteWaiters.delete(body.id);
          waiter(body.verified === true);
        }
        break;
      }
      case MsgType.TRANSFER_CANCEL:
        this.cancelByRemote('The recipient stopped the transfer.');
        break;
      case MsgType.TRANSFER_ERROR: {
        const body = msg.body as TransferErrorBody;
        if (body.code === 'hash_mismatch') {
          this.fail('The recipient could not verify a file (SHA-256 mismatch). Please retry the transfer.');
        } else if (body.code === 'chunk_corrupted' || body.code === 'chunk_mismatch') {
          this.fail('Data corruption was detected during the transfer. Please retry.');
        } else if (body.code === 'write_failed') {
          this.fail('The recipient could not save the files (disk write error).');
        } else {
          this.fail(body.message || 'The recipient reported a transfer error.');
        }
        break;
      }
      default:
        break;
    }
  }

  // ---------------------------------------------------------------- heartbeat / stats

  private startHeartbeat(): void {
    this.lastPong = Date.now();
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      const dc = this.dc;
      if (!dc || dc.readyState !== 'open') return;
      if (Date.now() - this.lastPong > PONG_TIMEOUT) {
        this.onChannelClosed();
        return;
      }
      try {
        dc.send(encodePingMessage(MsgType.PING, Date.now()));
      } catch {
        this.onChannelClosed();
      }
    }, PING_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.kindProbeTimer) {
      clearInterval(this.kindProbeTimer);
      this.kindProbeTimer = null;
    }
  }

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
      if (pairId) {
        const found = stats.get(pairId);
        if (found) pair = found as Record<string, unknown>;
      }
      if (!pair) {
        stats.forEach((report: Record<string, unknown>) => {
          if (
            report.type === 'candidate-pair' &&
            (report.selected === true || report.nominated === true) &&
            (report.state === 'succeeded' || report.state === 'in-progress')
          ) {
            pair = pair ?? (report as Record<string, unknown>);
          }
        });
      }
      if (!pair) return;
      const local = pair.localCandidateId ? stats.get(pair.localCandidateId as string) : undefined;
      const remote = pair.remoteCandidateId ? stats.get(pair.remoteCandidateId as string) : undefined;
      const relay =
        (local as { candidateType?: string } | undefined)?.candidateType === 'relay' ||
        (remote as { candidateType?: string } | undefined)?.candidateType === 'relay';
      const kind: ConnectionKind = relay ? 'relay' : 'direct';
      // Candidate-pair reports expose currentRoundTripTime in seconds.
      const crtt = pair.currentRoundTripTime;
      const rtt = typeof crtt === 'number' && Number.isFinite(crtt) && crtt >= 0
        ? Math.round(crtt * 1000)
        : null;
      const kindChanged = kind !== this.connectionKind;
      const rttChanged = rtt !== null && (this.rttMs === null || Math.abs(rtt - this.rttMs) >= 5);
      this.connectionKind = kind;
      this.rttMs = rtt ?? this.rttMs;
      if (kindChanged) {
        this.signaling?.sendState(this.opts.token, kind === 'relay' ? 'connected-relay' : 'connected-direct');
      }
      if (kindChanged || rttChanged) this.emit(true);
    } catch {
      /* stats unavailable — keep unknown */
    }
  }

  private computeSentBytes(): number {
    let total = 0;
    for (const e of this.entries) total += e.verified ? e.meta.size : Math.min(e.progressBytes, e.meta.size);
    return total;
  }

  private buildState(): SenderState {
    const transferred = this.computeSentBytes();
    const speedBps = this.speed.bps;
    return {
      phase: this.phase,
      error: this.errorText,
      connectionKind: this.connectionKind,
      files: this.entries.map((e) => ({
        fileId: e.meta.id,
        name: e.meta.name,
        size: e.meta.size,
        transferred: e.verified ? e.meta.size : Math.min(e.progressBytes, e.meta.size),
        status: e.failed ? 'error' : e.verified ? 'verified' : e.progressBytes > 0 ? 'active' : 'pending',
        error: e.failed ? 'verification failed' : undefined,
      })),
      totalBytes: this.totalBytes,
      transferredBytes: transferred,
      speedBps,
      etaSeconds: this.phase === 'transferring' ? etaFromSpeed(speedBps, this.totalBytes - transferred) : null,
      rttMs: this.rttMs,
      chunkSize: this.dc ? this.chunkSize : null,
    };
  }

  private emit(immediate: boolean): void {
    const fire = () => {
      this.lastEmit = Date.now();
      this.emitScheduled = false;
      this.opts.onState(this.buildState());
    };
    if (immediate) {
      if (this.emitScheduled) {
        /* scheduled emit becomes immediate */
      }
      fire();
      return;
    }
    if (this.emitScheduled) return;
    const elapsed = Date.now() - this.lastEmit;
    if (elapsed >= 250) {
      fire();
    } else {
      this.emitScheduled = true;
      setTimeout(fire, 250 - elapsed);
    }
  }

  // ---------------------------------------------------------------- teardown

  private teardownPeer(): void {
    this.stopHeartbeat();
    // Release in-flight waiters so a dying loop unwinds instead of blocking
    // the next (reconnected) transfer loop from starting.
    for (const waiter of this.fileCompleteWaiters.values()) waiter(false);
    this.fileCompleteWaiters.clear();
    const dc = this.dc;
    const pc = this.pc;
    this.dc = null;
    this.pc = null;
    this.generation += 1; // invalidate handlers of the old generation
    if (dc) {
      try {
        dc.close();
      } catch {
        /* ignore */
      }
    }
    if (pc) {
      try {
        pc.getSenders().forEach((s) => {
          try {
            s.track?.stop();
          } catch {
            /* no tracks */
          }
        });
        pc.close();
      } catch {
        /* ignore */
      }
    }
  }

  private cleanupPeer(): void {
    this.teardownPeer();
    if (this.reconnectWatchdog) {
      clearTimeout(this.reconnectWatchdog);
      this.reconnectWatchdog = null;
    }
    if (this.offerTimer) {
      clearTimeout(this.offerTimer);
      this.offerTimer = null;
    }
  }

  private sendJson(type: number, body: unknown): void {
    const dc = this.dc;
    if (dc && dc.readyState === 'open') {
      try {
        dc.send(encodeJsonMessage(type as never, body));
      } catch {
        /* channel closing */
      }
    }
  }
}
