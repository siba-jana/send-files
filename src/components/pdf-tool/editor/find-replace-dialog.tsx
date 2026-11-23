"use client";

/**
 * Find & replace dialog that works in both editor modes:
 * rich mode highlights matches inside the contentEditable surface,
 * plain mode counts and navigates matches inside the textarea.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import type { EditorMode } from "@/store/tool-store";
import {
  focusMatch,
  plainFind,
  plainReplaceAll,
  richCleanup,
  richFind,
  richReplaceAll,
  richReplaceCurrent,
} from "@/lib/editor/find-replace";

interface FindReplaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: EditorMode;
  editorRef: React.RefObject<HTMLDivElement | null>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  plainText: string;
  onPlainTextChange: (text: string) => void;
  onRichContentChange: () => void;
}

export function FindReplaceDialog({
  open,
  onOpenChange,
  mode,
  editorRef,
  textareaRef,
  plainText,
  onPlainTextChange,
  onRichContentChange,
}: FindReplaceDialogProps) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [count, setCount] = useState(0);
  const [current, setCurrent] = useState(0);

  const runFind = useCallback(
    (focusIndex?: number) => {
      if (mode === "rich") {
        const root = editorRef.current;
        if (!root) return;
        if (!query) {
          richCleanup(root);
          setCount(0);
          return;
        }
        const result = richFind(root, query, { caseSensitive });
        setCount(result.count);
        setCurrent((prev) => {
          const next = result.count ? (focusIndex ?? prev) % result.count : 0;
          if (result.count) focusMatch(root, next);
          return next;
        });
        if (result.domChanged) onRichContentChange();
      } else {
        if (!query) {
          setCount(0);
          return;
        }
        const matches = plainFind(plainText, query, { caseSensitive });
        setCount(matches.length);
        setCurrent((prev) => {
          const next = matches.length ? (focusIndex ?? prev) % matches.length : 0;
          const match = matches[next];
          const area = textareaRef.current;
          if (match && area) {
            area.focus();
            area.setSelectionRange(match.start, match.end);
            const ratio = match.start / Math.max(1, plainText.length);
            area.scrollTop = ratio * area.scrollHeight - area.clientHeight / 2;
          }
          return next;
        });
      }
    },
    [mode, editorRef, textareaRef, plainText, caseSensitive, query, onRichContentChange]
  );

  // Re-run find when the query or case sensitivity changes (only while open).
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => runFind(0), 120);
    return () => clearTimeout(timer);
  }, [query, caseSensitive, open]);

  // Clean up highlights when the dialog closes (transition only, so stable
  // callback identities cannot re-trigger this on unrelated re-renders).
  const wasOpenRef = useRef(false);
  useEffect(() => {
    const justClosed = wasOpenRef.current && !open;
    wasOpenRef.current = open;
    if (!justClosed) return;
    if (mode === "rich") {
      const root = editorRef.current;
      if (root) {
        richCleanup(root);
        onRichContentChange();
      }
    }
  }, [open, mode, editorRef, onRichContentChange]);

  const step = (delta: number) => {
    if (!count) return;
    const next = (current + delta + count) % count;
    setCurrent(next);
    if (mode === "rich") {
      const root = editorRef.current;
      if (root) focusMatch(root, next);
    } else {
      const matches = plainFind(plainText, query, { caseSensitive });
      const match = matches[next];
      const area = textareaRef.current;
      if (match && area) {
        area.focus();
        area.setSelectionRange(match.start, match.end);
      }
    }
  };

  const replaceCurrent = () => {
    if (!query || !count) return;
    if (mode === "rich") {
      const root = editorRef.current;
      if (!root) return;
      if (richReplaceCurrent(root, query, replacement, { caseSensitive })) {
        onRichContentChange();
        runFind(0);
      }
    } else {
      const matches = plainFind(plainText, query, { caseSensitive });
      const match = matches[current] ?? matches[0];
      if (!match) return;
      const next =
        plainText.slice(0, match.start) + replacement + plainText.slice(match.end);
      onPlainTextChange(next);
    }
  };

  const replaceAll = () => {
    if (!query) return;
    if (mode === "rich") {
      const root = editorRef.current;
      if (!root) return;
      const replaced = richReplaceAll(root, query, replacement, { caseSensitive });
      onRichContentChange();
      runFind(0);
      toast.success(`Replaced ${replaced} occurrence${replaced === 1 ? "" : "s"}`);
    } else {
      const { text, count: replaced } = plainReplaceAll(plainText, query, replacement, { caseSensitive });
      onPlainTextChange(text);
      toast.success(`Replaced ${replaced} occurrence${replaced === 1 ? "" : "s"}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Find &amp; replace</DialogTitle>
          <DialogDescription>
            Search within your document. Matches are highlighted in the editor.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="t2p-find">Find</Label>
            <div className="flex items-center gap-2">
              <Input
                id="t2p-find"
                value={query}
                placeholder="Search text"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    step(1);
                  }
                }}
                className="h-9"
              />
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label="Previous match" onClick={() => step(-1)}>
                <ArrowUp className="h-4 w-4" aria-hidden />
              </Button>
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label="Next match" onClick={() => step(1)}>
                <ArrowDown className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="t2p-replace">Replace with</Label>
            <Input
              id="t2p-replace"
              value={replacement}
              placeholder="Replacement text"
              onChange={(e) => setReplacement(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="t2p-case"
                checked={caseSensitive}
                onCheckedChange={(checked) => setCaseSensitive(checked === true)}
              />
              <Label htmlFor="t2p-case" className="text-sm font-normal">
                Match case
              </Label>
            </div>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {query ? (count ? `${current + 1} of ${count}` : "No matches") : ""}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={replaceCurrent} disabled={!count}>
              Replace
            </Button>
            <Button size="sm" onClick={replaceAll} disabled={!query}>
              Replace all
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
