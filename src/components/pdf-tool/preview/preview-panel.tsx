"use client";

/**
 * Live PDF preview rendered with pdf.js. Pages are drawn to canvases,
 * lazily rendered as they approach the viewport, with zoom, fit-to-width,
 * fit-to-page, page navigation and optional margin guides.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  StretchHorizontal,
  Ruler,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  FileText,
  Loader2,
  RotateCw,
  AlertTriangle,
} from "lucide-react";
import type { GenerateResult } from "@/lib/pdf/generate";
import type { GenerationStatus } from "../hooks/use-pdf-generation";
import { useToolStore } from "@/store/tool-store";
import { pageGeometry } from "@/lib/pdf/geometry";

type ZoomMode = "fit-width" | "fit-page" | number;

const PAGE_GAP = 24;
const MIN_SCALE = 0.25;
const MAX_SCALE = 4;

let pdfjsPromise: Promise<any> | null = null;
function loadPdfjs(): Promise<any> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((lib: any) => {
      lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return lib;
    });
  }
  return pdfjsPromise;
}

interface PreviewPanelProps {
  status: GenerationStatus;
  result: GenerateResult | null;
  error: string | null;
  isEmpty: boolean;
  onRetry: () => void;
  onLoadSample: () => void;
  onOpenTab?: () => void;
}

function PageCanvas({
  doc,
  pageNumber,
  scale,
  widthPt,
  heightPt,
}: {
  doc: any;
  pageNumber: number;
  scale: number;
  widthPt: number;
  heightPt: number;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);
  const [nearViewport, setNearViewport] = useState(false);
  const taskRef = useRef<any>(null);

  // Lazy activation via IntersectionObserver.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setNearViewport(true);
        }
      },
      { rootMargin: "800px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!nearViewport || !doc) return;
    let cancelled = false;
    // Show the placeholder again while (re)rendering, without calling
    // setState synchronously inside the effect body.
    const placeholderTimer = setTimeout(() => {
      if (!cancelled) setRendered(false);
    }, 0);

    const render = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: scale * dpr });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.max(40, Math.floor(widthPt * scale))}px`;
        canvas.style.height = `${Math.max(40, Math.floor(heightPt * scale))}px`;
        taskRef.current?.cancel?.();
        const task = page.render({ canvas, viewport });
        taskRef.current = task;
        await task.promise;
        clearTimeout(placeholderTimer);
        if (!cancelled) setRendered(true);
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException" && !cancelled) {
          console.warn(`Preview page ${pageNumber} failed`, err);
        }
      }
    };

    void render();
    return () => {
      cancelled = true;
      clearTimeout(placeholderTimer);
      taskRef.current?.cancel?.();
      taskRef.current = null;
    };
  }, [doc, pageNumber, scale, widthPt, heightPt, nearViewport]);

  const displayWidth = Math.max(40, Math.floor(widthPt * scale));
  const displayHeight = Math.max(40, Math.floor(heightPt * scale));

  return (
    <div
      ref={wrapperRef}
      className="relative shrink-0 overflow-hidden rounded-sm bg-white shadow-md ring-1 ring-black/10"
      style={{ width: displayWidth, height: displayHeight }}
      data-page={pageNumber}
    >
      <canvas ref={canvasRef} className="block h-full w-full" aria-hidden />
      {!rendered && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-300" aria-hidden />
        </div>
      )}
    </div>
  );
}

export function PreviewPanel({ status, result, error, isEmpty, onRetry, onLoadSample, onOpenTab }: PreviewPanelProps) {
  const config = useToolStore((s) => s.config);

  const containerRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<any>(null);
  const [zoomMode, setZoomMode] = useState<ZoomMode>("fit-width");
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [showGuides, setShowGuides] = useState(false);

  const widthPt = result?.pageWidthPt ?? 595.28;
  const heightPt = result?.pageHeightPt ?? 841.89;
  const marginsPt = useMemo(() => pageGeometry(config).marginsPt, [config]);

  /* ----- load the pdf document whenever new bytes arrive ----- */
  useEffect(() => {
    if (!result) {
      const clear = setTimeout(() => {
        setDoc((prev: any) => {
          prev?.destroy?.();
          return null;
        });
      }, 0);
      return () => clearTimeout(clear);
    }
    let destroyed = false;
    let loadedDoc: any = null;
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const task = pdfjs.getDocument({ data: result.bytes.slice(), isEvalSupported: false });
        loadedDoc = await task.promise;
        if (destroyed) {
          loadedDoc.destroy();
          return;
        }
        setDoc((prev: any) => {
          prev?.destroy?.();
          return loadedDoc;
        });
        setCurrentPage(1);
        containerRef.current?.scrollTo({ top: 0 });
      } catch (err) {
        console.error("Preview failed to load PDF", err);
      }
    })();
    return () => {
      destroyed = true;
    };
  }, [result]);

  useEffect(() => {
    return () => {
      doc?.destroy?.();
    };
  }, [doc]);

  /* ----- container size tracking (for fit modes) ----- */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // ResizeObserver fires once for the initial size.
    const observer = new ResizeObserver(() => {
      setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* ----- zoom mode -> concrete scale (derived, no state) ----- */
  const scale = useMemo(() => {
    const clamp = (n: number) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, n));
    if (typeof zoomMode === "number") return clamp(zoomMode);
    if (containerSize.width < 40) return 1;
    const fitWidth = (containerSize.width - 48) / widthPt;
    if (zoomMode === "fit-width") return clamp(fitWidth);
    return clamp(Math.min(fitWidth, (containerSize.height - 40) / heightPt));
  }, [zoomMode, containerSize.width, containerSize.height, widthPt, heightPt]);

  /* ----- current page tracking ----- */
  const onScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || !doc) return;
    const pages = el.querySelectorAll<HTMLElement>("[data-page]");
    const marker = el.scrollTop + el.clientHeight * 0.35;
    let page = 1;
    pages.forEach((p) => {
      if (p.offsetTop - el.offsetTop <= marker) page = Number(p.dataset.page);
    });
    setCurrentPage((prev) => (prev === page ? prev : page));
  }, [doc]);

  const totalPages = doc?.numPages ?? result?.pageCount ?? 0;

  const goToPage = useCallback(
    (page: number) => {
      const el = containerRef.current;
      if (!el || !doc) return;
      const clamped = Math.max(1, Math.min(doc.numPages, page));
      const target = el.querySelector<HTMLElement>(`[data-page="${clamped}"]`);
      if (target) {
        el.scrollTo({ top: target.offsetTop - el.offsetTop - 12, behavior: "smooth" });
      }
      setCurrentPage(clamped);
    },
    [doc]
  );

  const zoomBy = (factor: number) => {
    setZoomMode((prev) => {
      const base = typeof prev === "number" ? prev : scale;
      return Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.round(base * factor * 100) / 100));
    });
  };
  const firstGeneration = status === "generating" && !result;

  return (
    <section aria-label="PDF preview" className="flex h-full min-h-0 flex-col rounded-xl border bg-card shadow-sm">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b px-3 py-2">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Zoom out" onClick={() => zoomBy(0.85)}>
                <ZoomOut className="h-4 w-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom out</TooltipContent>
          </Tooltip>
          <span className="min-w-[52px] text-center text-xs tabular-nums text-muted-foreground" aria-live="polite">
            {Math.round(scale * 100)}%
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Zoom in" onClick={() => zoomBy(1.18)}>
                <ZoomIn className="h-4 w-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom in</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={zoomMode === "fit-width" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                aria-label="Fit to width"
                onClick={() => setZoomMode("fit-width")}
              >
                <StretchHorizontal className="h-4 w-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fit to width</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={zoomMode === "fit-page" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                aria-label="Fit to page"
                onClick={() => setZoomMode("fit-page")}
              >
                <Maximize2 className="h-4 w-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fit to page</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showGuides ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                aria-label="Toggle margin guides"
                aria-pressed={showGuides}
                onClick={() => setShowGuides((g) => !g)}
              >
                <Ruler className="h-4 w-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Margin guides</TooltipContent>
          </Tooltip>

          <div className="ml-auto flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Open PDF in new tab"
                  disabled={!doc || !onOpenTab}
                  onClick={() => onOpenTab?.()}
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open in new tab</TooltipContent>
            </Tooltip>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Previous page"
              disabled={totalPages < 2 || currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
            >
              <ChevronUp className="h-4 w-4" aria-hidden />
            </Button>
            <span className="min-w-[72px] text-center text-xs tabular-nums text-muted-foreground" aria-live="polite">
              {totalPages ? `Page ${currentPage} / ${totalPages}` : "Page —"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Next page"
              disabled={totalPages < 2 || currentPage >= totalPages}
              onClick={() => goToPage(currentPage + 1)}
            >
              <ChevronDown className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </TooltipProvider>
      </div>

      {/* canvas area */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={containerRef}
          onScroll={onScroll}
          className="t2p-scroll h-full overflow-y-auto overscroll-contain bg-zinc-100 p-6 dark:bg-zinc-900"
          role="region"
          aria-label="PDF preview pages"
        >
          {doc && result ? (
            <div className="mx-auto flex flex-col items-center gap-6" style={{ width: "fit-content" }}>
              {Array.from({ length: doc.numPages }, (_, i) => (
                <div key={i} className="relative">
                  <PageCanvas doc={doc} pageNumber={i + 1} scale={scale} widthPt={widthPt} heightPt={heightPt} />
                  {showGuides && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute rounded-[2px] border border-dashed border-emerald-500/70"
                      style={{
                        top: marginsPt.top * scale,
                        bottom: marginsPt.bottom * scale,
                        left: marginsPt.left * scale,
                        right: marginsPt.right * scale,
                      }}
                    />
                  )}
                  {doc.numPages > 1 && (
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-medium tabular-nums text-zinc-400">
                      {i + 1}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : firstGeneration ? (
            <div className="flex h-full items-center justify-center" role="status" aria-live="polite">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden />
                <p className="text-sm">Generating your PDF…</p>
              </div>
            </div>
          ) : isEmpty ? (
            <div className="flex h-full items-center justify-center px-6">
              <div className="flex max-w-sm flex-col items-center gap-3 text-center text-muted-foreground">
                <div className="rounded-full bg-primary/10 p-4">
                  <FileText className="h-7 w-7 text-primary" aria-hidden />
                </div>
                <p className="text-sm font-medium text-foreground">Your preview appears here</p>
                <p className="text-xs leading-relaxed">
                  Type or paste text in the editor and the PDF preview updates live as you go.
                </p>
                <Button variant="outline" size="sm" onClick={onLoadSample}>
                  Load a sample document
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center px-6">
              <div className="flex max-w-sm flex-col items-center gap-3 text-center">
                <AlertTriangle className="h-7 w-7 text-amber-500" aria-hidden />
                <p className="text-sm font-medium text-foreground">Preview unavailable</p>
                <p className="text-xs text-muted-foreground">{error ?? "Something went wrong while generating the document."}</p>
                <Button variant="outline" size="sm" onClick={onRetry}>
                  <RotateCw className="h-3.5 w-3.5" aria-hidden />
                  Try again
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* updating chip */}
        {status === "generating" && result && (
          <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2" role="status" aria-live="polite">
            <div className="flex items-center gap-2 rounded-full border bg-background/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden />
              Updating preview…
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
