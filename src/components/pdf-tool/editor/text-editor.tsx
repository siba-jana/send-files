"use client";

/**
 * The document editor: mode tabs (rich/plain), formatting toolbar, the
 * editing surface, statistics bar, fullscreen mode, TXT import and draft
 * restore. Content is sanitised on paste and before any store write-back.
 *
 * Note on stability: all callbacks passed to child components are wrapped in
 * useCallback. The find & replace dialog in particular holds effects that
 * depend on these callbacks, so unstable identities would re-trigger its
 * cleanup logic on every render and can feedback-loop with the editor DOM.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search,
  Trash2,
  Maximize2,
  Minimize2,
  FileUp,
  Sparkles,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { MAX_CHARS, useToolStore } from "@/store/tool-store";
import { SelectionManager, htmlToPlainText } from "@/lib/editor/dom";
import { sanitizeEditorHtml, htmlIsEmpty } from "@/lib/editor/sanitize";
import * as commands from "@/lib/editor/commands";
import { FONT_FAMILIES } from "@/lib/pdf/fonts";
import { computeStats } from "@/lib/pdf/stats";
import { EditorToolbar } from "./editor-toolbar";
import { FindReplaceDialog } from "./find-replace-dialog";
import { LinkDialog } from "./link-dialog";

const IMPORT_SIZE_LIMIT = 2 * 1024 * 1024; // 2 MB

export function TextEditor() {
  const mode = useToolStore((s) => s.mode);
  const html = useToolStore((s) => s.html);
  const plainText = useToolStore((s) => s.plainText);
  const config = useToolStore((s) => s.config);
  const setMode = useToolStore((s) => s.setMode);
  const setHtml = useToolStore((s) => s.setHtml);
  const setPlainText = useToolStore((s) => s.setPlainText);
  const clearContent = useToolStore((s) => s.clearContent);
  const loadSample = useToolStore((s) => s.loadSample);
  const importText = useToolStore((s) => s.importText);

  const editorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSyncedHtml = useRef<string>("");
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredRef = useRef(false);

  // Stable selection manager shared with the toolbar and dialogs.
  const selection = useMemo(() => new SelectionManager(null), []);

  const [selectionVersion, setSelectionVersion] = useState(0);
  const [currentSizePt, setCurrentSizePt] = useState(11);
  const [fullscreen, setFullscreen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  /* ---------------- content sync ---------------- */

  // Push editor DOM -> store (debounced while typing).
  const syncFromEditor = useCallback((immediate = false) => {
    const root = editorRef.current;
    if (!root || useToolStore.getState().mode !== "rich") return;
    const current = root.innerHTML;
    lastSyncedHtml.current = current;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    if (immediate) {
      useToolStore.getState().setHtml(current);
    } else {
      pushTimer.current = setTimeout(() => {
        useToolStore.getState().setHtml(current);
      }, 250);
    }
  }, []);

  const syncFromEditorImmediate = useCallback(() => syncFromEditor(true), [syncFromEditor]);

  // Apply store -> editor DOM when content changes outside the editor
  // (draft restore, mode switch, clear, sample, import, find & replace).
  useEffect(() => {
    if (mode !== "rich") return;
    const root = editorRef.current;
    if (!root) return;
    if (html !== lastSyncedHtml.current) {
      root.innerHTML = html ? sanitizeEditorHtml(html) : "";
      lastSyncedHtml.current = html;
    }
  }, [html, mode]);

  // Notify once after the session draft has been restored.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const timer = setTimeout(() => {
      const state = useToolStore.getState();
      if (state.html || state.plainText) {
        setDraftRestored(true);
        lastSyncedHtml.current = state.html;
      }
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (draftRestored) {
      toast.info("Draft restored from this browser session.", {
        action: {
          label: "Discard",
          onClick: () => {
            clearContent();
            toast.success("Draft discarded.");
          },
        },
      });
    }
  }, [draftRestored, clearContent]);

  // Fullscreen escape key.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  // Editor shortcuts: Ctrl/Cmd+H opens find & replace (both modes),
  // Ctrl/Cmd+K opens the link dialog (rich text mode only).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      const key = e.key.toLowerCase();
      if (key === "h") {
        e.preventDefault();
        setFindOpen(true);
      } else if (key === "k" && mode === "rich") {
        e.preventDefault();
        setLinkOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode]);

  // Selection tracking for the toolbar.
  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
        selection.save();
        setSelectionVersion((v) => v + 1);
        const size = commands.currentFontSizePt(editorRef.current, useToolStore.getState().config.typography.fontSize);
        setCurrentSizePt(size);
      }
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, [selection]);

  useEffect(() => {
    selection.setRoot(editorRef.current);
  }, [selection]);

  const handleSetFontSize = useCallback((pt: number) => {
    const root = editorRef.current;
    if (root) commands.setFontSize(root, pt);
  }, []);

  /* ---------------- editor handlers ---------------- */

  const handleInput = useCallback(() => {
    const text = editorRef.current?.innerText ?? "";
    if (text.length > MAX_CHARS) {
      toast.error(`The editor supports up to ${MAX_CHARS.toLocaleString()} characters.`);
    }
    syncFromEditor();
  }, [syncFromEditor]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const root = editorRef.current;
      if (!root) return;
      const currentLength = (root.innerText ?? "").length;
      const remaining = MAX_CHARS - currentLength;

      const htmlData = e.clipboardData.getData("text/html");
      const textData = e.clipboardData.getData("text/plain");

      if (htmlData && remaining > 0) {
        let clean = sanitizeEditorHtml(htmlData);
        if (remaining < clean.length) {
          clean = clean.slice(0, remaining);
          toast.warning(`Paste truncated to stay within the ${MAX_CHARS.toLocaleString()} character limit.`);
        }
        document.execCommand("styleWithCSS", false, "true");
        document.execCommand("insertHTML", false, clean);
      } else if (textData && remaining > 0) {
        const insert = textData.length > remaining ? textData.slice(0, remaining) : textData;
        if (textData.length > remaining) {
          toast.warning(`Paste truncated to stay within the ${MAX_CHARS.toLocaleString()} character limit.`);
        }
        document.execCommand("insertText", false, insert);
      } else if (remaining <= 0) {
        toast.error(`The editor supports up to ${MAX_CHARS.toLocaleString()} characters.`);
      }
      syncFromEditor(true);
    },
    [syncFromEditor]
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (file.size > IMPORT_SIZE_LIMIT) {
        toast.error("Text files up to 2 MB are supported.");
        return;
      }
      try {
        const text = await file.text();
        const warning = importText(text);
        if (warning) toast.warning(warning);
        else toast.success(`Imported ${file.name}`);
      } catch {
        toast.error("The file could not be read.");
      }
    },
    [importText]
  );

  /* ---------------- drag & drop .txt import ---------------- */

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear the overlay when the pointer actually leaves the surface
    // (moves between child elements of the wrapper must keep it active).
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      // Non-file drags (e.g. text) keep their native behaviour.
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (!file) return;
      const isTextFile = file.name.toLowerCase().endsWith(".txt") || file.type.startsWith("text/");
      if (!isTextFile) {
        toast.error("Only .txt text files can be imported.");
        return;
      }
      // Size limit and read errors (with their toasts) are handled inside.
      void handleFile(file);
    },
    [handleFile]
  );

  const handleTransformCase = useCallback((caseMode: commands.CaseMode) => {
    commands.transformCase(editorRef.current, caseMode);
  }, []);

  const handleClear = () => {
    // Clearing the store is enough: html becomes "" while lastSyncedHtml
    // still holds the previous value, so the sync effect wipes the DOM.
    clearContent();
    setClearOpen(false);
    toast.success("Editor cleared.");
  };

  /* ---------------- derived ---------------- */

  const contentText = useMemo(
    () => (mode === "plain" ? plainText : htmlToPlainText(html)),
    [mode, plainText, html]
  );

  const stats = useMemo(() => computeStats(contentText, config), [contentText, config]);

  const isEmpty = useMemo(
    () => (mode === "plain" ? plainText.trim().length === 0 : htmlIsEmpty(html)),
    [mode, plainText, html]
  );

  const ty = config.typography;
  const surfaceStyle = useMemo<React.CSSProperties>(
    () => ({
      fontFamily: FONT_FAMILIES[ty.fontFamily]?.cssStack ?? undefined,
      fontSize: `${ty.fontSize}pt`,
      lineHeight: ty.lineHeight,
      letterSpacing: ty.letterSpacing > 0 ? `${ty.letterSpacing}pt` : undefined,
      color: "#111827",
    }),
    [ty.fontFamily, ty.fontSize, ty.lineHeight, ty.letterSpacing]
  );

  const nearLimit = contentText.length > MAX_CHARS * 0.9;

  return (
    <section
      aria-label="Text editor"
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex flex-col bg-background p-3 sm:p-4"
          : "flex h-full min-h-0 flex-col rounded-xl border bg-card shadow-sm"
      }
    >
      {/* header */}
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <Tabs value={mode} onValueChange={(v) => setMode(v as "rich" | "plain")}>
          <TabsList className="h-8">
            <TabsTrigger value="rich" className="h-6 px-3 text-xs">
              Rich text
            </TabsTrigger>
            <TabsTrigger value="plain" className="h-6 px-3 text-xs">
              Plain text
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="ml-auto flex flex-wrap items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            aria-hidden
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={() => fileInputRef.current?.click()}>
                  <FileUp className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">Import TXT</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open a .txt file into the editor</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={() => loadSample()}>
                  <Sparkles className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">Sample</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Load a formatted sample document</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  onClick={() => setFindOpen(true)}
                  aria-keyshortcuts="Control+H"
                >
                  <Search className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">Find</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Find and replace (Ctrl+H)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Clear all content"
                  onClick={() => setClearOpen(true)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear the editor</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={fullscreen ? "Exit full screen" : "Full screen editing"}
                  onClick={() => setFullscreen((f) => !f)}
                >
                  {fullscreen ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{fullscreen ? "Exit full screen (Esc)" : "Edit in full screen"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* toolbar (rich mode only) */}
      {mode === "rich" && (
        <EditorToolbar
          selection={selection}
          selectionVersion={selectionVersion}
          currentSizePt={currentSizePt}
          onSetFontSize={handleSetFontSize}
          onContentChange={syncFromEditorImmediate}
          onOpenLinkDialog={() => setLinkOpen(true)}
          onTransformCase={handleTransformCase}
        />
      )}

      {/* surface */}
      <div
        className="relative min-h-0 flex-1 bg-white text-zinc-900"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {mode === "rich" ? (
          <div
            ref={editorRef}
            role="textbox"
            aria-multiline="true"
            aria-label="Document editor"
            contentEditable
            suppressContentEditableWarning
            spellCheck
            dir="auto"
            className="t2p-editor t2p-scroll h-full min-h-[320px] overflow-y-auto px-4 py-4 sm:px-6 outline-none focus-visible:outline-none sm:focus-visible:ring-2 sm:focus-visible:ring-inset sm:focus-visible:ring-emerald-500/40"
            style={surfaceStyle}
            onInput={handleInput}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              // Markdown auto-format: "# ", "## ", "- ", "1. ", "> ", "--- ".
              if (
                e.key === " " &&
                !e.nativeEvent.isComposing &&
                !e.shiftKey &&
                !e.altKey &&
                !e.ctrlKey &&
                !e.metaKey
              ) {
                if (commands.handleMarkdownSpace(editorRef.current)) e.preventDefault();
              }
            }}
            onBlur={() => syncFromEditor(true)}
            onDrop={(e) => e.preventDefault()}
            data-placeholder="Start typing or paste your text here..."
          />
        ) : (
          <textarea
            ref={textareaRef}
            aria-label="Document editor (plain text)"
            dir="auto"
            className="t2p-scroll h-full min-h-[320px] w-full resize-none overflow-y-auto bg-white px-4 py-4 text-zinc-900 outline-none sm:px-6 sm:focus-visible:ring-2 sm:focus-visible:ring-inset sm:focus-visible:ring-emerald-500/40"
            style={surfaceStyle}
            value={plainText}
            placeholder="Start typing or paste your text here..."
            onChange={(e) => {
              if (e.target.value.length > MAX_CHARS) {
                toast.error(`The editor supports up to ${MAX_CHARS.toLocaleString()} characters.`);
                e.target.value = e.target.value.slice(0, MAX_CHARS);
              }
              setPlainText(e.target.value);
            }}
          />
        )}

        {isEmpty && (
          <div
            aria-hidden
            className="pointer-events-none absolute left-4 top-4 select-none text-base text-zinc-400 sm:left-6"
            style={{ fontFamily: surfaceStyle.fontFamily, fontSize: surfaceStyle.fontSize }}
          >
            <FileText className="mb-2 h-5 w-5 opacity-60" aria-hidden />
            Start typing or paste your text here. Use the Sample button to see
            formatted output, or import a .txt file.
          </div>
        )}

        {dragActive && (
          <div
            role="status"
            className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-emerald-500 bg-emerald-50/90 text-sm font-medium text-emerald-700"
          >
            <FileUp className="mr-2 h-4 w-4 shrink-0" aria-hidden />
            Drop your .txt file to import it
          </div>
        )}
      </div>

      {/* stats bar */}
      <div
        suppressHydrationWarning
        className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground"
      >
        <span suppressHydrationWarning>
          <strong className="font-semibold text-foreground">{stats.words.toLocaleString()}</strong> words
        </span>
        <span suppressHydrationWarning>
          <strong className="font-semibold text-foreground">{stats.characters.toLocaleString()}</strong> characters
        </span>
        <span suppressHydrationWarning>
          <strong className="font-semibold text-foreground">{stats.paragraphs.toLocaleString()}</strong> paragraphs
        </span>
        <span suppressHydrationWarning>
          <strong className="font-semibold text-foreground">
            {stats.estimatedPages ? `~${stats.estimatedPages}` : 0}
          </strong>{" "}
          pages
        </span>
        {stats.readingMinutes > 0 && (
          <span suppressHydrationWarning>
            <strong className="font-semibold text-foreground">~{stats.readingMinutes}</strong> min read
          </span>
        )}
        {nearLimit && (
          <span className="text-amber-600 dark:text-amber-400" role="status">
            Near the {MAX_CHARS.toLocaleString()} character limit
          </span>
        )}
        <span className="ml-auto hidden items-center gap-1 sm:flex">
          Draft saved in this session
        </span>
      </div>

      {/* dialogs */}
      <FindReplaceDialog
        open={findOpen}
        onOpenChange={setFindOpen}
        mode={mode}
        editorRef={editorRef}
        textareaRef={textareaRef}
        plainText={plainText}
        onPlainTextChange={setPlainText}
        onRichContentChange={syncFromEditorImmediate}
      />
      {linkOpen && (
        <LinkDialog
          open={linkOpen}
          onOpenChange={setLinkOpen}
          selection={selection}
          onContentChange={syncFromEditorImmediate}
        />
      )}
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all content?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the entire document from the editor. Your PDF settings
              are kept. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear} className="bg-destructive text-white hover:bg-destructive/90">
              Clear content
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
