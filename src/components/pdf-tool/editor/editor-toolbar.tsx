"use client";

/**
 * Rich text formatting toolbar. All buttons keep the editor selection alive
 * (preventDefault on mousedown) so commands apply to the user's selection.
 */

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Link2,
  Minus,
  Scissors,
  Eraser,
  Redo2,
  Undo2,
  Highlighter,
  Palette,
  Check,
  CaseSensitive,
  Omega,
  Table,
} from "lucide-react";
import * as commands from "@/lib/editor/commands";
import type { SelectionManager } from "@/lib/editor/dom";
import { normalizeHex } from "@/lib/pdf/colors";

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36];

const TEXT_COLORS = [
  "#111827",
  "#4b5563",
  "#9ca3af",
  "#dc2626",
  "#ea580c",
  "#d97706",
  "#16a34a",
  "#0d9488",
  "#7c3aed",
  "#db2777",
];

const HIGHLIGHT_COLORS = ["#fef08a", "#bbf7d0", "#bae6fd", "#fbcfe8", "#fed7aa", "#ddd6fe", "#e4e4e7"];

/** Case transform menu entries, labelled with a preview of their effect. */
const CASE_MODES: { label: string; mode: commands.CaseMode }[] = [
  { label: "UPPERCASE", mode: "upper" },
  { label: "lowercase", mode: "lower" },
  { label: "Title Case", mode: "title" },
  { label: "Sentence case", mode: "sentence" },
];

/** Curated special characters, grouped by category for the inserter popover. */
const SPECIAL_CHARACTERS: { label: string; chars: string[] }[] = [
  { label: "Punctuation", chars: ["—", "–", "‘", "’", "“", "”", "…", "•", "·", "§", "¶"] },
  { label: "Math", chars: ["±", "×", "÷", "≈", "≠", "≤", "≥", "°"] },
  { label: "Arrows", chars: ["→", "←", "↔", "⇒"] },
  { label: "Symbols", chars: ["©", "®", "™", "✓", "✗", "★", "♥"] },
  { label: "Currency", chars: ["€", "£", "¥", "₹", "¢"] },
];

/** Row-major coordinates for the 8x8 table size picker grid. */
const TABLE_GRID: { r: number; c: number }[] = Array.from({ length: 64 }, (_, i) => ({
  r: Math.floor(i / 8),
  c: i % 8,
}));

interface EditorToolbarProps {
  selection: SelectionManager;
  /** Re-render signal; bumped whenever the editor selection changes. */
  selectionVersion: number;
  /** Font size (pt) of the current selection, tracked by the parent. */
  currentSizePt: number;
  onSetFontSize: (pt: number) => void;
  onContentChange: () => void;
  onOpenLinkDialog: () => void;
  /** Applies a case transformation to the selection (or whole document). */
  onTransformCase: (mode: commands.CaseMode) => void;
}

