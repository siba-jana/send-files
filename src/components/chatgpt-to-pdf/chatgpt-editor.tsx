"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  ClipboardPaste,
  FileUp,
  Trash2,
  Sparkles,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Table as TableIcon,
  Undo2,
  Redo2,
  ChevronDown,
} from "lucide-react";
import { DocumentData } from "./types";
import { CHATGPT_SAMPLES } from "./chatgpt-sample-data";
import { parseMarkdownFile } from "./chatgpt-import";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/context";

interface ChatGptEditorProps {
  data: DocumentData;
  onChange: (updated: DocumentData) => void;
  onClear: () => void;
}

export function ChatGptEditor({
  data,
  onChange,
  onClear,
}: ChatGptEditorProps) {
  const { t } = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Undo / Redo history
  const [history, setHistory] = useState<string[]>([data.content]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Sync initial history when saved draft loads on client
  useEffect(() => {
    if (history.length <= 1 && history[0] !== data.content) {
      setHistory([data.content]);
      setHistoryIndex(0);
    }
  }, [data.content]);

  const updateContent = (content: string, pushHistory = true) => {
    onChange({ content });
    if (pushHistory && content !== history[historyIndex]) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(content);
      if (newHistory.length > 50) newHistory.shift();
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      onChange({ content: prev });
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      onChange({ content: next });
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      updateContent(text);
    } catch {
      // Fallback: prompt focus
      textareaRef.current?.focus();
    }
  };

  const processImportedFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const raw = event.target?.result as string;
      if (raw) {
        const parsed = parseMarkdownFile(raw, file.name);
        updateContent(parsed.content);
      }
    };
    reader.readAsText(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImportedFile(file);
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processImportedFile(file);
  };

  const handleLoadSample = () => {
    updateContent(CHATGPT_SAMPLES[0].content);
  };

  // Helper to wrap or insert formatting
  const insertFormat = (before: string, after: string = "", defaultText: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value;

    const selectedText = currentVal.substring(start, end) || defaultText;
    const replacement = `${before}${selectedText}${after}`;

    const newVal = currentVal.substring(0, start) + replacement + currentVal.substring(end);
    updateContent(newVal);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 10);
  };

  // Heading formatter
  const applyHeading = (level: number) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const currentVal = textarea.value;

    const lineStart = currentVal.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = currentVal.indexOf("\n", start);
    const effectiveEnd = lineEnd === -1 ? currentVal.length : lineEnd;
    const line = currentVal.substring(lineStart, effectiveEnd);

    const cleanLine = line.replace(/^#{1,6}\s+/, "");
    const prefix = level > 0 ? `${"#".repeat(level)} ` : "";
    const newLine = `${prefix}${cleanLine}`;

    const newVal = currentVal.substring(0, lineStart) + newLine + currentVal.substring(effectiveEnd);
    updateContent(newVal);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(lineStart + newLine.length, lineStart + newLine.length);
    }, 10);
  };

  const insertTable = () => {
    const tableTemplate = `\n| Item | Description | Status |\n| :--- | :--- | :--- |\n| Feature 1 | Fast & Secure | Done |\n| Feature 2 | Multi-platform | Active |\n\n`;
    insertFormat("", "", tableTemplate);
  };

  // Stats calculation
  const words = data.content.trim() ? data.content.trim().split(/\s+/).length : 0;
  const characters = data.content.length;
  const estPages = Math.max(1, Math.ceil(words / 320));

  return (
    <div className="flex flex-col h-full flex-1 min-h-0">
      {/* Hidden file picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.mdown,.mkd,.txt"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Editor Header Label */}
      <div className="flex items-center justify-between pb-2 shrink-0">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
          Paste Your ChatGPT Content
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-violet-600 transition-colors"
            title="Import .md file"
          >
            <FileUp className="size-3" />
            <span>Upload .md</span>
          </button>
          <button
            type="button"
            onClick={handleLoadSample}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-violet-600 transition-colors"
          >
            <Sparkles className="size-3 text-amber-500" />
            <span>Sample</span>
          </button>
        </div>
      </div>

      {/* Rich Formatting Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border rounded-t-xl bg-slate-50/90 dark:bg-slate-900/90 border-slate-200/90 dark:border-slate-800 p-1.5 text-slate-700 dark:text-slate-300 text-xs shrink-0">
        {/* Heading selector */}
        <div className="relative inline-flex items-center">
          <select
            onChange={(e) => applyHeading(Number(e.target.value))}
            defaultValue="1"
            className="h-7 rounded-md border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-violet-500 pr-5"
          >
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
            <option value="3">Heading 3</option>
            <option value="0">Paragraph</option>
          </select>
        </div>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Inline styles */}
        <button
          type="button"
          onClick={() => insertFormat("**", "**", "Bold text")}
          className="size-7 rounded flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          title="Bold (Ctrl+B)"
        >
          <Bold className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertFormat("*", "*", "Italic text")}
          className="size-7 rounded flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          title="Italic (Ctrl+I)"
        >
          <Italic className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertFormat("<u>", "</u>", "Underlined")}
          className="size-7 rounded flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          title="Underline"
        >
          <UnderlineIcon className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertFormat("~~", "~~", "Strikethrough")}
          className="size-7 rounded flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          title="Strikethrough"
        >
          <Strikethrough className="size-3.5" />
        </button>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Lists & blocks */}
        <button
          type="button"
          onClick={() => insertFormat("\n- ", "", "List item")}
          className="size-7 rounded flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          title="Bullet list"
        >
          <List className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertFormat("\n1. ", "", "First step")}
          className="size-7 rounded flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          title="Numbered list"
        >
          <ListOrdered className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertFormat("\n> ", "", "Quote text")}
          className="size-7 rounded flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          title="Quote"
        >
          <Quote className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertFormat("\n```bash\n", "\n```\n", "npm run dev")}
          className="size-7 rounded flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          title="Code block"
        >
          <Code className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => insertFormat("[", "](https://example.com)", "link title")}
          className="size-7 rounded flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          title="Insert link"
        >
          <LinkIcon className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={insertTable}
          className="size-7 rounded flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          title="Insert table"
        >
          <TableIcon className="size-3.5" />
        </button>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Undo / Redo */}
        <button
          type="button"
          onClick={handleUndo}
          disabled={historyIndex <= 0}
          className="size-7 rounded flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
          title="Undo"
        >
          <Undo2 className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={handleRedo}
          disabled={historyIndex >= history.length - 1}
          className="size-7 rounded flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
          title="Redo"
        >
          <Redo2 className="size-3.5" />
        </button>
      </div>

      {/* Main Textarea with Drag & Drop */}
      <div
        className={`relative flex-1 flex flex-col min-h-0 border border-t-0 rounded-b-xl transition-all duration-200 overflow-hidden ${
          isDragging
            ? "border-violet-500 ring-2 ring-violet-500/30 bg-violet-50/20"
            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/95 backdrop-blur-xs border-2 border-dashed border-violet-500 rounded-b-xl pointer-events-none">
            <FileUp className="size-8 text-violet-600 animate-bounce mb-2" />
            <p className="text-sm font-bold text-foreground">Drop .md or .txt file here</p>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={data.content}
          onChange={(e) => updateContent(e.target.value)}
          placeholder="Paste your ChatGPT text or Markdown here... (Ctrl+V)&#10;&#10;Code blocks, headings, LaTeX math, and tables are formatted automatically!"
          className="flex-1 w-full h-full p-4 text-xs sm:text-sm font-mono leading-relaxed bg-transparent focus:outline-none resize-none text-slate-800 dark:text-slate-100"
        />
      </div>

      {/* Editor Bottom Bar: Stats + Clear + Paste from Clipboard */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 shrink-0">
        {/* Left Metrics */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
          <span>Words: <strong className="text-slate-900 dark:text-slate-100">{words}</strong></span>
          <span>Characters: <strong className="text-slate-900 dark:text-slate-100">{characters}</strong></span>
          <span>Est. Pages: <strong className="text-slate-900 dark:text-slate-100">{estPages}</strong></span>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2">
          {data.content && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClear}
              className="h-9 px-3 gap-1.5 text-xs text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              <Trash2 className="size-3.5 text-slate-500" />
              <span>Clear</span>
            </Button>
          )}

          <Button
            type="button"
            onClick={handlePasteClipboard}
            className="h-9 px-4 gap-1.5 bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all active:scale-[0.98]"
          >
            <ClipboardPaste className="size-3.5" />
            <span>Paste from Clipboard</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
