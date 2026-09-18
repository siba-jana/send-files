'use client';

/**
 * Receiver-side React state machine: code/link entry → metadata confirmation
 * (with optional password unlock) → accept → live transfer → results with
 * download controls. Wraps TransferReceiver.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TransferReceiver, type ReceiverState } from '@/lib/transfer/receiver';
import { dirPickerSupported, fsAccessSupported, webrtcSupported } from '@/lib/transfer/browser';
import {
  describeApiError,
  fetchIceServers,
  fetchTransfer,
  lookupCode,
  unlockTransfer,
  type TransferFileInfo,
} from '@/lib/transfer/client-api';
import { memorySinks, pickSaveTargets, type FileSink, type SinkResult } from '@/lib/transfer/sinks';

export type ReceivePhase =
  | 'idle'
  | 'resolving' // looking up code / link
  | 'confirm' // metadata shown; waiting for Accept (may need password first)
  | 'unlocking'
  | 'connecting'
  | 'transferring'
  | 'reconnecting'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface ReceiveMeta {
  token: string;
  status: string;
  expiresAt: string;
  senderName: string | null;
  passwordProtected: boolean;
  fileCount: number;
  totalBytes: number;
  files: { name: string; size: number; mimeType: string }[] | null;
}

export interface ReceiveResultItem {
  name: string;
  size: number;
  sha256: string | null;
  savedToDisk: boolean;
  blob?: Blob;
  /** Sender-reported modification time — preserved on download when present. */
  mtime?: number | null;
}

/** Normalize a code like "482-917" / "482917" / "482 917" → "482917" */
export function normalizeCode(input: string): string {
  return input.replace(/\D/g, '');
}

/** Extract a transfer token from a pasted URL or raw token. */
export function extractToken(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/[?&]t=([A-Za-z0-9]+)/);
  if (match) return match[1];
  if (/^[A-Za-z0-9]{6,32}$/.test(trimmed)) return trimmed;
  return null;
}

