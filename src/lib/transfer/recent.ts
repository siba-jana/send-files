/**
 * Sender-side recent transfer history — pure localStorage convenience
 * feature. Stores only privacy-safe metadata (code, counts, sizes, status);
 * never file names, links, or passwords. Survives reloads, capped at 6.
 *
 * Exposed as a tiny external store so React can subscribe without
 * setState-in-effect (matches the capability-probe pattern used elsewhere).
 */

import { useSyncExternalStore } from "react";

export type RecentTransferStatus =
  | "completed"
  | "cancelled"
  | "failed"
  | "expired";

export interface RecentTransfer {
  /** 6-digit share code */
  code: string;
  fileCount: number;
  totalBytes: number;
  /** epoch milliseconds */
  createdAt: number;
  status: RecentTransferStatus;
}

const STORAGE_KEY = "ilovedoc:recent-v1";
const MAX_ENTRIES = 6;
const EMPTY: RecentTransfer[] = [];

function isRecentEntry(value: unknown): value is RecentTransfer {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.code === "string" &&
    v.code.length === 6 &&
    typeof v.fileCount === "number" &&
    typeof v.totalBytes === "number" &&
    typeof v.createdAt === "number" &&
    typeof v.status === "string" &&
    ["completed", "cancelled", "failed", "expired"].includes(v.status)
  );
}

/** Read history straight from storage; [] when unavailable. */
function readFromStorage(): RecentTransfer[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed.filter(isRecentEntry).slice(0, MAX_ENTRIES);
  } catch {
    return EMPTY;
  }
}

// ------------------------------------------------------------------ store

const listeners = new Set<() => void>();
/** Cached snapshot (null until first client-side read — SSR returns []). */
let snapshot: RecentTransfer[] | null = null;

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): RecentTransfer[] {
  if (snapshot === null) snapshot = readFromStorage();
  return snapshot;
}

function getServerSnapshot(): RecentTransfer[] {
  return EMPTY;
}

/** React hook: the sender's recent transfer history (client only). */
export function useRecentTransfers(): RecentTransfer[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// ------------------------------------------------------------------ writers

/** Prepend an entry (most recent first), dedupe by code, cap the list. */
export function addRecentTransfer(entry: RecentTransfer): void {
  if (typeof window === "undefined") return;
  try {
    const current = readFromStorage().filter((e) => e.code !== entry.code);
    const next = [entry, ...current].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    snapshot = next;
    notify();
  } catch {
    /* storage full or blocked — history is best-effort */
  }
}

export function clearRecentTransfers(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    snapshot = EMPTY;
    notify();
  } catch {
    /* ignore */
  }
}

// ------------------------------------------------------------------ helpers

/** Compact relative time: "just now", "5 min ago", "3 h ago", "2 d ago". */
export function formatRelativeTime(epochMs: number, now = Date.now()): string {
  const diff = Math.max(0, now - epochMs);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(epochMs).toLocaleDateString();
}
