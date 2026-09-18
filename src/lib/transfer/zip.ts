/**
 * Minimal client-side ZIP writer (STORED, no compression) for the receiver's
 * "Download all as ZIP" action. Pure TypeScript + the existing CRC-32
 * implementation — no dependencies, no server involvement.
 *
 * Limits: classic ZIP (no ZIP64) supports ≤ 65,535 entries and ≤ 4 GB-1 per
 * file / for the whole archive. `canZip()` guards those limits; the UI hides
 * the ZIP button when they are exceeded (per-file downloads still work).
 *
 * Filename safety: entries are flattened via sanitizeFileName (no path
 * traversal) and de-duplicated, exactly like disk-mode saving.
 */

import { crc32 } from './crc32';
import { sanitizeFileName } from './sinks';

export interface ZipEntryInput {
  name: string;
  blob: Blob;
  /** Known size (e.g. the verified file size) — when provided, the entry
   * data must match it exactly or the build fails loudly instead of
   * writing a silently-empty archive. */
  expectedSize?: number;
}

const CLASSIC_MAX_SIZE = 0xffffffff; // 4 GB - 1
const CLASSIC_MAX_ENTRIES = 0xffff;

/** Zip limits check — also requires every entry to have an in-memory blob. */
export function canZip(
  files: { name: string; size: number; blob?: Blob | null }[],
): boolean {
  if (files.length === 0 || files.length > CLASSIC_MAX_ENTRIES) return false;
  let total = 0;
  for (const f of files) {
    if (!f.blob) return false;
    if (f.size > CLASSIC_MAX_SIZE) return false;
    total += f.size;
    if (total > CLASSIC_MAX_SIZE) return false;
  }
  return true;
}

/** DOS date/time pair (ZIP epoch starts at 1980; clamped). */
function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

function uniqueEntryName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) {
    taken.add(name);
    return name;
  }
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let i = 2;
  let candidate = `${stem} (${i})${ext}`;
  while (taken.has(candidate)) {
    i += 1;
    candidate = `${stem} (${i})${ext}`;
  }
  taken.add(candidate);
  return candidate;
}

/**
 * Build the archive. Reads each blob fully into memory (the receiver only
 * offers ZIP for memory-mode results, which are already in memory).
 */
export async function buildZipBlob(files: ZipEntryInput[]): Promise<Blob> {
  const encoder = new TextEncoder();
  const stamp = dosDateTime(new Date());
  const parts: BlobPart[] = [];
  const central: Uint8Array<ArrayBuffer>[] = [];
  const taken = new Set<string>();
  let offset = 0;

  for (const file of files) {
    const name = uniqueEntryName(sanitizeFileName(file.name), taken);
    const nameBytes = encoder.encode(name);
    const dataBuffer = await file.blob.arrayBuffer();
    const data = new Uint8Array(dataBuffer);
    const size = data.length;
    // Defensive integrity gate: never write a mismatched (e.g. empty) entry
    // silently — a wrong blob is a hard error, not a degenerate archive.
    const expected = file.expectedSize ?? file.blob.size;
    if (size !== expected) {
      throw new Error(
        `zip integrity: "${name}" read ${size} bytes but expected ${expected}`
      );
    }
    const crc = crc32(data);

    // ---- local file header (30 bytes + name) ----
    const lfhBuffer = new ArrayBuffer(30 + nameBytes.length);
    const lfh = new Uint8Array(lfhBuffer);
    const lv = new DataView(lfhBuffer);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // flags: UTF-8 names
    lv.setUint16(8, 0, true); // method: stored
    lv.setUint16(10, stamp.time, true);
    lv.setUint16(12, stamp.date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true); // compressed size
    lv.setUint32(22, size, true); // uncompressed size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // extra length
    lfh.set(nameBytes, 30);
    parts.push(lfh, data);

    // ---- central directory header (46 bytes + name) ----
    const cdhBuffer = new ArrayBuffer(46 + nameBytes.length);
    const cdh = new Uint8Array(cdhBuffer);
    const cv = new DataView(cdhBuffer);
    cv.setUint32(0, 0x02014b50, true); // signature
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0x0800, true); // flags: UTF-8 names
    cv.setUint16(10, 0, true); // method: stored
    cv.setUint16(12, stamp.time, true);
    cv.setUint16(14, stamp.date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); // extra length
    cv.setUint16(32, 0, true); // comment length
    cv.setUint16(34, 0, true); // disk number start
    cv.setUint16(36, 0, true); // internal attributes
    cv.setUint32(38, 0, true); // external attributes
    cv.setUint32(42, offset, true); // local header offset
    cdh.set(nameBytes, 46);
    central.push(cdh);

    offset += lfh.length + size;
  }

  // ---- end of central directory (22 bytes) ----
  const cdSize = central.reduce((sum, c) => sum + c.length, 0);
  const eocdBuffer = new ArrayBuffer(22);
  const eocd = new Uint8Array(eocdBuffer);
  const ev = new DataView(eocdBuffer);
  ev.setUint32(0, 0x06054b50, true); // signature
  ev.setUint16(4, 0, true); // this disk
  ev.setUint16(6, 0, true); // cd start disk
  ev.setUint16(8, files.length, true); // entries on this disk
  ev.setUint16(10, files.length, true); // total entries
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true); // cd offset
  ev.setUint16(20, 0, true); // comment length
  parts.push(...central, eocd);

  return new Blob(parts, { type: 'application/zip' });
}
