"use client";

/**
 * Debounced PDF generation hook. Watches editor content + configuration and
 * regenerates the document (fully client-side) whenever they change — the
 * filename is deliberately excluded from the generation key because it never
 * affects the PDF bytes (renaming is a pure output concern).
 * Exposes status, the latest bytes plus download, print and open-in-tab
 * helpers.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useToolStore, type EditorMode } from "@/store/tool-store";
import { generatePdf, type GenerateResult } from "@/lib/pdf/generate";
import { sanitizeFilename } from "@/lib/pdf/filename";
import { sanitizeEditorHtml, htmlIsEmpty } from "@/lib/editor/sanitize";
import { plainTextToHtml } from "@/lib/editor/dom";
import type { PdfConfig } from "@/lib/pdf/types";

export type GenerationStatus = "idle" | "generating" | "ready" | "error";

export interface PdfGenerationApi {
  status: GenerationStatus;
  result: GenerateResult | null;
  error: string | null;
  /** True when the current document has no text content. */
  isEmpty: boolean;
  regenerate: () => void;
  download: () => Promise<void>;
  /** Print the current document through a hidden iframe. */
  print: () => Promise<void>;
  /** Open the current document in a new browser tab. */
  openInTab: () => Promise<void>;
}

/** Generation key inputs — filename excluded: it never affects the PDF bytes. */
function documentSignature(state: {
  mode: EditorMode;
  html: string;
  plainText: string;
  config: PdfConfig;
}): string {
  const { filename: _filename, ...configWithoutName } = state.config;
  return JSON.stringify({
    mode: state.mode,
    html: state.html,
    plainText: state.plainText,
    config: configWithoutName,
  });
}

