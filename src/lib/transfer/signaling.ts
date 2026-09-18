/**
 * Typed socket.io signaling client for ilovedoc.org.
 *
 * Connects through the sandbox gateway: io('/?XTransformPort=3003') — the
 * signaling service listens on port 3003 with socket.io path '/' (see
 * docs/SPEC.md §1/§5 and examples/websocket).
 *
 * Features beyond a bare socket:
 *  - dynamic import (keeps socket.io out of the initial page bundle)
 *  - automatic re-join after socket.io reconnection (rooms are per-connection)
 *  - typed events + acks matching the server contract
 */

import type { Socket } from 'socket.io-client';

export type Role = 'sender' | 'receiver';

export interface SignalEnvelope {
  kind: 'offer' | 'answer' | 'ice';
  data: unknown;
}

export class SignalingError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message || code);
    this.name = 'SignalingError';
  }
}

interface AckResult<T = undefined> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export interface SignalingHandlers {
  onSignal?: (from: Role, payload: SignalEnvelope) => void;
  onPeerJoined?: (role: Role) => void;
  onPeerLeft?: (role: Role, reason: 'disconnected' | 'replaced') => void;
  onCancelled?: (from: Role, reason?: string) => void;
  onDone?: (from: Role) => void;
  onPeerState?: (from: Role, state: string) => void;
  /** Our own socket dropped (engine may need to enter reconnecting state). */
  onSocketDown?: () => void;
  /** Our socket reconnected AND re-joined the room successfully. */
  onSocketBack?: () => void;
  /** Re-join after reconnect failed permanently. */
  onJoinError?: (err: SignalingError) => void;
}

interface JoinState {
  token: string;
  role: Role;
  auth: string;
}

export class SignalingClient {
  private socket: Socket;
  private join: JoinState | null = null;
  private disposed = false;
  private downNotified = false;

  private constructor(socket: Socket, private readonly handlers: SignalingHandlers) {
    this.socket = socket;
    this.wire();
  }

  /** Connect (dynamic import) and resolve once the socket is live. */
  static async connect(handlers: SignalingHandlers): Promise<SignalingClient> {
    const { io } = await import('socket.io-client');
    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 12,
      reconnectionDelay: 700,
      reconnectionDelayMax: 4000,
      timeout: 12000,
    });
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new SignalingError('connect_timeout', 'Could not reach the signaling server.')), 13000);
      socket.once('connect', () => {
        clearTimeout(t);
        resolve();
      });
      socket.once('connect_error', (err: Error) => {
        clearTimeout(t);
        reject(new SignalingError('connect_failed', err.message));
      });
    });
    return new SignalingClient(socket, handlers);
  }

  private wire(): void {
    this.socket.on('signal', (msg: { from: Role; payload: SignalEnvelope }) => {
      this.handlers.onSignal?.(msg.from, msg.payload);
    });
    this.socket.on('peer:joined', (msg: { role: Role }) => this.handlers.onPeerJoined?.(msg.role));
    this.socket.on('peer:left', (msg: { role: Role; reason: 'disconnected' | 'replaced' }) =>
      this.handlers.onPeerLeft?.(msg.role, msg.reason),
    );
    this.socket.on('transfer:cancelled', (msg: { from: Role; reason?: string }) =>
      this.handlers.onCancelled?.(msg.from, msg.reason),
    );
    this.socket.on('transfer:done', (msg: { from: Role }) => this.handlers.onDone?.(msg.from));
    this.socket.on('transfer:state', (msg: { from: Role; state: string }) => this.handlers.onPeerState?.(msg.from, msg.state));

    this.socket.on('disconnect', () => {
      if (!this.downNotified) {
        this.downNotified = true;
        this.handlers.onSocketDown?.();
      }
    });
    this.socket.on('connect', async () => {
      if (!this.downNotified) return;
      this.downNotified = false;
      // Room membership is per-connection — re-join after reconnection.
      if (this.join && !this.disposed) {
        try {
          await this.rawJoin(this.join);
          this.handlers.onSocketBack?.();
        } catch (err) {
          this.handlers.onJoinError?.(err as SignalingError);
        }
      }
    });
  }

  private rawJoin(state: JoinState): Promise<{ peers: Role[] }> {
    return new Promise((resolve, reject) => {
      this.socket.timeout(12000).emit(
        'transfer:join',
        { token: state.token, role: state.role, auth: state.auth },
        (err: unknown, ack: AckResult<{ peers: Role[] }> | undefined) => {
          if (err || !ack) return reject(new SignalingError('join_timeout', 'Join request timed out.'));
          if (!ack.ok) return reject(new SignalingError(ack.error?.code ?? 'join_failed', ack.error?.message));
          resolve(ack.data ?? { peers: [] });
        },
      );
    });
  }

  /** Join (or re-join) the transfer room; resolves with the roles already present. */
  async joinRoom(token: string, role: Role, auth: string): Promise<{ peers: Role[] }> {
    this.join = { token, role, auth };
    return this.rawJoin(this.join);
  }

  sendSignal(token: string, payload: SignalEnvelope): void {
    this.socket.emit('signal', { token, payload });
  }

  sendState(token: string, state: string): void {
    this.socket.emit('transfer:state', { token, state });
  }

  sendDone(token: string): void {
    this.socket.timeout(10000).emit('transfer:done', { token }, () => {});
  }

  sendCancel(token: string, reason?: string): void {
    this.socket.timeout(10000).emit('transfer:cancel', { token, reason }, () => {});
  }

  get connected(): boolean {
    return this.socket.connected;
  }

  disconnect(): void {
    this.disposed = true;
    this.join = null;
    this.socket.removeAllListeners();
    this.socket.disconnect();
  }
}
