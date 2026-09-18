/**
 * Receiver-side file sinks.
 *
 * MemorySink accumulates chunk views into an array and produces a Blob at the
 * end (browsers may spill Blob storage to disk under memory pressure).
 * FileSystemSink streams chunks directly to disk via the File System Access
 * API — the file is never held in memory.
 *
 * Sinks stay open across WebRTC reconnects so interrupted transfers can
 * resume appending from the last written chunk.
 */

import { dirPickerSupported, fsAccessSupported } from './browser';

// ---------------------------------------------------------------- File System Access types
// lib.dom lacks the (Chromium-origin) File System Access API — declare the
// minimal surface we use.

export interface WritableLike {
  write(data: unknown): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
}

interface SaveFileHandleLike {
  createWritable(): Promise<WritableLike>;
}

interface DirHandleLike {
  getFileHandle(name: string, options: { create: true }): Promise<SaveFileHandleLike>;
}

declare global {
  interface Window {
    showSaveFilePicker?: (options?: { suggestedName?: string }) => Promise<SaveFileHandleLike>;
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<DirHandleLike>;
  }
}

export interface SinkResult {
  kind: 'memory' | 'filesystem';
  name: string;
  blob?: Blob;
  /** true when bytes already landed on disk as they arrived */
  savedToDisk: boolean;
}

export interface FileSink {
  readonly kind: 'memory' | 'filesystem';
  write(chunk: Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
  getResult(): SinkResult;
}

export class MemorySink implements FileSink {
  readonly kind = 'memory' as const;
  private parts: BlobPart[] = [];
  private closed = false;

  constructor(public name: string) {}

  async write(chunk: Uint8Array): Promise<void> {
    if (this.closed) throw new Error('sink closed');
    // A Uint8Array view is a valid BlobPart; TS's ArrayBufferLike generics
    // disagree, hence the cast.
    this.parts.push(chunk as unknown as BlobPart);
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  async abort(): Promise<void> {
    this.closed = true;
    this.parts = [];
  }

  getResult(): SinkResult {
    return { kind: 'memory', name: this.name, blob: new Blob(this.parts), savedToDisk: false };
  }
}

export class FileSystemSink implements FileSink {
  readonly kind = 'filesystem' as const;
  private closed = false;

  constructor(
    public name: string,
    private writable: WritableLike,
  ) {}

  async write(chunk: Uint8Array): Promise<void> {
    if (this.closed) throw new Error('sink closed');
    await this.writable.write(chunk);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.writable.close();
  }

  async abort(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      if (this.writable.abort) await this.writable.abort();
      else await this.writable.close();
    } catch {
      /* best effort */
    }
  }

  getResult(): SinkResult {
    return { kind: 'filesystem', name: this.name, savedToDisk: true };
  }
}

// ---------------------------------------------------------------- naming

/** Make a filename safe for saving (no path traversal, no control chars). */
export function sanitizeFileName(name: string): string {
  const base = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim();
  const safe = base || 'file';
  return safe.length > 180 ? safe.slice(0, 177) + '...' : safe;
}

function uniqueName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) {
    taken.add(name);
    return name;
  }
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let i = 1;
  let candidate = `${stem} (${i})${ext}`;
  while (taken.has(candidate)) {
    i += 1;
    candidate = `${stem} (${i})${ext}`;
  }
  taken.add(candidate);
  return candidate;
}

// ---------------------------------------------------------------- pickers

export interface PendingFile {
  id: number;
  name: string;
  size: number;
}

/**
 * Ask the user where to save the incoming files (MUST be called directly from
 * a click handler — browsers require transient user activation for pickers).
 *
 * - single file → showSaveFilePicker
 * - multiple files → showDirectoryPicker (when available), else one
 *   showSaveFilePicker at a time is too chatty, so fall back to memory.
 *
 * Returns a Map<fileId, FileSink>, or null when the user cancelled the picker
 * (caller should keep showing the confirm screen in that case).
 */
export async function pickSaveTargets(files: PendingFile[]): Promise<Map<number, FileSink> | null> {
  const savePicker = window.showSaveFilePicker;
  const dirPicker = window.showDirectoryPicker;
  if (!fsAccessSupported() || !savePicker) return null;
  const taken = new Set<string>();
  const sinks = new Map<number, FileSink>();
  const saveOne = async (file: PendingFile) => {
    const handle = await savePicker({ suggestedName: sanitizeFileName(file.name) });
    sinks.set(file.id, new FileSystemSink(file.name, await handle.createWritable()));
  };
  try {
    if (files.length === 1) {
      await saveOne(files[0]);
      return sinks;
    }
    if (dirPicker) {
      const dir = await dirPicker({ mode: 'readwrite' });
      for (const f of files) {
        const name = uniqueName(sanitizeFileName(f.name), taken);
        const handle = await dir.getFileHandle(name, { create: true });
        sinks.set(f.id, new FileSystemSink(f.name, await handle.createWritable()));
      }
      return sinks;
    }
    // Multiple files, no directory picker: sequential save pickers.
    for (const f of files) {
      await saveOne(f);
    }
    return sinks;
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === 'AbortError' || name === 'NotAllowedError') return null; // user cancelled
    throw err;
  }
}

/** In-memory sinks for every file (fallback path). */
export function memorySinks(files: PendingFile[]): Map<number, FileSink> {
  const sinks = new Map<number, FileSink>();
  for (const f of files) sinks.set(f.id, new MemorySink(sanitizeFileName(f.name)));
  return sinks;
}
