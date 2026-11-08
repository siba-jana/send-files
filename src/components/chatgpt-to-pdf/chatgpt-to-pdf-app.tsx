"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  FileText,
  Settings as SettingsIcon,
  Palette,
  Download,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Info,
  Copy,
  ClipboardPaste,
  ArrowRight,
  Check,
} from "lucide-react";
import {
  DocumentData,
  DocumentSettings,
  DocumentTheme,
  PageSize,
  Orientation,
  MarginSize,
  THEME_CONFIGS,
} from "./types";
import { CHATGPT_SAMPLES } from "./chatgpt-sample-data";
import { ChatGptLogo } from "./chatgpt-icon";
import { ChatGptEditor } from "./chatgpt-editor";
import { ChatGptPreview } from "./chatgpt-preview";
import { ChatGptSettings } from "./chatgpt-settings";
import { downloadPdfDirect } from "./chatgpt-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const DEFAULT_SETTINGS: DocumentSettings = {
  theme: "clean",
  pageSize: "a4",
  orientation: "portrait",
  margin: "normal",
  fontSize: "base",
  fontFamily: "sans",
  lineHeight: "normal",
  showPageNumbers: true,
  fileName: "chatgpt-conversation.pdf",
};

const STORAGE_DRAFT_KEY = "chatgpt_to_pdf_content_v6";

