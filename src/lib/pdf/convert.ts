/**
 * Converts sanitized editor HTML into a pdfmake content tree.
 *
 * The conversion runs in two passes:
 *  1. DOM walk -> simple intermediate blocks (paragraph, heading, list, table, hr)
 *  2. Blocks -> pdfmake content objects, assigning fonts per Unicode script,
 *     merging identical adjacent runs and applying global typography settings.
 *
 * The module is environment agnostic (browser + Node/Bun with a DOMParser shim)
 * and never executes any part of the input HTML.
 */

import { SCRIPT_FONT } from "./fonts";
import { segmentByScript, stripInvisible } from "./unicode";
import { normalizeHex } from "./colors";
import type { Align, PdfConfig } from "./types";

/* ------------------------------------------------------------------ */
/* Intermediate representation                                         */
/* ------------------------------------------------------------------ */

interface RunStyle {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  background?: string;
  fontSize?: number;
  fontFamily?: string;
  link?: string;
}

interface InlineRun {
  text: string;
  s: RunStyle;
}

interface ParagraphBlock {
  kind: "paragraph";
  runs: InlineRun[];
  align?: Align;
  quote?: boolean;
  pre?: boolean;
}

interface HeadingBlock {
  kind: "heading";
  level: number;
  runs: InlineRun[];
  align?: Align;
}

interface ListBlock {
  kind: "list";
  ordered: boolean;
  items: Block[][];
}

interface TableBlock {
  kind: "table";
  rows: { cells: InlineRun[][]; header: boolean }[];
}

interface HrBlock {
  kind: "hr";
}

interface PageBreakBlock {
  kind: "pagebreak";
}

type Block = ParagraphBlock | HeadingBlock | ListBlock | TableBlock | HrBlock | PageBreakBlock;

export interface ConvertOptions {
  config: PdfConfig;
  /** Width of the content area in points (used to size separators). */
  contentWidthPt: number;
}

export interface ConvertResult {
  content: any[];
  fontsUsed: Set<string>;
}

/* ------------------------------------------------------------------ */
/* Style parsing helpers                                               */
/* ------------------------------------------------------------------ */

const LEGACY_FONT_SIZES_PT: Record<string, number> = {
  "1": 7.5,
  "2": 10,
  "3": 12,
  "4": 13.5,
  "5": 18,
  "6": 24,
  "7": 36,
};

function parseStyleAttr(el: Element): Record<string, string> {
  const raw = el.getAttribute?.("style") ?? "";
  const out: Record<string, string> = {};
  for (const decl of raw.split(";")) {
    const idx = decl.indexOf(":");
    if (idx === -1) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const value = decl.slice(idx + 1).trim();
    if (prop) out[prop] = value;
  }
  return out;
}

function parseCssColor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(v)) return normalizeHex(v);
  const rgb = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(v);
  if (rgb) {
    const hex = (n: string) => Math.max(0, Math.min(255, parseInt(n, 10))).toString(16).padStart(2, "0");
    return normalizeHex(`#${hex(rgb[1])}${hex(rgb[2])}${hex(rgb[3])}`);
  }
  return undefined;
}

/** Maps a CSS font-family list onto one of the embedded base families. */
function mapCssFamily(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase();
  if (v.includes("mono") || v.includes("courier") || v.includes("consolas")) return "NotoSansMono";
  if (v.includes("serif") && !v.includes("sans")) return "NotoSerif";
  if (v.includes("sans")) return "Roboto";
  return undefined;
}

function parseCssFontSize(value: string | undefined, basePt: number): number | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (LEGACY_FONT_SIZES_PT[v]) return LEGACY_FONT_SIZES_PT[v];
  const m = /^([\d.]+)(px|pt|em|rem|%)?$/.exec(v);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  if (Number.isNaN(n)) return undefined;
  switch (m[2]) {
    case "px":
      return Math.round((n * 0.75) * 10) / 10; // px -> pt
    case "em":
    case "rem":
      return Math.round(n * basePt * 10) / 10;
    case "%":
      return Math.round((n / 100) * basePt * 10) / 10;
    default:
      return n; // already pt
  }
}

