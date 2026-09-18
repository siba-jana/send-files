/**
 * Receiver-side recent received history — pure localStorage convenience
 * feature, mirroring the sender's `recent.ts`. Stores only privacy-safe
 * metadata the receiver already saw during the transfer (sender display
 * name, file count, total size, outcome, and the share code when the
 * receiver joined by code); never file names, links, or passwords.
 * Survives reloads, capped at 6.
 *
 * Exposed as a tiny external store so React can subscribe without
 * setState-in-effect (matches the capability-probe pattern used elsewhere).
 */

import { useSyncExternalStore } from "react";

export type RecentReceivedStatus = "completed" | "cancelled" | "failed";

export interface RecentReceived {
  /** 6-digit share code when the receiver joined by code; null via link. */
  code: string | null;
  /** Sender display name as shown during the transfer (already public to
   * the receiver); null when the sender stayed anonymous. */
  senderName: string | null;
  fileCount: number;
  totalBytes: number;
  /** epoch milliseconds */
  createdAt: number;
  status: RecentReceivedStatus;
}

const STORAGE_KEY = "ilovedoc:received-v1";
const MAX_ENTRIES = 6;
const EMPTY: RecentReceived[] = [];

function isReceivedEntry(value: unknown): value is RecentReceived {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    (v.code === null || (typeof v.code === "string" && v.code.length === 6)) &&
    (v.senderName === null || typeof v.senderName === "string") &&
    typeof v.fileCount === "number" &&
    typeof v.totalBytes === "number" &&
    typeof v.createdAt === "number" &&
    typeof v.status === "string" &&
    ["completed", "cancelled", "failed"].includes(v.status)
  );
}

/** Read history straight from storage; [] when unavailable. */
function readFromStorage(): RecentReceived[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed
      .filter(isReceivedEntry)
      .map((e) => ({ ...e, code: e.code ?? null, senderName: e.senderName ?? null }))
      .slice(0, MAX_ENTRIES);
  } catch {
    return EMPTY;
  }
}

// ------------------------------------------------------------------ store

const listeners = new Set<() => void>();
/** Cached snapshot (null until first client-side read — SSR returns []). */
let snapshot: RecentReceived[] | null = null;

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): RecentReceived[] {
  if (snapshot === null) snapshot = readFromStorage();
  return snapshot;
}

function getServerSnapshot(): RecentReceived[] {
  return EMPTY;
}

/** React hook: the receiver's recent received history (client only). */
export function useRecentReceived(): RecentReceived[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// ------------------------------------------------------------------ writers

/** Prepend an entry (most recent first), dedupe by createdAt+code, cap. */
export function addRecentReceived(entry: RecentReceived): void {
  if (typeof window === "undefined") return;
  try {
    const current = readFromStorage().filter(
      (e) => !(e.createdAt === entry.createdAt && e.code === entry.code),
    );
    const next = [entry, ...current].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    snapshot = next;
    notify();
  } catch {
    /* storage full or blocked — history is best-effort */
  }
}

export function clearRecentReceived(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    snapshot = EMPTY;
    notify();
  } catch {
    /* ignore */
  }
}