function ColorPopover({
  icon,
  label,
  colors,
  onPick,
  onClear,
  clearLabel,
}: {
  icon: React.ReactNode;
  label: string;
  colors: string[];
  onPick: (color: string) => void;
  onClear?: () => void;
  clearLabel?: string;
}) {
  const [custom, setCustom] = useState("#111827");
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={label} className="h-8 w-8">
              {icon}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-56 p-3">
        <div className="grid grid-cols-5 gap-1.5" role="group" aria-label={`${label} presets`}>
          {colors.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Color ${color}`}
              className="h-7 w-7 rounded-md border border-border transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ backgroundColor: color }}
              onClick={() => onPick(color)}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="color"
            aria-label={`Custom ${label}`}
            className="h-8 w-10 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
          <Input
            className="h-8 flex-1 font-mono text-xs"
            value={custom}
            aria-label={`${label} hex value`}
            onChange={(e) => {
              const v = e.target.value;
              setCustom(v);
              if (normalizeHex(v, "") !== "") onPick(normalizeHex(v));
            }}
          />
        </div>
        {onClear && (
          <Button variant="outline" size="sm" className="mt-3 w-full" onClick={onClear}>
            <Check className="h-3.5 w-3.5" aria-hidden />
            {clearLabel ?? "Reset to default"}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Popover with a grid of curated special characters to insert. */
function SpecialCharactersPopover({ onInsert }: { onInsert: (char: string) => void }) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Insert special character"
              onMouseDown={(e) => e.preventDefault()}
            >
              <Omega className="h-4 w-4" aria-hidden />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Insert special character</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-80 p-3">
        <div className="space-y-2.5">
          {SPECIAL_CHARACTERS.map((group) => (
            <div key={group.label}>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              <div className="grid grid-cols-8 gap-1" role="group" aria-label={`${group.label} characters`}>
                {group.chars.map((char) => (
                  <button
                    key={char}
                    type="button"
                    aria-label={`Insert ${char}`}
                    className="h-8 w-8 rounded-md border border-border text-base font-medium transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => onInsert(char)}
                  >
                    {char}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Dropdown with an 8x8 grid picker that inserts a table of the hovered size. */
function TablePickerDropdown({ onInsert }: { onInsert: (rows: number, cols: number) => void }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setHover(null);
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Insert table"
              onMouseDown={(e) => e.preventDefault()}
            >
              <Table className="h-4 w-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Insert table</TooltipContent>
      </Tooltip>
      {/* Focus stays in the editor after inserting (the command restores the
          saved selection), so skip Radix returning focus to the trigger. */}
      <DropdownMenuContent
        align="start"
        className="w-52 p-3"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="grid grid-cols-8 gap-0.5" role="group" aria-label="Table size">
          {TABLE_GRID.map(({ r, c }) => {
            const active = hover !== null && r <= hover.r && c <= hover.c;
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                aria-label={`Insert ${r + 1} by ${c + 1} table`}
                className={`h-5 w-5 rounded-[3px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active ? "border-primary/70 bg-primary/70" : "border-border bg-muted/40"
                }`}
                onMouseEnter={() => setHover({ r, c })}
                onFocus={() => setHover({ r, c })}
                onClick={() => {
                  setOpen(false);
                  setHover(null);
                  onInsert(r + 1, c + 1);
                }}
              />
            );
          })}
        </div>
        <p className="mt-2 text-center text-xs tabular-nums text-muted-foreground" aria-live="polite">
          {hover ? `${hover.r + 1} × ${hover.c + 1} table` : "Insert table"}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function EditorToolbar({
  selection,
  selectionVersion,
  currentSizePt,
  onSetFontSize,
  onContentChange,
  onOpenLinkDialog,
  onTransformCase,
}: EditorToolbarProps) {
  // Reading command state on every render keeps toggles in sync with the
  // actual selection (selectionVersion bumps trigger re-renders).
  void selectionVersion;

  const withSelection = useCallback(
    (fn: () => void) => {
      selection.restore();
      fn();
      onContentChange();
      selection.save();
    },
    [selection, onContentChange]
  );

  const block = commands.currentBlock();
  const family = commands.currentFontFamily();
  const size = currentSizePt;

  return (
    <TooltipProvider delayDuration={300}>
      <div
        role="toolbar"
        aria-label="Text formatting"
        className="flex flex-wrap items-center gap-1 border-b bg-muted/30 px-2 py-1.5"
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Undo"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => withSelection(() => commands.undo())}
        >
          <Undo2 className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Redo"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => withSelection(() => commands.redo())}
        >
          <Redo2 className="h-4 w-4" aria-hidden />
        </Button>

        <div aria-hidden className="mx-1 h-6 w-px shrink-0 bg-border" />

        <Select
          value={block}
          onValueChange={(value) => withSelection(() => commands.setBlock(value as commands.BlockTag))}
        >
          <SelectTrigger className="h-8 w-[118px] text-xs" aria-label="Paragraph style">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="P">Paragraph</SelectItem>
            <SelectItem value="H1">Heading 1</SelectItem>
            <SelectItem value="H2">Heading 2</SelectItem>
            <SelectItem value="H3">Heading 3</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={family}
          onValueChange={(value) => withSelection(() => commands.setFontFamily(value as commands.EditorFamily))}
        >
          <SelectTrigger className="h-8 w-[92px] text-xs" aria-label="Font family">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sans-serif">Sans</SelectItem>
            <SelectItem value="serif">Serif</SelectItem>
            <SelectItem value="monospace">Mono</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={String(FONT_SIZES.includes(size) ? size : 11)}
          onValueChange={(value) => withSelection(() => onSetFontSize(Number(value)))}
        >
          <SelectTrigger className="h-8 w-[68px] text-xs" aria-label="Font size">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_SIZES.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s} pt
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div aria-hidden className="mx-1 h-6 w-px shrink-0 bg-border" />

        <Toggle
          size="sm"
          className="h-8 w-8 p-0"
          aria-label="Bold"
          onMouseDown={(e) => e.preventDefault()}
          pressed={commands.queryState("bold")}
          onPressedChange={() => withSelection(() => commands.setBold(!commands.queryState("bold")))}
        >
          <Bold className="h-4 w-4" aria-hidden />
        </Toggle>
        <Toggle
          size="sm"
          className="h-8 w-8 p-0"
          aria-label="Italic"
          onMouseDown={(e) => e.preventDefault()}
          pressed={commands.queryState("italic")}
          onPressedChange={() => withSelection(() => commands.setItalic(!commands.queryState("italic")))}
        >
          <Italic className="h-4 w-4" aria-hidden />
        </Toggle>
        <Toggle
          size="sm"
          className="h-8 w-8 p-0"
          aria-label="Underline"
          onMouseDown={(e) => e.preventDefault()}
          pressed={commands.queryState("underline")}
          onPressedChange={() => withSelection(() => commands.setUnderline(!commands.queryState("underline")))}
        >
          <Underline className="h-4 w-4" aria-hidden />
        </Toggle>
        <Toggle
          size="sm"
          className="h-8 w-8 p-0"
          aria-label="Strikethrough"
          onMouseDown={(e) => e.preventDefault()}
          pressed={commands.queryState("strikeThrough")}
          onPressedChange={() => withSelection(() => commands.setStrike(!commands.queryState("strikeThrough")))}
        >
          <Strikethrough className="h-4 w-4" aria-hidden />
        </Toggle>

        <ColorPopover
          icon={<Palette className="h-4 w-4" aria-hidden />}
          label="Text color"
          colors={TEXT_COLORS}
          onPick={(color) => withSelection(() => commands.setTextColor(color))}
          onClear={() => withSelection(() => commands.setTextColor("#111827"))}
          clearLabel="Reset to default color"
        />
        <ColorPopover
          icon={<Highlighter className="h-4 w-4" aria-hidden />}
          label="Highlight color"
          colors={HIGHLIGHT_COLORS}
          onPick={(color) => withSelection(() => commands.setHighlight(color))}
          onClear={() => {
            withSelection(() => {
              try {
                document.execCommand("hiliteColor", false, "transparent");
                document.execCommand("backColor", false, "transparent");
              } catch {
                /* ignore */
              }
            });
          }}
          clearLabel="Remove highlight"
        />

        <div aria-hidden className="mx-1 h-6 w-px shrink-0 bg-border" />

        <ToggleGroup
          type="single"
          className="gap-1"
          aria-label="Text alignment"
          onValueChange={(value) => {
            if (value) withSelection(() => commands.setTextAlign(value as "left" | "center" | "right" | "justify"));
          }}
        >
          <ToggleGroupItem value="left" className="h-8 w-8 p-0" aria-label="Align left" onMouseDown={(e) => e.preventDefault()}>
            <AlignLeft className="h-4 w-4" aria-hidden />
          </ToggleGroupItem>
          <ToggleGroupItem value="center" className="h-8 w-8 p-0" aria-label="Align center" onMouseDown={(e) => e.preventDefault()}>
            <AlignCenter className="h-4 w-4" aria-hidden />
          </ToggleGroupItem>
          <ToggleGroupItem value="right" className="h-8 w-8 p-0" aria-label="Align right" onMouseDown={(e) => e.preventDefault()}>
            <AlignRight className="h-4 w-4" aria-hidden />
          </ToggleGroupItem>
          <ToggleGroupItem value="justify" className="h-8 w-8 p-0" aria-label="Justify" onMouseDown={(e) => e.preventDefault()}>
            <AlignJustify className="h-4 w-4" aria-hidden />
          </ToggleGroupItem>
        </ToggleGroup>

        <Toggle
          size="sm"
          className="h-8 w-8 p-0"
          aria-label="Bullet list"
          onMouseDown={(e) => e.preventDefault()}
          onPressedChange={() => withSelection(() => commands.toggleUnorderedList())}
        >
          <List className="h-4 w-4" aria-hidden />
        </Toggle>
        <Toggle
          size="sm"
          className="h-8 w-8 p-0"
          aria-label="Numbered list"
          onMouseDown={(e) => e.preventDefault()}
          onPressedChange={() => withSelection(() => commands.toggleOrderedList())}
        >
          <ListOrdered className="h-4 w-4" aria-hidden />
        </Toggle>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Change text case"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <CaseSensitive className="h-4 w-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Change text case</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start">
            {CASE_MODES.map((item) => (
              <DropdownMenuItem key={item.mode} onClick={() => withSelection(() => onTransformCase(item.mode))}>
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <TablePickerDropdown onInsert={(rows, cols) => withSelection(() => commands.insertTable(rows, cols))} />

        <div aria-hidden className="mx-1 h-6 w-px shrink-0 bg-border" />

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Insert link"
          aria-keyshortcuts="Control+K"
          title="Insert link"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onOpenLinkDialog}
        >
          <Link2 className="h-4 w-4" aria-hidden />
        </Button>
        <SpecialCharactersPopover
          onInsert={(char) => withSelection(() => commands.insertPlainText(char))}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Horizontal separator"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => withSelection(() => commands.insertHorizontalRule())}
        >
          <Minus className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Insert page break"
          title="Insert page break"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => withSelection(() => commands.insertPageBreak())}
        >
          <Scissors className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Clear formatting"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => withSelection(() => commands.removeFormat())}
        >
          <Eraser className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </TooltipProvider>
  );
}
