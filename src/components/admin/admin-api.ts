"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ---------------------------------------------------------------- types */

export interface SignalingStats {
  ok: true;
  service: string;
  pid: number;
  startedAt: number;
  uptimeSec: number;
  sockets: number;
  rooms: number;
  roomsDetail: Array<{ token: string; sender: boolean; receiver: boolean }>;
  counters: {
    connections: number;
    refused: number;
    joins: number;
    signals: number;
    transfersDone: number;
    transfersCancelled: number;
  };
  perIp: { trackedIps: number; top: Array<{ ip: string; concurrent: number }> };
  recentErrors: Array<{ ts: number; scope: string; message: string }>;
  limits: Record<string, number>;
  memory: { rss: number; heapUsed: number };
}

export type SignalingSnapshot = SignalingStats | { ok: false; status: number };

export interface OverviewResponse {
  transfers: {
    total: number;
    byStatus: Record<string, number>;
    files: number;
    bytes: string;
    allTime: {
      transfersCreated: string;
      deliveriesCompleted: string;
      filesDelivered: string;
      bytesDelivered: string;
    };
    created24h: number;
    completed24h: number;
  };
  series24h: Array<{ t: number; created: number; completed: number; errors: number }>;
  errors: {
    total: number;
    unresolved: number;
    last24h: number;
    errors24h: number;
    byLevel: Record<string, number>;
    bySource: Record<string, number>;
    series24h: Array<{ t: number; error: number; warn: number; info: number }>;
  };
  recentEvents: Array<{
    id: string;
    eventType: string;
    metadata: string | null;
    createdAt: string;
    token: string;
    transferStatus: string;
  }>;
  signaling: SignalingSnapshot;
  rateLimits: {
    activeBuckets: number;
    top: Array<{ type: string; count: number; resetInSec: number }>;
  };
  system: {
    uptimeSec: number;
    rssBytes: number;
    heapUsedBytes: number;
    nodeVersion: string;
    platform: string;
    nodeEnv: string;
    pid: number;
    dbBytes: number;
    turnConfigured: boolean;
    pepperSet: boolean;
  };
  serverLog: { lines: string[]; bytes: number };
  session: { expiresAt: number };
  generatedAt: string;
}

export interface TransferRow {
  id: string;
  publicToken: string;
  status: string;
  senderName: string | null;
  passwordProtected: boolean;
  downloads: number;
  maxDownloads: number;
  createdAt: string;
  expiresAt: string;
  fileCount: number;
  totalBytes: string;
  lastEventAt: string | null;
  lastEventType: string | null;
}

export interface TransfersResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  rows: TransferRow[];
}

export interface TransferDetailResponse {
  transfer: {
    id: string;
    publicToken: string;
    status: string;
    senderName: string | null;
    passwordProtected: boolean;
    downloads: number;
    maxDownloads: number;
    createdAt: string;
    expiresAt: string;
    updatedAt: string;
  };
  files: Array<{
    id: string;
    position: number;
    fileName: string;
    mimeType: string;
    size: string;
  }>;
  events: Array<{
    id: string;
    eventType: string;
    metadata: string | null;
    createdAt: string;
  }>;
}

export interface ErrorLogEntry {
  id: string;
  level: string;
  source: string;
  message: string;
  stack: string | null;
  url: string | null;
  userAgent: string | null;
  ip: string | null;
  context: string | null;
  resolved: boolean;
  createdAt: string;
}

export interface LogsResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  rows: ErrorLogEntry[];
}

export interface SessionResponse {
  authenticated: boolean;
  usingDefaultPassword: boolean;
  session: { expiresAt: number } | null;
}

/* ---------------------------------------------------------------- fetch */

/**
 * Fetch helper for the admin APIs. Throws Error("unauthorized") only for the
 * auth guard's 401 {error:"unauthorized"} — admin-app listens for the matching
 * window event and flips to the login screen (session expiry while the
 * dashboard is open). The login endpoint's own 401 (invalid credentials) is
 * surfaced as a normal error instead.
 */
export async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) detail = body.error;
    } catch {
      /* keep status detail */
    }
    if (res.status === 401 && detail === "unauthorized") {
      window.dispatchEvent(new CustomEvent("ilovedoc:admin-unauthorized"));
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

/* ---------------------------------------------------------------- polling */

export interface PollingState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  lastUpdated: number | null;
  refresh: () => Promise<void>;
}

/**
 * Interval-polling data hook (no overlap, aborts nothing mid-flight, keeps
 * the last good data on errors). intervalMs <= 0 disables auto-refresh.
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  enabled = true
): PollingState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const inflight = useRef(false);
  const hadData = useRef(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    if (hadData.current) setRefreshing(true);
    try {
      const next = await fetcherRef.current();
      setData(next);
      setError(null);
      hadData.current = true;
      setLastUpdated(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
      inflight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    if (intervalMs <= 0) return;
    const timer = setInterval(() => void refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [refresh, intervalMs, enabled]);

  return { data, error, loading, refreshing, lastUpdated, refresh };
}