function parseAlign(el: Element): Align | undefined {
  const style = parseStyleAttr(el);
  const raw = style["text-align"] ?? el.getAttribute?.("align") ?? "";
  switch (raw.trim().toLowerCase()) {
    case "left":
    case "start":
      return "left";
    case "center":
      return "center";
    case "right":
    case "end":
      return "right";
    case "justify":
    case "justified":
    case "both":
      return "justify";
    default:
      return undefined;
  }
}

function sanitizeHref(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const href = raw.trim();
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) return href;
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Pass 1: DOM -> blocks                                               */
/* ------------------------------------------------------------------ */

const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "TITLE",
  "META",
  "LINK",
  "HEAD",
  "NOSCRIPT",
  "SVG",
  "IMG",
  "PICTURE",
  "VIDEO",
  "AUDIO",
  "IFRAME",
  "CANVAS",
  "OBJECT",
  "EMBED",
  "TEMPLATE",
  "INPUT",
  "BUTTON",
  "SELECT",
  "TEXTAREA",
  "FORM",
]);

const BLOCK_TAGS = new Set([
  "P",
  "DIV",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "UL",
  "OL",
  "LI",
  "BLOCKQUOTE",
  "PRE",
  "HR",
  "TABLE",
  "SECTION",
  "ARTICLE",
  "MAIN",
  "HEADER",
  "FOOTER",
  "FIGURE",
  "FIGCAPTION",
  "ADDRESS",
  "DL",
  "DT",
  "DD",
  "CENTER",
]);

function hasBlockChild(el: Element): boolean {
  for (const child of Array.from(el.children ?? [])) {
    if (BLOCK_TAGS.has(child.tagName.toUpperCase())) return true;
  }
  return false;
}

interface WalkState {
  blocks: Block[];
}

function isPageBreakHr(el: Element): boolean {
  const cls = (el.getAttribute?.("class") ?? "").toLowerCase();
  const data = el.getAttribute?.("data-pagebreak") ?? "";
  return data === "1" || cls.includes("pagebreak") || cls.includes("page-break");
}

function walkContainer(el: Element, state: WalkState): void {
  for (const child of Array.from(el.childNodes ?? [])) {
    walkNode(child, state);
  }
}

