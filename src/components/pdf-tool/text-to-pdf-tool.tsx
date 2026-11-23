"use client";

/**
 * Text to PDF converter workspace.
 *
 * Desktop: editor and live PDF preview side by side, actions bar and the
 * settings panel below. Mobile: tabbed editing/preview.
 *
 * All document processing (formatting, pagination, PDF bytes) happens in the
 * browser — nothing is uploaded to a server.
 */

import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PencilLine, Eye, Loader2 } from "lucide-react";
import { useToolStore } from "@/store/tool-store";
import { TextEditor } from "./editor/text-editor";
import { PreviewPanel } from "./preview/preview-panel";
import { SettingsPanel } from "./panels/settings-panel";
import { ActionsBar } from "./actions-bar";
import { usePdfGeneration } from "./hooks/use-pdf-generation";

export function TextToPdfTool() {
  const [mounted, setMounted] = useState(false);
  const loadSample = useToolStore((s) => s.loadSample);
  const { status, result, error, isEmpty, regenerate, download, print, openInTab } = usePdfGeneration();
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");

  useEffect(() => {
    setMounted(true);
  }, []);

  const sizeKb = result ? Math.max(1, Math.round(result.bytes.byteLength / 1024)) : 0;

  // Ctrl/Cmd+S downloads the current document.
  useEffect(() => {
    if (!mounted) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!isEmpty && status !== "generating") void download();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mounted, isEmpty, status, download]);

  if (!mounted) {
    return (
      <div className="flex h-[640px] w-full flex-col items-center justify-center rounded-xl border bg-card/50 text-muted-foreground shadow-sm">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" aria-hidden />
        <p className="text-sm font-medium">Loading Text to PDF Converter…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* mobile tab switcher */}
      <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as "edit" | "preview")} className="lg:hidden">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="edit" className="gap-1.5">
            <PencilLine className="h-4 w-4" aria-hidden />
            Edit
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-1.5">
            <Eye className="h-4 w-4" aria-hidden />
            Preview
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* workspace */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div
          className={`${mobileTab === "edit" ? "block" : "hidden"} h-[62vh] min-h-[420px] lg:block lg:h-[640px]`}
        >
          <TextEditor />
        </div>
        <div
          className={`${mobileTab === "preview" ? "block" : "hidden"} h-[62vh] min-h-[420px] lg:block lg:h-[640px]`}
        >
          <PreviewPanel
            status={status}
            result={result}
            error={error}
            isEmpty={isEmpty}
            onRetry={regenerate}
            onLoadSample={loadSample}
            onOpenTab={() => void openInTab()}
          />
        </div>
      </div>

      {/* actions */}
      <ActionsBar
        status={status}
        pageCount={result?.pageCount ?? 0}
        sizeKb={sizeKb}
        onDownload={() => void download()}
        onRefresh={regenerate}
        onPrint={() => void print()}
        onShowPreview={() => setMobileTab("preview")}
      />

      {/* settings */}
      <SettingsPanel />
    </div>
  );
}

export default TextToPdfTool;
