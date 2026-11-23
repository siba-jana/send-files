"use client";

/**
 * Primary action bar: quick PDF file name field, prominent Download PDF
 * button, print, manual refresh and a live status line. On mobile it also
 * offers a shortcut to the preview tab. The file name is edited live here —
 * renaming never triggers a regeneration (see usePdfGeneration).
 */

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, RotateCw, Loader2, Eye, FileCheck2, AlertTriangle, Printer } from "lucide-react";
import { useToolStore } from "@/store/tool-store";
import { sanitizeFilename } from "@/lib/pdf/filename";
import type { GenerationStatus } from "./hooks/use-pdf-generation";

interface ActionsBarProps {
  status: GenerationStatus;
  pageCount: number;
  sizeKb: number;
  onDownload: () => void;
  onRefresh: () => void;
  onPrint: () => void;
  onShowPreview?: () => void;
}

export function ActionsBar({ status, pageCount, sizeKb, onDownload, onRefresh, onPrint, onShowPreview }: ActionsBarProps) {
  const filename = useToolStore((s) => s.config.filename);
  const updateConfig = useToolStore((s) => s.updateConfig);
  const filenameId = useId();

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center"
      role="region"
      aria-label="PDF actions"
    >
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <label htmlFor={filenameId} className="sr-only">
          PDF file name
        </label>
        <Input
          id={filenameId}
          className="h-11 w-[180px] sm:w-[220px]"
          placeholder="text-document.pdf"
          value={filename}
          onChange={(e) => updateConfig({ filename: e.target.value })}
          onBlur={() => {
            // Normalise on blur, but only when the sanitiser would actually
            // change the value so the text never visibly jumps.
            const normalized = sanitizeFilename(filename);
            if (normalized !== filename) updateConfig({ filename: normalized });
          }}
        />
        <Button
          size="lg"
          className="h-11 gap-2 px-6 text-base font-semibold"
          onClick={onDownload}
          disabled={status === "generating"}
          aria-keyshortcuts="Control+S"
        >
          {status === "generating" ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : (
            <Download className="h-5 w-5" aria-hidden />
          )}
          Download PDF
        </Button>
        <Button variant="outline" size="lg" className="h-11 gap-2" onClick={onRefresh} disabled={status === "generating"}>
          <RotateCw className="h-4 w-4" aria-hidden />
          Refresh preview
        </Button>
        <Button variant="outline" size="lg" className="h-11 gap-2" onClick={onPrint} disabled={status === "generating"}>
          <Printer className="h-4 w-4" aria-hidden />
          Print
        </Button>
        {onShowPreview && (
          <Button variant="outline" size="lg" className="h-11 gap-2 lg:hidden" onClick={onShowPreview}>
            <Eye className="h-4 w-4" aria-hidden />
            Preview
          </Button>
        )}
      </div>

      <div className="text-sm text-muted-foreground" aria-live="polite">
        {status === "generating" && (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
            Generating PDF…
          </span>
        )}
        {status === "ready" && pageCount > 0 && (
          <span className="inline-flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-primary" aria-hidden />
            PDF ready · {pageCount} page{pageCount === 1 ? "" : "s"} · {sizeKb} KB
          </span>
        )}
        {status === "error" && (
          <span className="inline-flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            Generation failed — try refreshing
          </span>
        )}
        {status === "idle" && <span>Live preview is enabled — start typing to see your PDF.</span>}
      </div>
    </div>
  );
}