function walkNode(node: Node, state: WalkState): void {
  if (node.nodeType === 3) {
    const text = node.nodeValue ?? "";
    if (text.trim()) {
      state.blocks.push({ kind: "paragraph", runs: [{ text, s: {} }] });
    }
    return;
  }
  if (node.nodeType !== 1) return;

  const el = node as Element;
  const tag = el.tagName.toUpperCase();
  if (SKIP_TAGS.has(tag)) return;

  switch (tag) {
    case "H1":
    case "H2":
    case "H3":
    case "H4":
    case "H5":
    case "H6": {
      const runs = collectInline(el.childNodes, {}, false);
      if (runs.length) {
        state.blocks.push({ kind: "heading", level: Number(tag[1]), runs, align: parseAlign(el) });
      }
      return;
    }
    case "P":
    case "DIV":
    case "SECTION":
    case "ARTICLE":
    case "MAIN":
    case "HEADER":
    case "FOOTER":
    case "FIGURE":
    case "FIGCAPTION":
    case "ADDRESS":
    case "CENTER":
    case "DT":
    case "DD": {
      if (hasBlockChild(el)) {
        walkContainer(el, state);
        return;
      }
      const runs = collectInline(el.childNodes, {}, false);
      if (runs.length) {
        state.blocks.push({ kind: "paragraph", runs, align: parseAlign(el) });
      }
      return;
    }
    case "BLOCKQUOTE": {
      if (hasBlockChild(el)) {
        const inner: WalkState = { blocks: [] };
        walkContainer(el, inner);
        for (const b of inner.blocks) {
          if (b.kind === "paragraph") b.quote = true;
          state.blocks.push(b);
        }
      } else {
        const runs = collectInline(el.childNodes, {}, false);
        if (runs.length) state.blocks.push({ kind: "paragraph", runs, quote: true });
      }
      return;
    }
    case "PRE": {
      const runs = collectInline(el.childNodes, {}, true);
      if (runs.length) state.blocks.push({ kind: "paragraph", runs, pre: true });
      return;
    }
    case "UL":
    case "OL": {
      const items: Block[][] = [];
      for (const li of Array.from(el.children ?? [])) {
        if (li.tagName.toUpperCase() !== "LI") continue;
        const itemState: WalkState = { blocks: [] };
        if (hasBlockChild(li)) {
          walkContainer(li, itemState);
        } else {
          const runs = collectInline(li.childNodes, {}, false);
          if (runs.length) itemState.blocks.push({ kind: "paragraph", runs });
        }
        if (itemState.blocks.length) items.push(itemState.blocks);
      }
      if (items.length) state.blocks.push({ kind: "list", ordered: tag === "OL", items });
      return;
    }
    case "TABLE": {
      const rows: TableBlock["rows"] = [];
      for (const tr of Array.from(el.querySelectorAll?.("tr") ?? [])) {
        const cells: InlineRun[][] = [];
        let header = false;
        const parentName =
          tr.parentElement?.tagName.toUpperCase() === "THEAD" ? "THEAD" : undefined;
        if (parentName === "THEAD") header = true;
        for (const cell of Array.from(tr.children ?? [])) {
          const cellTag = cell.tagName.toUpperCase();
          if (cellTag === "TD" || cellTag === "TH") {
            if (cellTag === "TH") header = true;
            const runs = collectInline(cell.childNodes, {}, false);
            cells.push(runs);
          }
        }
        if (cells.length) rows.push({ cells, header });
      }
      if (rows.length) state.blocks.push({ kind: "table", rows });
      return;
    }
    case "HR": {
      if (isPageBreakHr(el)) {
        state.blocks.push({ kind: "pagebreak" });
      } else {
        state.blocks.push({ kind: "hr" });
      }
      return;
    }
    case "BR": {
      return; // stray line breaks at block level are ignored
    }
    default: {
      // Inline elements or unknown containers at block level.
      const runs = collectInline([node], {}, false);
      if (runs.length) state.blocks.push({ kind: "paragraph", runs });
      return;
    }
  }
}