export function ChatGptToPdfApp() {
  const previewRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Draft content state
  const [data, setData] = useState<DocumentData>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_DRAFT_KEY);
        if (saved) return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return {
      content: CHATGPT_SAMPLES[0].content,
    };
  });

  const [settings, setSettings] = useState<DocumentSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<"content" | "settings" | "style">("content");
  const [scale, setScale] = useState<number>(1);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fileName, setFileName] = useState("chatgpt-conversation.pdf");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Auto-save draft
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(data));
    } catch {
      // storage quota
    }
  }, [data]);

  // Keep currentPage valid within totalPages
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [totalPages, currentPage]);

  // Keyboard navigation for page flip (ArrowLeft / ArrowRight) when not typing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLInputElement
      ) {
        return;
      }
      if (e.key === "ArrowLeft") {
        setCurrentPage((p) => Math.max(1, p - 1));
      } else if (e.key === "ArrowRight") {
        setCurrentPage((p) => Math.min(totalPages, p + 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [totalPages]);

  // Toggle fullscreen for preview
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Download PDF Action - directly generates & downloads .pdf file
  const handleDownloadPdf = async () => {
    if (!previewRef.current || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const sanitizedName = (fileName.trim() || "chatgpt-conversation").replace(/\.pdf$/i, "");
      await downloadPdfDirect(previewRef.current, sanitizedName, settings);
      toast.success("High-quality PDF downloaded successfully!");
    } catch (err) {
      console.error("PDF download failed:", err);
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner matching the UI mockup */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-2">
        {/* Left: ChatGPT Brand + Title + Subtitle */}
        <div className="flex items-start gap-4">
          <div className="size-14 sm:size-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
            <ChatGptLogo className="size-8 sm:size-9" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              ChatGPT to PDF Converter
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Convert ChatGPT responses and conversations into professional PDF documents. Simply copy your ChatGPT content, paste it here, preview the formatting, and download your PDF instantly for free.
            </p>
          </div>
        </div>

        {/* Right: How to use? 3-step card */}
        <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-3.5 sm:p-4 dark:border-violet-900/40 dark:bg-violet-950/20 shadow-xs shrink-0 self-start lg:self-center">
          <div className="flex items-center gap-1.5 text-xs font-bold text-violet-700 dark:text-violet-300 mb-2">
            <Info className="size-3.5" />
            <span>How to use?</span>
          </div>
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-violet-200/60 dark:border-violet-800 shadow-2xs">
              <Copy className="size-3.5 text-violet-600 dark:text-violet-400" />
              <span>Copy from ChatGPT</span>
            </div>
            <ArrowRight className="size-3 text-violet-400 shrink-0 hidden sm:inline" />
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-violet-200/60 dark:border-violet-800 shadow-2xs">
              <ClipboardPaste className="size-3.5 text-violet-600 dark:text-violet-400" />
              <span>Paste here</span>
            </div>
            <ArrowRight className="size-3 text-violet-400 shrink-0 hidden sm:inline" />
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-violet-200/60 dark:border-violet-800 shadow-2xs">
              <Download className="size-3.5 text-violet-600 dark:text-violet-400" />
              <span>Download PDF</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Dual-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Column: Editor Card with Tabs (Content, Settings, Style) */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-200/90 bg-card p-4 sm:p-5 shadow-xs dark:border-slate-800 flex flex-col h-full">
          {/* Top Tabs: Content, Settings, Style */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 mb-4 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("content")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "content"
                  ? "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300"
                  : "text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <FileText className="size-3.5" />
              <span>Content</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "settings"
                  ? "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300"
                  : "text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <SettingsIcon className="size-3.5" />
              <span>Settings</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("style")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "style"
                  ? "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300"
                  : "text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Palette className="size-3.5" />
              <span>Style</span>
            </button>
          </div>

          {/* Tab 1: Content Editor */}
          {activeTab === "content" && (
            <div className="flex-1 flex flex-col min-h-0">
              <ChatGptEditor
                data={data}
                onChange={setData}
                onClear={() => setData({ content: "" })}
              />
            </div>
          )}

          {/* Tab 2: Settings */}
          {activeTab === "settings" && (
            <div className="flex-1 overflow-y-auto py-1">
              <ChatGptSettings
                settings={settings}
                onChange={setSettings}
                onResetDefaults={() => setSettings(DEFAULT_SETTINGS)}
              />
            </div>
          )}

          {/* Tab 3: Style Themes */}
          {activeTab === "style" && (
            <div className="flex-1 overflow-y-auto space-y-4 py-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Select Visual Style
                </span>
                <span className="text-[11px] font-mono text-muted-foreground uppercase">
                  {settings.theme}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(["clean", "chatgpt", "modern", "academic", "minimal", "warm"] as DocumentTheme[]).map((thm) => {
                  const conf = THEME_CONFIGS[thm];
                  const isSelected = settings.theme === thm;
                  return (
                    <button
                      key={thm}
                      type="button"
                      onClick={() => setSettings((s) => ({ ...s, theme: thm }))}
                      className={`relative flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                        isSelected
                          ? "border-violet-600 bg-violet-50/70 dark:border-violet-500 dark:bg-violet-950/30 ring-1 ring-violet-500/40 shadow-xs"
                          : "border-slate-200 hover:border-slate-300 dark:border-slate-800 bg-card hover:bg-slate-50/50 dark:hover:bg-slate-900/50"
                      }`}
                    >
                      <div
                        className="mt-0.5 size-4 rounded-full shrink-0 shadow-xs border border-black/10"
                        style={{ backgroundColor: conf.primaryColor }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-foreground">
                            {conf.name}
                          </span>
                          {isSelected && (
                            <Check className="size-3.5 text-violet-600 dark:text-violet-400 stroke-[3]" />
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                          {conf.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: PDF Preview Card */}
        <div
          ref={containerRef}
          className="lg:col-span-6 rounded-2xl border border-slate-200/90 bg-card p-4 sm:p-5 shadow-xs dark:border-slate-800 flex flex-col h-full"
        >
          {/* Preview Header Bar */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
            {/* Title */}
            <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm">
              <FileText className="size-4 text-violet-600" />
              <span>PDF Preview</span>
            </div>

            {/* Middle: Pagination */}
            <div className="flex items-center gap-1 text-xs text-slate-700 dark:text-slate-300">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="font-mono text-xs font-semibold px-1">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
                title="Next page"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            {/* Right: Zoom & Fullscreen */}
            <div className="flex items-center gap-2">
              <select
                value={String(scale)}
                onChange={(e) => setScale(Number(e.target.value))}
                className="h-7 rounded-md border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="0.75">75%</option>
                <option value="0.9">90%</option>
                <option value="1">100%</option>
                <option value="1.15">115%</option>
                <option value="1.25">125%</option>
              </select>

              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="size-7 rounded-md border border-slate-200/90 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Preview"}
              >
                {isFullscreen ? (
                  <Minimize2 className="size-3.5" />
                ) : (
                  <Maximize2 className="size-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Preview Canvas */}
          <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-slate-100/90 dark:border-slate-800 dark:bg-zinc-950/90 p-4 sm:p-6 flex justify-center items-start flex-1 shadow-inner">
            <ChatGptPreview
              ref={previewRef}
              data={data}
              settings={settings}
              scale={scale}
              currentPage={currentPage}
              onTotalPagesCalculated={setTotalPages}
            />
          </div>
        </div>
      </div>

      {/* 3. Bottom Configuration & Download Bar matching the UI mockup */}
      <div className="rounded-2xl border border-slate-200/90 bg-card p-4 sm:p-5 shadow-xs dark:border-slate-800">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 items-end">
          {/* 1. Document Style */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <Palette className="size-3 text-violet-600" />
              <span>Document Style</span>
            </Label>
            <select
              value={settings.theme}
              onChange={(e) =>
                setSettings((s) => ({ ...s, theme: e.target.value as DocumentTheme }))
              }
              className="w-full h-9 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-background px-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              <option value="clean">Clean Document</option>
              <option value="chatgpt">ChatGPT Signature</option>
              <option value="modern">Modern Indigo</option>
              <option value="academic">Academic Journal</option>
              <option value="minimal">Pure Monochrome</option>
              <option value="warm">Warm Editorial</option>
            </select>
          </div>

          {/* 2. Page Size */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground">
              Page Size
            </Label>
            <select
              value={settings.pageSize}
              onChange={(e) =>
                setSettings((s) => ({ ...s, pageSize: e.target.value as PageSize }))
              }
              className="w-full h-9 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-background px-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              <option value="a4">A4 (210 × 297 mm)</option>
              <option value="letter">US Letter (8.5 × 11 in)</option>
            </select>
          </div>

          {/* 3. Orientation */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground">
              Orientation
            </Label>
            <select
              value={settings.orientation}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  orientation: e.target.value as Orientation,
                }))
              }
              className="w-full h-9 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-background px-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>

          {/* 4. Margins */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground">
              Margins
            </Label>
            <select
              value={settings.margin}
              onChange={(e) =>
                setSettings((s) => ({ ...s, margin: e.target.value as MarginSize }))
              }
              className="w-full h-9 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-background px-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              <option value="normal">Normal (20mm)</option>
              <option value="compact">Compact (12mm)</option>
              <option value="wide">Wide (28mm)</option>
            </select>
          </div>

          {/* 5. File Name */}
          <div className="space-y-1.5 col-span-2 sm:col-span-1">
            <Label className="text-[11px] font-semibold text-muted-foreground">
              File Name
            </Label>
            <Input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="chatgpt-conversation.pdf"
              className="h-9 rounded-xl border-slate-200/90 dark:border-slate-700 text-xs font-medium"
            />
          </div>

          {/* 6. Primary Action: Download PDF */}
          <div className="col-span-2 sm:col-span-2 lg:col-span-1">
            <Button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExportingPdf || !data.content.trim()}
              className="w-full h-10 gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs sm:text-sm px-4 rounded-xl shadow-md transition-all active:scale-[0.98]"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download className="size-4" />
                  <span>Download PDF</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
