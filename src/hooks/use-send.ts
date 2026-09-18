'use client';

/**
 * Sender-side React state machine: file selection → session creation →
 * waiting (code/link/QR) → live transfer → completion. Wraps TransferSender.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TransferSender, type SenderState } from '@/lib/transfer/sender';
import { webrtcSupported } from '@/lib/transfer/browser';
import { createTransfer, describeApiError, fetchIceServers, type TransferFileMeta } from '@/lib/transfer/client-api';

export interface SendFileItem {
  key: string;
  file: File;
}

export interface SendOptions {
  usePassword: boolean;
  password: string;
  expiresInHours: number;
  senderName: string;
  maxDownloads: number;
}

export type SendPhase =
  | 'idle'
  | 'ready'
  | 'creating'
  | 'waiting'
  | 'connecting'
  | 'transferring'
  | 'reconnecting'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'expired';

export interface SendTransferInfo {
  token: string;
  code: string;
  senderToken: string;
  expiresAt: string;
  files: TransferFileMeta[];
}

const MAX_FILES = 200;

let keyCounter = 0;
const nextKey = () => `f${Date.now().toString(36)}-${(keyCounter++).toString(36)}`;

export function useSendTransfer() {
  const [files, setFiles] = useState<SendFileItem[]>([]);
  const [options, setOptions] = useState<SendOptions>({
    usePassword: false,
    password: '',
    expiresInHours: 24,
    senderName: '',
    maxDownloads: 5,
  });
  const [phase, setPhase] = useState<SendPhase>('idle');
  const [info, setInfo] = useState<SendTransferInfo | null>(null);
  const [progress, setProgress] = useState<SenderState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const engineRef = useRef<TransferSender | null>(null);

  const supported = useMemo(() => webrtcSupported(), []);
  const totalBytes = useMemo(() => files.reduce((acc, f) => acc + f.file.size, 0), [files]);

  // ---------------------------------------------------------------- file list

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming);
      setFiles((prev) => {
        if (prev.length + list.length > MAX_FILES) {
          setError(`You can send up to ${MAX_FILES} files in one transfer.`);
          return prev;
        }
        setError(null);
        const names = new Set(prev.map((f) => f.file.name));
        const added: SendFileItem[] = [];
        for (const file of list) {
          let name = file.name || 'file';
          if (names.has(name)) {
            const dot = name.lastIndexOf('.');
            const stem = dot > 0 ? name.slice(0, dot) : name;
            const ext = dot > 0 ? name.slice(dot) : '';
            let i = 1;
            while (names.has(`${stem} (${i})${ext}`)) i += 1;
            name = `${stem} (${i})${ext}`;
          }
          names.add(name);
          // File objects are immutable — wrap to apply a collision-free name.
          const named = name === (file.name || 'file') ? file : new File([file], name, { type: file.type, lastModified: file.lastModified });
          added.push({ key: nextKey(), file: named });
        }
        return [...prev, ...added];
      });
      setPhase((p) => (p === 'idle' ? 'ready' : p));
    },
    [],
  );

  const removeFile = useCallback((key: string) => {
    setFiles((prev) => {
      const next = prev.filter((f) => f.key !== key);
      if (next.length === 0) setPhase((p) => (p === 'idle' || p === 'ready' ? 'idle' : p));
      return next;
    });
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
    setPhase((p) => (p === 'idle' || p === 'ready' ? 'idle' : p));
  }, []);

  /** Move a file up (-1) or down (+1) in the send order — the
   * keyboard/mobile-accessible reordering path. No-op at the boundaries. */
  const moveFile = useCallback((key: string, direction: -1 | 1) => {
    setFiles((prev) => {
      const from = prev.findIndex((f) => f.key === key);
      const to = from + direction;
      if (from === -1 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  /** Live drag reorder: move `fromKey` to `toKey`'s slot. The list order is
   * the delivery order (TRANSFER_INIT follows the array), so this controls
   * the sequence the receiver gets. */
  const reorderFiles = useCallback((fromKey: string, toKey: string) => {
    setFiles((prev) => {
      const from = prev.findIndex((f) => f.key === fromKey);
      const to = prev.findIndex((f) => f.key === toKey);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  const setOption = useCallback(<K extends keyof SendOptions>(key: K, value: SendOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ---------------------------------------------------------------- create + engine

  const create = useCallback(async () => {
    if (files.length === 0) return;
    if (!supported) {
      setError('Your browser does not support direct browser-to-browser transfers.');
      setPhase('failed');
      return;
    }
    if (options.usePassword && options.password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }
    setPhase('creating');
    setError(null);
    try {
      const ice = await fetchIceServers();
      const created = await createTransfer({
        files: files.map((f) => ({
          name: f.file.name || 'file',
          size: f.file.size,
          mimeType: f.file.type || 'application/octet-stream',
        })),
        password: options.usePassword ? options.password : undefined,
        expiresInHours: options.expiresInHours,
        senderName: options.senderName.trim() || undefined,
        maxDownloads: options.maxDownloads,
      });

      const engine = new TransferSender({
        token: created.token,
        senderToken: created.senderToken,
        files: files.map((f) => f.file),
        fileMetas: created.files,
        iceServers: ice.iceServers,
        onState: (state) => {
          setProgress(state);
          if (state.phase !== 'waiting' && state.phase !== 'connecting') {
            // engine phase maps 1:1 for the live phases
          }
          setPhase((prev) => {
            if (prev === 'expired' || prev === 'cancelled') return prev; // terminal overrides
            if (prev === 'creating' && state.phase === 'waiting') return 'waiting';
            if (['waiting', 'connecting', 'transferring', 'reconnecting', 'completed', 'cancelled', 'failed'].includes(state.phase)) {
              return state.phase;
            }
            return prev;
          });
          if (state.error) setError(state.error);
        },
      });
      engineRef.current = engine;
      setInfo({
        token: created.token,
        code: created.code,
        senderToken: created.senderToken,
        expiresAt: created.expiresAt,
        files: created.files,
      });
      await engine.start();
    } catch (err) {
      setError(describeApiError(err));
      setPhase('failed');
    }
  }, [files, options, supported]);

  const cancel = useCallback(async (reason?: string) => {
    const engine = engineRef.current;
    if (engine) {
      await engine.cancel(reason || 'Cancelled by sender');
    } else {
      setPhase((p) => (p === 'creating' ? 'cancelled' : p));
    }
  }, []);

  const reset = useCallback(() => {
    const engine = engineRef.current;
    if (engine && !['completed', 'cancelled', 'failed'].includes(phase)) {
      void engine.cancel('Reset');
    }
    engineRef.current = null;
    setFiles([]);
    setInfo(null);
    setProgress(null);
    setError(null);
    setPhase('idle');
  }, [phase]);

  // ---------------------------------------------------------------- expiry watchdog

  useEffect(() => {
    if (!info) return;
    if (!['waiting', 'connecting', 'reconnecting'].includes(phase)) return;
    const expiresAtMs = new Date(info.expiresAt).getTime();
    const timer = setInterval(() => {
      if (Date.now() >= expiresAtMs) {
        clearInterval(timer);
        const engine = engineRef.current;
        if (engine) void engine.cancel('Transfer expired');
        setPhase('expired');
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [info, phase]);

  // Warn before closing the tab while a transfer is alive.
  useEffect(() => {
    if (!['waiting', 'connecting', 'transferring', 'reconnecting'].includes(phase)) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase]);

  // Kill the engine on unmount (tab close / navigation).
  useEffect(() => {
    return () => {
      const engine = engineRef.current;
      if (engine) void engine.cancel('Sender left');
    };
  }, []);

  const shareLink = info ? `${typeof window !== 'undefined' ? window.location.origin : ''}/?t=${info.token}` : null;

  return {
    supported,
    files,
    totalBytes,
    options,
    phase,
    info,
    progress,
    error,
    shareLink,
    addFiles,
    removeFile,
    clearFiles,
    moveFile,
    reorderFiles,
    setOption,
    create,
    cancel,
    reset,
  };
}
