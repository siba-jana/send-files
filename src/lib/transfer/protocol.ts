/**
 * ilovedoc.org — WebRTC DataChannel transfer protocol (v1).
 *
 * Every DataChannel message is binary. Byte 0 is the message type.
 * JSON control messages are [type:1][utf8 JSON].
 * FILE_CHUNK is a 23-byte big-endian header followed by the raw payload.
 *
 * See docs/SPEC.md §6.
 */

export const PROTOCOL_VERSION = 1;

export const MsgType = {
  TRANSFER_INIT: 0x01,
  FILE_START: 0x02,
  FILE_CHUNK: 0x03,
  FILE_END: 0x04,
  FILE_ACK: 0x05,
  FILE_COMPLETE: 0x06,
  TRANSFER_COMPLETE: 0x07,
  TRANSFER_CANCEL: 0x08,
  TRANSFER_ERROR: 0x09,
  PING: 0x0a,
  PONG: 0x0b,
  RESUME_REQUEST: 0x0c,
  RESUME_RESPONSE: 0x0d,
} as const;

export type MsgTypeValue = (typeof MsgType)[keyof typeof MsgType];

/** FILE_CHUNK header size in bytes (see decodeChunk). */
export const CHUNK_HEADER_SIZE = 23;

export const MIN_CHUNK_PAYLOAD = 16384;
export const MAX_CHUNK_PAYLOAD = 65536;

/** ACK cadence: receiver acknowledges every N chunks (plus at FILE_END). */
export const ACK_EVERY_CHUNKS = 128;

// ---------------------------------------------------------------- JSON bodies

export interface InitFile {
  id: number;
  name: string;
  size: number;
  mime: string;
  /** Optional file modification time (epoch ms) — preserved in ZIP entries. */
  mtime?: number;
}

export interface TransferInitBody {
  v: number;
  transferId: string;
  chunkSize: number;
  files: InitFile[];
}

export interface FileStartBody {
  id: number;
  name: string;
  size: number;
  mime: string;
  totalChunks: number;
  chunkSize: number;
}

export interface FileEndBody {
  id: number;
  sha256: string;
}

export interface FileAckBody {
  id: number;
  received: number;
}

export interface FileCompleteBody {
  id: number;
  verified: boolean;
  sha256: string;
}

export interface TransferCompleteBody {
  files: { id: number; sha256: string }[];
}

export interface TransferCancelBody {
  reason: string;
}

export interface TransferErrorBody {
  code: string;
  message: string;
}

export interface ResumeRequestBody {
  files: { id: number; nextChunk: number }[];
}

export interface ResumeResponseBody {
  resume: boolean;
  files: { id: number; fromChunk: number }[];
}

// ---------------------------------------------------------------- decoded forms

export interface DecodedChunk {
  fileId: number;
  chunkIndex: number;
  byteOffset: number;
  byteLength: number;
  crc32: number;
  /** View into the received message buffer — no copy. */
  data: Uint8Array;
}

export type DecodedMessage =
  | { type: typeof MsgType.TRANSFER_INIT; body: TransferInitBody }
  | { type: typeof MsgType.FILE_START; body: FileStartBody }
  | { type: typeof MsgType.FILE_CHUNK; chunk: DecodedChunk }
  | { type: typeof MsgType.FILE_END; body: FileEndBody }
  | { type: typeof MsgType.FILE_ACK; body: FileAckBody }
  | { type: typeof MsgType.FILE_COMPLETE; body: FileCompleteBody }
  | { type: typeof MsgType.TRANSFER_COMPLETE; body: TransferCompleteBody }
  | { type: typeof MsgType.TRANSFER_CANCEL; body: TransferCancelBody }
  | { type: typeof MsgType.TRANSFER_ERROR; body: TransferErrorBody }
  | { type: typeof MsgType.PING; timestamp: number }
  | { type: typeof MsgType.PONG; timestamp: number }
  | { type: typeof MsgType.RESUME_REQUEST; body: ResumeRequestBody }
  | { type: typeof MsgType.RESUME_RESPONSE; body: ResumeResponseBody };

// ---------------------------------------------------------------- encoding

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encodeJsonMessage(type: MsgTypeValue, body: unknown): ArrayBuffer {
  const json = encoder.encode(JSON.stringify(body));
  const out = new Uint8Array(1 + json.length);
  out[0] = type;
  out.set(json, 1);
  return out.buffer;
}

/**
 * Build a FILE_CHUNK frame. `payload` is copied into the outgoing buffer and
 * its CRC-32 is computed here.
 */
export function encodeChunkMessage(
  fileId: number,
  chunkIndex: number,
  byteOffset: number,
  payload: Uint8Array,
  crc: number,
): ArrayBuffer {
  const out = new Uint8Array(CHUNK_HEADER_SIZE + payload.length);
  const view = new DataView(out.buffer);
  out[0] = MsgType.FILE_CHUNK;
  view.setUint16(1, fileId, false);
  view.setUint32(3, chunkIndex, false);
  view.setBigUint64(7, BigInt(byteOffset), false);
  view.setUint32(15, payload.length, false);
  view.setUint32(19, crc, false);
  out.set(payload, CHUNK_HEADER_SIZE);
  return out.buffer;
}

export function encodePingMessage(type: typeof MsgType.PING | typeof MsgType.PONG, timestamp: number): ArrayBuffer {
  const out = new Uint8Array(9);
  const view = new DataView(out.buffer);
  out[0] = type;
  view.setBigUint64(1, BigInt(timestamp), false);
  return out.buffer;
}

// ---------------------------------------------------------------- decoding

/**
 * Decode any incoming DataChannel message. Returns null for unknown types or
 * malformed frames (the caller should treat that as a protocol error).
 */
export function decodeMessage(buffer: ArrayBuffer): DecodedMessage | null {
  if (buffer.byteLength < 1) return null;
  const bytes = new Uint8Array(buffer);
  const type = bytes[0];
  switch (type) {
    case MsgType.FILE_CHUNK: {
      if (buffer.byteLength < CHUNK_HEADER_SIZE) return null;
      const view = new DataView(buffer);
      return {
        type,
        chunk: {
          fileId: view.getUint16(1, false),
          chunkIndex: view.getUint32(3, false),
          byteOffset: Number(view.getBigUint64(7, false)),
          byteLength: view.getUint32(15, false),
          crc32: view.getUint32(19, false),
          data: bytes.subarray(CHUNK_HEADER_SIZE),
        },
      };
    }
    case MsgType.PING:
    case MsgType.PONG: {
      if (buffer.byteLength < 9) return null;
      const view = new DataView(buffer);
      return { type, timestamp: Number(view.getBigUint64(1, false)) };
    }
    default: {
      let body: unknown;
      try {
        body = JSON.parse(decoder.decode(bytes.subarray(1)));
      } catch {
        return null;
      }
      return { type, body } as DecodedMessage;
    }
  }
}

/** Negotiate the chunk payload size for a connected RTCPeerConnection. */
export function negotiateChunkSize(maxMessageSize: number | undefined): number {
  const limit = typeof maxMessageSize === 'number' && maxMessageSize > 0 ? maxMessageSize : 65536;
  const payload = Math.min(MAX_CHUNK_PAYLOAD, Math.max(MIN_CHUNK_PAYLOAD, limit - CHUNK_HEADER_SIZE));
  return Math.floor(payload / 4) * 4;
}