export function useReceiveTransfer() {
  const [phase, setPhase] = useState<ReceivePhase>('idle');
  const [meta, setMeta] = useState<ReceiveMeta | null>(null);
  const [progress, setProgress] = useState<ReceiverState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receiverToken, setReceiverToken] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [saveMode, setSaveMode] = useState<'ask' | 'memory' | 'disk'>('ask');
  const engineRef = useRef<TransferReceiver | null>(null);
  const iceRef = useRef<RTCIceServer[] | null>(null);
  const revokedUrls = useRef<string[]>([]);

  const supported = useMemo(() => webrtcSupported(), []);
  const fsSupported = useMemo(() => fsAccessSupported() && dirPickerSupported(), []);

  // ------------------------------------------------------------ lookup / unlock

  const applyInfo = useCallback((token: string, info: TransferFileInfo) => {
    setMeta({
      token,
      status: info.status,
      expiresAt: info.expiresAt,
      senderName: info.senderName,
      passwordProtected: info.passwordProtected,
      fileCount: info.fileCount,
      totalBytes: info.totalBytes,
      files: info.files,
    });
    setUnlocked(!info.passwordProtected);
    if (info.passwordProtected) {
      setReceiverToken(null);
    } else {
      setReceiverToken(info.receiverToken ?? null);
    }
    setPhase('confirm');
  }, []);

  const startByToken = useCallback(
    async (token: string) => {
      setPhase('resolving');
      setError(null);
      setMeta(null);
      setReceiverToken(null);
      setUnlocked(false);
      try {
        const info = await fetchTransfer(token);
        applyInfo(token, info);
      } catch (err) {
        setError(describeApiError(err));
        setPhase('failed');
      }
    },
    [applyInfo],
  );

  const startByCode = useCallback(
    async (code: string) => {
      const normalized = normalizeCode(code);
      if (normalized.length !== 6) {
        setError('Enter the 6-digit transfer code.');
        return;
      }
      setPhase('resolving');
      setError(null);
      setMeta(null);
      setReceiverToken(null);
      setUnlocked(false);
      try {
        const { token } = await lookupCode(normalized);
        const info = await fetchTransfer(token);
        applyInfo(token, info);
      } catch (err) {
        setError(describeApiError(err));
        setPhase('failed');
      }
    },
    [applyInfo],
  );

  const submitPassword = useCallback(
    async (password: string) => {
      if (!meta) return;
      if (!password) {
        setError('Enter the transfer password.');
        return;
      }
      setPhase('unlocking');
      setError(null);
      try {
        const res = await unlockTransfer(meta.token, password);
        setMeta((prev) =>
          prev
            ? {
                ...prev,
                files: res.files,
                fileCount: res.fileCount,
                totalBytes: res.totalBytes,
                senderName: res.senderName,
              }
            : prev,
        );
        setReceiverToken(res.receiverToken);
        setUnlocked(true);
        setPhase('confirm');
      } catch (err) {
        setError(describeApiError(err));
        setPhase('confirm');
      }
    },
    [meta],
  );

  // ------------------------------------------------------------ accept + engine

  const accept = useCallback(
    async (preferDisk: boolean): Promise<boolean> => {
      if (!meta || !receiverToken) return false;
      if (!supported) {
        setError('Your browser does not support direct browser-to-browser transfers.');
        setPhase('failed');
        return false;
      }
      const pendingFiles =
        meta.files?.map((f, i) => ({ id: i, name: f.name, size: f.size })) ??
        Array.from({ length: meta.fileCount }, (_, i) => ({ id: i, name: `file-${i + 1}`, size: 0 }));

      // Pickers MUST run inside the user gesture (before any awaits below).
      let sinks: Map<number, FileSink> | null = null;
      const useDisk = preferDisk && fsSupported;
      if (useDisk) {
        sinks = await pickSaveTargets(pendingFiles);
        if (sinks === null) {
          // user cancelled the picker — stay on the confirm screen
          setSaveMode('ask');
          return false;
        }
        setSaveMode('disk');
      } else {
        sinks = memorySinks(pendingFiles);
        setSaveMode('memory');
      }

      setPhase('connecting');
      setError(null);
      try {
        if (!iceRef.current) {
          const ice = await fetchIceServers();
          iceRef.current = ice.iceServers;
        }
        const engine = new TransferReceiver({
          token: meta.token,
          receiverToken,
          sinks,
          onState: (state) => {
            setProgress(state);
            setPhase((prev) => {
              if (prev === 'cancelled') return prev;
              if (['connecting', 'transferring', 'reconnecting', 'completed', 'cancelled', 'failed'].includes(state.phase)) {
                return state.phase;
              }
              return prev;
            });
            if (state.error) setError(state.error);
          },
        });
        engineRef.current = engine;
        await engine.start(iceRef.current);
        return true;
      } catch (err) {
        setError(describeApiError(err));
        setPhase('failed');
        return false;
      }
    },
    [meta, receiverToken, supported, fsSupported],
  );

  const decline = useCallback(() => {
    setMeta(null);
    setReceiverToken(null);
    setUnlocked(false);
    setProgress(null);
    setError(null);
    setPhase('idle');
  }, []);

  const cancel = useCallback(async (reason?: string) => {
    const engine = engineRef.current;
    if (engine) {
      await engine.cancel(reason || 'Stopped by recipient');
    }
  }, []);

  const reset = useCallback(() => {
    const engine = engineRef.current;
    if (engine && !['completed', 'cancelled', 'failed'].includes(phase)) {
      void engine.cancel('Reset');
    }
    engineRef.current = null;
    for (const url of revokedUrls.current) URL.revokeObjectURL(url);
    revokedUrls.current = [];
    setMeta(null);
    setReceiverToken(null);
    setUnlocked(false);
    setProgress(null);
    setError(null);
    setPhase('idle');
  }, [phase]);

  // ------------------------------------------------------------ downloads

  const downloadFile = useCallback(
    (item: ReceiveResultItem | (SinkResult & { blob?: Blob; mtime?: number | null })) => {
      if (!item.blob) return;
      // Wrap in a File when the sender reported a modification time so the
      // browser preserves it on save (plain Blob saves get "now").
      const payload =
        typeof item.mtime === 'number' && Number.isFinite(item.mtime) && item.mtime > 0
          ? new File([item.blob], item.name, { lastModified: item.mtime })
          : item.blob;
      const url = URL.createObjectURL(payload);
      revokedUrls.current.push(url);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        revokedUrls.current = revokedUrls.current.filter((u) => u !== url);
      }, 30000);
    },
    [],
  );

  const downloadAll = useCallback(
    (items: Array<ReceiveResultItem | (SinkResult & { blob?: Blob })>) => {
      const withBlobs = items.filter((i) => i.blob);
      withBlobs.forEach((item, idx) => {
        setTimeout(() => downloadFile(item), idx * 400);
      });
    },
    [downloadFile],
  );

  // ------------------------------------------------------------ expiry + cleanup

  useEffect(() => {
    if (!meta) return;
    if (!['confirm', 'connecting', 'reconnecting'].includes(phase)) return;
    const expiresAtMs = new Date(meta.expiresAt).getTime();
    const timer = setInterval(() => {
      if (Date.now() >= expiresAtMs) {
        clearInterval(timer);
        const engine = engineRef.current;
        if (engine) void engine.cancel('Transfer expired');
        setPhase('failed');
        setError('This transfer has expired.');
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [meta, phase]);

  useEffect(() => {
    if (!['connecting', 'transferring', 'reconnecting'].includes(phase)) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase]);

  useEffect(() => {
    return () => {
      const engine = engineRef.current;
      if (engine) void engine.cancel('Recipient left');
      for (const url of revokedUrls.current) URL.revokeObjectURL(url);
    };
  }, []);

  return {
    supported,
    fsSupported,
    phase,
    meta,
    progress,
    error,
    unlocked,
    saveMode,
    receiverToken,
    startByToken,
    startByCode,
    submitPassword,
    accept,
    decline,
    cancel,
    reset,
    downloadFile,
    downloadAll,
  };
}