export function usePdfGeneration(debounceMs = 650): PdfGenerationApi {
  const mode = useToolStore((s) => s.mode);
  const html = useToolStore((s) => s.html);
  const plainText = useToolStore((s) => s.plainText);
  const config = useToolStore((s) => s.config);

  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forcedTick, setForcedTick] = useState(0);

  const isEmpty = useMemo(
    () => (mode === "plain" ? plainText.trim().length === 0 : htmlIsEmpty(html)),
    [mode, plainText, html]
  );

  // Key describing the exact document that was (or will be) generated.
  // Filename-only changes keep this key stable, so renaming never
  // re-triggers the debounced regeneration below.
  const inputKey = useMemo(
    () => documentSignature({ mode, html, plainText, config }),
    [mode, html, plainText, config]
  );
  const generatedKeyRef = useRef<string | null>(null);
  const runIdRef = useRef(0);
  const forceRef = useRef(false);

  const run = useCallback(async (): Promise<GenerateResult> => {
    const state = useToolStore.getState();
    const sourceHtml =
      state.mode === "plain"
        ? plainTextToHtml(state.plainText)
        : sanitizeEditorHtml(state.html);
    return generatePdf(sourceHtml, state.config);
  }, []);

  const startRun = useCallback(() => {
    // Snapshot the inputs this run corresponds to, so results are only
    // cached when they match what was requested. Uses the same signature
    // helper as `inputKey` so the two keys stay comparable.
    const state0 = useToolStore.getState();
    const keyAtStart = documentSignature(state0);
    const runId = ++runIdRef.current;
    setStatus("generating");
    setError(null);
    run()
      .then((generated) => {
        if (runId !== runIdRef.current) return; // stale run
        generatedKeyRef.current = keyAtStart;
        setResult(generated);
        setStatus("ready");
      })
      .catch((err) => {
        if (runId !== runIdRef.current) return;
        console.error("PDF generation failed", err);
        setError(err instanceof Error ? err.message : "The PDF could not be generated.");
        setStatus("error");
      });
  }, [run]);

  // Debounced auto generation (manual refreshes bypass the debounce).
  useEffect(() => {
    if (isEmpty) {
      // Nothing to render — clear so the preview shows its empty state.
      generatedKeyRef.current = null;
      const clear = setTimeout(() => {
        setStatus("idle");
        setResult(null);
      }, 0);
      return () => clearTimeout(clear);
    }
    const immediate = forceRef.current;
    forceRef.current = false;
    const timer = setTimeout(() => startRun(), immediate ? 0 : debounceMs);
    return () => clearTimeout(timer);
  }, [inputKey, isEmpty, debounceMs, startRun, forcedTick]);

  const regenerate = useCallback(() => {
    forceRef.current = true;
    setForcedTick((t) => t + 1);
  }, []);

  /**
   * Resolve the document for the current inputs: reuse the cached result when
   * it is still fresh, otherwise regenerate and cache the fresh one. Also
   * returns the sanitized filename from the current settings.
   */
  const ensureResult = useCallback(
    async (): Promise<{ bytes: Uint8Array; pageCount: number; filename: string }> => {
      const filename = sanitizeFilename(useToolStore.getState().config.filename);
      if (result && generatedKeyRef.current === inputKey && !isEmpty) {
        return { bytes: result.bytes, pageCount: result.pageCount, filename };
      }
      const fresh = await run();
      generatedKeyRef.current = inputKey;
      setResult(fresh);
      setStatus("ready");
      return { bytes: fresh.bytes, pageCount: fresh.pageCount, filename };
    },
    [result, inputKey, isEmpty, run]
  );

  const download = useCallback(async () => {
    try {
      const { bytes, pageCount, filename } = await ensureResult();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // Release the object URL after the download has started.
      setTimeout(() => URL.revokeObjectURL(url), 15_000);
      const sizeKb = Math.max(1, Math.round(bytes.byteLength / 1024));
      toast.success(`${filename} downloaded`, {
        description: `${pageCount} page${pageCount === 1 ? "" : "s"} · ${sizeKb} KB · text is selectable`,
      });
    } catch (err) {
      console.error("PDF download failed", err);
      setStatus("error");
      setError(err instanceof Error ? err.message : "The PDF could not be generated.");
      toast.error("The PDF could not be generated.", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }, [ensureResult]);

  /** Print the document via a hidden iframe (no-op for empty documents). */
  const print = useCallback(async () => {
    if (isEmpty) return;
    let url: string | null = null;
    let iframe: HTMLIFrameElement | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let cleaned = false;

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (fallbackTimer !== null) clearTimeout(fallbackTimer);
      iframe?.remove();
      iframe = null;
      if (url) {
        URL.revokeObjectURL(url);
        url = null;
      }
    };

    try {
      const { bytes } = await ensureResult();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      url = URL.createObjectURL(blob);
      iframe = document.createElement("iframe");
      // Some browsers refuse to print zero-size frames, so keep the frame
      // off-screen but give it a real footprint.
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "640px";
      iframe.style.height = "480px";
      iframe.style.opacity = "0";
      iframe.style.pointerEvents = "none";
      iframe.style.border = "none";
      iframe.src = url;
      iframe.addEventListener("load", () => {
        const win = iframe?.contentWindow;
        if (!win) {
          cleanup();
          toast.error("The PDF could not be printed. Try 'Open in new tab' and print from there.");
          return;
        }
        win.addEventListener("afterprint", cleanup);
        win.focus();
        win.print();
      });
      // Some in-frame PDF viewers never fire afterprint — clean up after a
      // grace period regardless.
      fallbackTimer = setTimeout(cleanup, 60_000);
      document.body.appendChild(iframe);
    } catch (err) {
      console.error("PDF print failed", err);
      setStatus("error");
      setError(err instanceof Error ? err.message : "The PDF could not be printed.");
      toast.error("Printing failed.", {
        description: err instanceof Error ? err.message : undefined,
      });
      cleanup();
    }
  }, [isEmpty, ensureResult]);

  /** Open the document in a new browser tab (no-op for empty documents). */
  const openInTab = useCallback(async () => {
    if (isEmpty) return;
    try {
      const { bytes } = await ensureResult();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (!win) {
        toast.error("Pop-up blocked", {
          description: "Allow pop-ups for this site to open the PDF in a new tab.",
        });
        URL.revokeObjectURL(url);
        return;
      }
      // Release the object URL once the new tab has had time to load it.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast.success("PDF opened in a new tab.");
    } catch (err) {
      console.error("PDF open-in-tab failed", err);
      setStatus("error");
      setError(err instanceof Error ? err.message : "The PDF could not be opened.");
      toast.error("The PDF could not be opened.", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }, [isEmpty, ensureResult]);

  return { status, result, error, isEmpty, regenerate, download, print, openInTab };
}