function collectInline(nodes: Node[] | NodeList, style: RunStyle, pre: boolean): InlineRun[] {
  const out: InlineRun[] = [];
  const push = (text: string, s: RunStyle) => {
    if (text) out.push({ text, s });
  };

  for (const node of Array.from(nodes as ArrayLike<Node>)) {
    if (node.nodeType === 3) {
      let text = node.nodeValue ?? "";
      if (!text) continue;
      if (!pre) text = text.replace(/[\t\r\n ]+/g, " ");
      push(text, style);
      continue;
    }
    if (node.nodeType !== 1) continue;

    const el = node as Element;
    const tag = el.tagName.toUpperCase();
    if (SKIP_TAGS.has(tag)) continue;

    switch (tag) {
      case "BR":
        push("\n", style);
        continue;
      case "B":
      case "STRONG":
        collectInline(el.childNodes, { ...style, bold: true }, pre).forEach((r) => out.push(r));
        continue;
      case "I":
      case "EM":
      case "CITE":
      case "VAR":
        collectInline(el.childNodes, { ...style, italics: true }, pre).forEach((r) => out.push(r));
        continue;
      case "U":
      case "INS":
        collectInline(el.childNodes, { ...style, underline: true }, pre).forEach((r) => out.push(r));
        continue;
      case "S":
      case "STRIKE":
      case "DEL":
        collectInline(el.childNodes, { ...style, strike: true }, pre).forEach((r) => out.push(r));
        continue;
      case "CODE":
      case "TT":
      case "KBD":
      case "SAMP":
        collectInline(el.childNodes, { ...style, fontFamily: "NotoSansMono" }, pre).forEach((r) =>
          out.push(r)
        );
        continue;
      case "A": {
        const href = sanitizeHref(el.getAttribute?.("href"));
        const css = parseStyleAttr(el);
        const next: RunStyle = {
          ...style,
          link: href ?? style.link,
          underline: true,
        };
        const color = parseCssColor(css["color"]);
        if (color) next.color = color;
        collectInline(el.childNodes, next, pre).forEach((r) => out.push(r));
        continue;
      }
      case "MARK":
        // Editor find-in-page highlights are transient; render as plain text.
        collectInline(el.childNodes, style, pre).forEach((r) => out.push(r));
        continue;
      case "SUB":
      case "SUP":
      case "SMALL":
      case "BIG":
      case "ABBR":
      case "TIME":
      case "SPAN":
      case "FONT":
      default: {
        const css = parseStyleAttr(el);
        const next: RunStyle = { ...style };
        const color = parseCssColor(css["color"]);
        if (color) next.color = color;
        const bg = parseCssColor(css["background-color"] ?? css["background"]);
        if (bg) next.background = bg;
        const weight = css["font-weight"]?.trim().toLowerCase();
        if (weight && (weight === "bold" || weight === "bolder" || /^[6-9]00$/.test(weight))) {
          next.bold = true;
        }
        const fontStyle = css["font-style"]?.trim().toLowerCase();
        if (fontStyle === "italic" || fontStyle === "oblique") next.italics = true;
        const decoration = css["text-decoration"]?.trim().toLowerCase() ?? "";
        const decorationLine = css["text-decoration-line"]?.trim().toLowerCase() ?? "";
        const dec = `${decoration} ${decorationLine}`;
        if (dec.includes("underline")) next.underline = true;
        if (dec.includes("line-through")) next.strike = true;
        const family = mapCssFamily(css["font-family"] ?? el.getAttribute?.("face"));
        if (family) next.fontFamily = family;
        if (tag === "FONT") {
          const sizeAttr = el.getAttribute?.("size");
          if (sizeAttr && LEGACY_FONT_SIZES_PT[sizeAttr]) {
            next.fontSize = LEGACY_FONT_SIZES_PT[sizeAttr];
          }
        }
        const size = parseCssFontSize(css["font-size"], 11);
        if (size) next.fontSize = size;
        collectInline(el.childNodes, next, pre).forEach((r) => out.push(r));
        continue;
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Pass 2: blocks -> pdfmake content                                   */
/* ------------------------------------------------------------------ */

const HEADING_SCALE: Record<number, number> = { 1: 1.8, 2: 1.45, 3: 1.25, 4: 1.12, 5: 1, 6: 1 };
const HEADING_SPACE: Record<number, [number, number]> = {
  1: [16, 7],
  2: [14, 6],
  3: [12, 5],
  4: [10, 4],
  5: [10, 4],
  6: [10, 4],
};

/** Words longer than this are allowed to break mid-word (URLs, hashes...). */
const BREAK_ALL_THRESHOLD = 32;

interface TextObjSignature {
  font: string;
  bold?: boolean;
  italics?: boolean;
  decoration?: string;
  color?: string;
  background?: string;
  fontSize?: number;
  link?: string;
  breakAll: boolean;
}

function styleOf(run: InlineRun, baseFont: string, config: PdfConfig): TextObjSignature {
  const s = run.s;
  return {
    font: s.fontFamily ?? baseFont,
    bold: s.bold || undefined,
    italics: s.italics || undefined,
    decoration: s.underline && s.strike ? "lineThrough" : s.underline ? "underline" : s.strike ? "lineThrough" : undefined,
    color: s.color,
    background: s.background,
    fontSize: s.fontSize,
    link: s.link,
    breakAll: false,
  };
}

function signatureEqual(a: TextObjSignature, b: TextObjSignature): boolean {
  return (
    a.font === b.font &&
    a.bold === b.bold &&
    a.italics === b.italics &&
    a.decoration === b.decoration &&
    a.color === b.color &&
    a.background === b.background &&
    a.fontSize === b.fontSize &&
    a.link === b.link &&
    a.breakAll === b.breakAll
  );
}

function toTextObj(sig: TextObjSignature, text: string): any {
  const obj: any = { text };
  if (sig.font) obj.font = sig.font;
  if (sig.bold) obj.bold = true;
  if (sig.italics) obj.italics = true;
  if (sig.decoration) obj.decoration = sig.decoration;
  if (sig.color) obj.color = sig.color;
  if (sig.background) obj.background = sig.background;
  if (sig.fontSize) obj.fontSize = sig.fontSize;
  if (sig.link) obj.link = sig.link;
  if (sig.breakAll) obj.wordBreak = "break-all";
  return obj;
}

/** Splits a run into script segments and overlong words that may break anywhere. */
function runToTextObjects(run: InlineRun, baseFont: string, config: PdfConfig, fontsUsed: Set<string>): any[] {
  const text = stripInvisible(run.text);
  if (!text) return [];
  const baseSig = styleOf(run, baseFont, config);
  const objects: any[] = [];

  for (const seg of segmentByScript(text)) {
    const font = seg.script ? SCRIPT_FONT[seg.script] : baseSig.font;
    fontsUsed.add(font);
    const sig: TextObjSignature = { ...baseSig, font };

    // Split into "safe" words and overlong tokens (URLs etc.).
    const parts = seg.text.split(/(\s+)/);
    let buffer = "";
    let bufferSig: TextObjSignature | null = null;

    const flush = () => {
      if (buffer && bufferSig) {
        objects.push(toTextObj(bufferSig, buffer));
      }
      buffer = "";
      bufferSig = null;
    };

    for (const part of parts) {
      if (!part) continue;
      const overlong = part.trim().length > BREAK_ALL_THRESHOLD;
      const partSig: TextObjSignature = overlong ? { ...sig, breakAll: true } : sig;
      if (bufferSig && signatureEqual(bufferSig, partSig)) {
        buffer += part;
      } else {
        flush();
        buffer = part;
        bufferSig = partSig;
      }
    }
    flush();
  }

  // Merge adjacent objects with identical signatures.
  const merged: any[] = [];
  for (const obj of objects) {
    const prev = merged[merged.length - 1];
    if (prev) {
      const prevSig: TextObjSignature = {
        font: prev.font,
        bold: prev.bold,
        italics: prev.italics,
        decoration: prev.decoration,
        color: prev.color,
        background: prev.background,
        fontSize: prev.fontSize,
        link: prev.link,
        breakAll: !!prev.wordBreak,
      };
      const curSig: TextObjSignature = {
        font: obj.font,
        bold: obj.bold,
        italics: obj.italics,
        decoration: obj.decoration,
        color: obj.color,
        background: obj.background,
        fontSize: obj.fontSize,
        link: obj.link,
        breakAll: !!obj.wordBreak,
      };
      if (signatureEqual(prevSig, curSig)) {
        prev.text += obj.text;
        continue;
      }
    }
    merged.push(obj);
  }
  return merged;
}

function trimRuns(runs: InlineRun[]): InlineRun[] {
  const out = runs.map((r) => ({ ...r }));
  for (let i = 0; i < out.length; i++) {
    if (i === 0) out[i].text = out[i].text.replace(/^[ \t\n]+/, "");
    if (i === out.length - 1) out[i].text = out[i].text.replace(/[ \t\n]+$/, "");
  }
  return out.filter((r) => r.text.length > 0);
}

function indentPrefix(fontSize: number): string {
  const count = Math.max(2, Math.min(24, Math.round(30 / (0.26 * Math.max(6, fontSize)))));
  return "\u00A0".repeat(count);
}

interface BuildCtx {
  config: PdfConfig;
  baseFont: string;
  fontsUsed: Set<string>;
  contentWidthPt: number;
}

function paragraphContent(
  runs: InlineRun[],
  ctx: BuildCtx,
  opts: { align?: Align; quote?: boolean; pre?: boolean; indent?: boolean; margin?: number[] } = {}
): any {
  const { config } = ctx;
  const trimmed = trimRuns(runs);
  const spacing = config.typography.paragraphSpacing;

  if (opts.indent && trimmed.length) {
    const first = trimmed[0];
    trimmed[0] = { text: indentPrefix(first.s.fontSize ?? config.typography.fontSize) + first.text, s: first.s };
  }

  const textObjects: any[] = [];
  for (const run of trimmed) {
    textObjects.push(...runToTextObjects(run, ctx.baseFont, config, ctx.fontsUsed));
  }
  if (!textObjects.length) return null;

  const para: any = {
    text: textObjects.length === 1 && isPlainRun(textObjects[0]) ? textObjects[0].text : textObjects,
  };
  if (opts.align) para.alignment = opts.align;
  if (opts.quote) {
    para.color = "#4b5563";
    para.margin = [20, 0, 8, spacing];
  } else if (opts.pre) {
    para.font = "NotoSansMono";
    ctx.fontsUsed.add("NotoSansMono");
    para.fontSize = Math.round(config.typography.fontSize * 0.92 * 10) / 10;
    para.margin = [0, 0, 0, spacing];
  } else {
    para.margin = opts.margin ?? [0, 0, 0, spacing];
  }
  return para;
}

function isPlainRun(obj: any): boolean {
  return (
    obj &&
    typeof obj.text === "string" &&
    !obj.bold &&
    !obj.italics &&
    !obj.decoration &&
    !obj.color &&
    !obj.background &&
    !obj.fontSize &&
    !obj.link &&
    !obj.wordBreak &&
    (!obj.font || obj.font === "Roboto")
  );
}

function listContent(block: ListBlock, ctx: BuildCtx, depth: number): any | null {
  const items: any[] = [];
  for (const itemBlocks of block.items) {
    const itemObjects: any[] = [];
    for (const b of itemBlocks) {
      const obj = blockToContent(b, ctx, depth + 1);
      if (obj) itemObjects.push(obj);
    }
    if (!itemObjects.length) continue;
    if (itemObjects.length === 1) {
      // Remove inter-item paragraph spacing.
      const single = itemObjects[0];
      if (single?.margin) single.margin = [0, 0, 0, 2];
      items.push(single);
    } else {
      for (const o of itemObjects) {
        if (o?.margin) o.margin = [0, 0, 0, 2];
      }
      items.push({ stack: itemObjects });
    }
  }
  if (!items.length) return null;
  const spacing = ctx.config.typography.paragraphSpacing;
  const list: any = block.ordered ? { ol: items } : { ul: items };
  list.margin = [0, 0, 0, spacing];
  if (depth > 0) list.margin = [14, 0, 0, 2];
  return list;
}

function tableContent(block: TableBlock, ctx: BuildCtx): any | null {
  const body: any[][] = [];
  let colCount = 0;
  for (const row of block.rows) {
    colCount = Math.max(colCount, row.cells.length);
  }
  if (!colCount) return null;
  for (const row of block.rows) {
    const cells: any[] = [];
    for (let i = 0; i < colCount; i++) {
      const cellRuns = row.cells[i] ?? [];
      const trimmed = trimRuns(cellRuns);
      const textObjects: any[] = [];
      for (const run of trimmed) {
        const objs = runToTextObjects(run, ctx.baseFont, ctx.config, ctx.fontsUsed);
        for (const o of objs) if (row.header) o.bold = true;
        textObjects.push(...objs);
      }
      const cellText = textObjects.length
        ? textObjects.length === 1 && isPlainRun(textObjects[0]) && !row.header
          ? textObjects[0].text
          : textObjects
        : "";
      cells.push(cellText === "" ? "" : cellText);
    }
    body.push(cells);
  }
  return {
    table: {
      body,
      widths: Array.from({ length: colCount }, () => "*") as any,
      dontBreakRows: true,
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#d1d5db",
      vLineColor: () => "#d1d5db",
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
    margin: [0, 0, 0, ctx.config.typography.paragraphSpacing],
  };
}

function hrContent(ctx: BuildCtx): any {
  return {
    canvas: [
      {
        type: "line",
        x1: 0,
        y1: 0,
        x2: ctx.contentWidthPt,
        y2: 0,
        lineWidth: 0.75,
        lineColor: "#9ca3af",
      },
    ],
    margin: [0, 3, 0, ctx.config.typography.paragraphSpacing],
  };
}

function blockToContent(block: Block, ctx: BuildCtx, depth = 0): any | null {
  const { config } = ctx;
  switch (block.kind) {
    case "paragraph":
      return paragraphContent(block.runs, ctx, {
        align: block.align,
        quote: block.quote,
        pre: block.pre,
        indent:
          config.typography.firstLineIndent &&
          !block.quote &&
          !block.pre &&
          (!block.align || block.align === "left" || block.align === "justify"),
      });
    case "heading": {
      const scale = HEADING_SCALE[block.level] ?? 1;
      const [top, bottom] = HEADING_SPACE[block.level] ?? [10, 4];
      const trimmed = trimRuns(block.runs);
      const textObjects: any[] = [];
      for (const run of trimmed) {
        for (const obj of runToTextObjects(run, ctx.baseFont, config, ctx.fontsUsed)) {
          obj.fontSize = Math.round(config.typography.fontSize * scale * 10) / 10;
          obj.bold = true;
          textObjects.push(obj);
        }
      }
      if (!textObjects.length) return null;
      const heading: any = {
        text: textObjects,
        alignment: block.align,
        margin: [0, depth === 0 ? top : top / 2, 0, bottom],
      };
      // H1–H3 headings feed the table of contents when the feature is on;
      // pdfmake collects the entries and resolves their page numbers itself.
      if (config.tableOfContents.enabled && block.level <= 3) {
        heading.tocItem = true;
      }
      return heading;
    }
    case "list":
      return listContent(block, ctx, depth);
    case "table":
      return tableContent(block, ctx);
    case "hr":
      return hrContent(ctx);
    case "pagebreak":
      return null; // handled by the caller
  }
}

function blockTextLength(block: Block): number {
  let len = 0;
  const count = (runs: InlineRun[]) => {
    for (const r of runs) len += r.text.length;
  };
  if (block.kind === "paragraph" || block.kind === "heading") count(block.runs);
  if (block.kind === "list") {
    for (const item of block.items) for (const b of item) len += blockTextLength(b);
  }
  if (block.kind === "table") {
    for (const row of block.rows) for (const cell of row.cells) count(cell);
  }
  return len;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export function parseHtmlBlocks(html: string): Block[] {
  const Ctor = (globalThis as any).DOMParser;
  if (typeof Ctor !== "function") {
    throw new Error("DOMParser is not available in this environment");
  }
  const doc = new Ctor().parseFromString(html, "text/html");
  const state: WalkState = { blocks: [] };
  walkContainer(doc.body, state);
  return state.blocks;
}

export function htmlToPdfContent(html: string, options: ConvertOptions): ConvertResult {
  const { config } = options;
  const baseFont = config.typography.fontFamily;
  const ctx: BuildCtx = {
    config,
    baseFont,
    fontsUsed: new Set<string>([baseFont]),
    contentWidthPt: options.contentWidthPt,
  };

  const blocks = parseHtmlBlocks(html);
  const content: any[] = [];

  let pendingPageBreak = false;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    if (block.kind === "pagebreak") {
      pendingPageBreak = true;
      continue;
    }

    if (block.kind === "paragraph" && !trimRuns(block.runs).length && !pendingPageBreak) {
      // Empty paragraph -> visual blank line.
      content.push({ text: "", margin: [0, 0, 0, config.typography.paragraphSpacing] });
      continue;
    }

    // Keep short headings together with the paragraph that follows them.
    const next = blocks[i + 1];
    const keepWithNext =
      config.keepHeadingsWithContent &&
      block.kind === "heading" &&
      next &&
      (next.kind === "paragraph" || next.kind === "list") &&
      blockTextLength(next) < 700;

    let produced: any | null = null;
    if (keepWithNext && next) {
      const headingObj = blockToContent(block, ctx);
      const nextObj = blockToContent(next, ctx);
      if (headingObj && nextObj) {
        produced = { stack: [headingObj, nextObj], unbreakable: true };
        i++; // consume the paired block
      } else {
        produced = headingObj;
      }
    } else {
      produced = blockToContent(block, ctx);
    }

    if (!produced) continue;
    if (pendingPageBreak) {
      produced.pageBreak = "before";
      pendingPageBreak = false;
    }
    content.push(produced);
  }

  if (!content.length) {
    content.push({ text: "", margin: [0, 0, 0, 0] });
  }

  return { content, fontsUsed: ctx.fontsUsed };
}
