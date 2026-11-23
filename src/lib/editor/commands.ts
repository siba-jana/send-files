/**
 * Rich text editing commands. document.execCommand is deprecated but remains
 * the only cross-browser API for user-selection-aware formatting in a
 * contentEditable surface; it keeps native undo/redo working for every
 * toolbar action.
 */

export type BlockTag = "P" | "H1" | "H2" | "H3";

/** Maps a font size in points onto the legacy execCommand size scale. */
const FONT_SIZE_HACK = "7";

function exec(command: string, value?: string): boolean {
  try {
    document.execCommand("styleWithCSS", false, "true");
    return document.execCommand(command, false, value);
  } catch {
    return false;
  }
}

export function queryState(command: string): boolean {
  try {
    return document.queryCommandState(command);
  } catch {
    return false;
  }
}

export function queryValue(command: string): string {
  try {
    return document.queryCommandValue(command) ?? "";
  } catch {
    return "";
  }
}

export function undo(): void {
  exec("undo");
}

export function redo(): void {
  exec("redo");
}

export function setBold(on: boolean): void {
  if (on !== queryState("bold")) exec("bold");
}

export function setItalic(on: boolean): void {
  if (on !== queryState("italic")) exec("italic");
}

export function setUnderline(on: boolean): void {
  if (on !== queryState("underline")) exec("underline");
}

export function setStrike(on: boolean): void {
  if (on !== queryState("strikeThrough")) exec("strikeThrough");
}

export function setBlock(tag: BlockTag): void {
  exec("formatBlock", `<${tag}>`);
}

export function currentBlock(): BlockTag {
  const value = queryValue("formatBlock").toUpperCase();
  if (value === "H1" || value === "H2" || value === "H3") return value;
  return "P";
}

export type EditorFamily = "sans-serif" | "serif" | "monospace";

export function setFontFamily(family: EditorFamily): void {
  exec("fontName", family);
}

/** Current inline font family mapped to one of the three editor families. */
export function currentFontFamily(): EditorFamily {
  const value = queryValue("fontName").toLowerCase();
  if (value.includes("mono") || value.includes("courier")) return "monospace";
  if (value.includes("serif") && !value.includes("sans")) return "serif";
  return "sans-serif";
}

/**
 * Applies a font size in points. Chrome implements execCommand('fontSize')
 * with the legacy 1-7 scale even under styleWithCSS, so the temporary
 * font[size] elements are rewritten into styled spans afterwards.
 */
export function setFontSize(root: HTMLElement, pt: number): void {
  exec("fontSize", FONT_SIZE_HACK);
  // Rewrite <font size="7"> elements.
  const fonts = Array.from(root.querySelectorAll(`font[size="${FONT_SIZE_HACK}"]`));
  for (const font of fonts) {
    const span = document.createElement("span");
    span.style.fontSize = `${pt}pt`;
    while (font.firstChild) span.appendChild(font.firstChild);
    font.parentNode?.replaceChild(span, font);
  }
  // Some browsers emit styled spans with keyword sizes instead.
  const keyword = "xxx-large";
  const spans = Array.from(root.querySelectorAll<HTMLSpanElement>("span[style]"));
  for (const span of spans) {
    if (span.style.fontSize === keyword) {
      span.style.fontSize = `${pt}pt`;
    }
  }
}

export function currentFontSizePt(root: HTMLElement, fallback: number): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return fallback;
  let node: Node | null = sel.getRangeAt(0).startContainer;
  if (node.nodeType === 3) node = node.parentNode;
  let el = node as HTMLElement | null;
  while (el && el !== root) {
    if (el.nodeType === 1) {
      const style = window.getComputedStyle(el);
      const size = parseFloat(style.fontSize);
      if (!Number.isNaN(size)) return Math.round(size * 0.75); // px -> pt
    }
    el = el.parentElement;
  }
  return fallback;
}

export function setTextColor(color: string): void {
  exec("foreColor", color);
}

export function setHighlight(color: string): void {
  // hiliteColor is not supported everywhere; backColor is the fallback.
  if (!exec("hiliteColor", color)) {
    exec("backColor", color);
  }
}

export function setTextAlign(alignment: "left" | "center" | "right" | "justify"): void {
  switch (alignment) {
    case "center":
      exec("justifyCenter");
      break;
    case "right":
      exec("justifyRight");
      break;
    case "justify":
      exec("justifyFull");
      break;
    default:
      exec("justifyLeft");
      break;
  }
}

export function toggleUnorderedList(): void {
  exec("insertUnorderedList");
}

export function toggleOrderedList(): void {
  exec("insertOrderedList");
}

export function insertHorizontalRule(): void {
  exec("insertHorizontalRule");
}

/** Inserts a manual page break marker (rendered as a dashed labelled rule). */
export function insertPageBreak(): void {
  const html = '<hr data-pagebreak="1" class="t2p-pagebreak">';
  exec("insertHTML", html);
}

/**
 * Inserts a table with a header row (th) plus (rows-1) body rows and cols
 * columns, followed by an empty paragraph so the caret can escape the table.
 * Uses execCommand('insertHTML') so the insert is on the native undo stack.
 * Rows are clamped to 1-10 and columns to 1-8; empty cells get borders and
 * padding from the editor stylesheet so they are visible and clickable.
 */
export function insertTable(rows: number, cols: number): void {
  const safeRows = Math.min(10, Math.max(1, Math.round(rows)));
  const safeCols = Math.min(8, Math.max(1, Math.round(cols)));
  const headerCells = Array.from({ length: safeCols }, (_, i) => `<th>Column ${i + 1}</th>`).join("");
  const bodyRows = Math.max(0, safeRows - 1);
  const body = Array.from({ length: bodyRows }, () => `<tr>${"<td></td>".repeat(safeCols)}</tr>`).join("");
  const html = `<table><thead><tr>${headerCells}</tr></thead><tbody>${body}</tbody></table><p><br></p>`;
  exec("insertHTML", html);
}

export function removeFormat(): void {
  exec("removeFormat");
  exec("unlink");
  exec("formatBlock", "<p>");
}

export function createLink(url: string, selectionText: string): void {
  const trimmed = url.trim();
  if (!trimmed) return;
  const href = /^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (selectionText) {
    exec("createLink", href);
  } else {
    exec("insertHTML", `<a href="${href}">${href.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")}</a>`);
  }
}

export function unlink(): void {
  exec("unlink");
}

export function insertHtml(html: string): void {
  exec("insertHTML", html);
}

export function insertPlainText(text: string): void {
  exec("insertText", text);
}

/* ------------------------------------------------------------------ */
/* Markdown-style auto formatting                                       */
/* ------------------------------------------------------------------ */

export type MarkdownMatch =
  | { kind: "heading"; level: 1 | 2 | 3 }
  | { kind: "bullet" }
  | { kind: "ordered" }
  | { kind: "quote" }
  | { kind: "rule" };

/** Block contexts where markdown shortcuts must never re-trigger. */
const MARKDOWN_EXCLUDED_TAGS = new Set([
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
  "TABLE",
  "THEAD",
  "TBODY",
  "TFOOT",
  "TR",
  "TD",
  "TH",
]);

/**
 * Maps an exact marker string to its block transform. Longer markers are
 * matched first: "---" wins over "-" and "###" over "##" over "#".
 */
function matchMarkdownMarker(text: string): MarkdownMatch | null {
  if (text === "---") return { kind: "rule" };
  if (text === "###") return { kind: "heading", level: 3 };
  if (text === "##") return { kind: "heading", level: 2 };
  if (text === "#") return { kind: "heading", level: 1 };
  if (text === "-" || text === "*") return { kind: "bullet" };
  if (text === "1.") return { kind: "ordered" };
  if (text === ">") return { kind: "quote" };
  return null;
}

/**
 * Handles a Space keypress for markdown-style auto formatting. Returns true
 * (and applies the block transform, undoable via execCommand) when the caret
 * sits at the end of a plain paragraph whose entire text is exactly a marker:
 * "#"|"##"|"###" -> H1/H2/H3, "-"|"*" -> bullet list, "1." -> ordered list,
 * ">" -> blockquote, "---" -> horizontal rule. Returns false otherwise.
 */
export function handleMarkdownSpace(root: HTMLElement | null): boolean {
  if (!root) return false;

  /**
   * Resolves the current collapsed caret and its nearest P/DIV block
   * ancestor. Returns null when there is no usable selection, when the caret
   * is outside the editor, when an excluded context (heading/list/quote/
   * table) wraps the caret, or when the caret sits in root-level inline
   * content with no block wrapper at all (block: null).
   */
  const resolve = (): { caret: Range; block: HTMLElement | null } | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount !== 1 || !sel.isCollapsed) return null;
    const caret = sel.getRangeAt(0);
    if (!root.contains(caret.startContainer)) return null;
    let block: HTMLElement | null = null;
    let node: Node | null = caret.startContainer;
    while (node && node !== root) {
      if (node.nodeType === 1) {
        const el = node as HTMLElement;
        if (MARKDOWN_EXCLUDED_TAGS.has(el.tagName)) return null;
        if (!block && (el.tagName === "P" || el.tagName === "DIV")) block = el;
      }
      node = node.parentNode;
    }
    return { caret, block };
  };

  let resolved = resolve();
  if (!resolved) return false;

  // Chrome keeps the first characters typed into an empty editor directly
  // under the root with no paragraph wrapper. Wrap the current line in a
  // paragraph (undoable) and re-resolve so the marker check can run.
  if (!resolved.block) {
    if (!exec("formatBlock", "<p>")) return false;
    resolved = resolve();
    if (!resolved || !resolved.block) return false;
  }

  const { caret, block } = resolved;

  // The block must contain exactly the marker text, with the caret at its
  // end (the pre-caret text equals the whole block text).
  const marker = block.textContent ?? "";
  const match = matchMarkdownMarker(marker);
  if (!match) return false;
  const preCaret = document.createRange();
  preCaret.selectNodeContents(block);
  preCaret.setEnd(caret.startContainer, caret.startOffset);
  if (preCaret.toString() !== marker) return false;

  // Remove the marker text in one undoable transaction: select from the
  // block start to the caret, then delete.
  const sel = window.getSelection();
  if (!sel) return false;
  const deletion = document.createRange();
  deletion.setStart(block, 0);
  deletion.setEnd(caret.startContainer, caret.startOffset);
  sel.removeAllRanges();
  sel.addRange(deletion);
  if (!exec("delete")) {
    // Could not delete; restore the caret and let the space through as-is.
    sel.removeAllRanges();
    sel.addRange(caret);
    return false;
  }

  // Apply the block transform the marker stands for (all through exec(),
  // so native input events fire and the editor's onInput sync runs).
  switch (match.kind) {
    case "heading":
      exec("formatBlock", `<h${match.level}>`);
      break;
    case "quote":
      exec("formatBlock", "<blockquote>");
      break;
    case "bullet":
      exec("insertUnorderedList");
      break;
    case "ordered":
      exec("insertOrderedList");
      break;
    case "rule":
      exec("insertHorizontalRule");
      break;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Case transformation (single undoable execCommand transaction)        */
/* ------------------------------------------------------------------ */

export type CaseMode = "upper" | "lower" | "title" | "sentence";

/** Matches a word for Title Case: a letter followed by letters/apostrophes. */
const TITLE_WORD = /\p{L}[\p{L}'’]*/gu;
/** Single letter test (sentence-case state machine). */
const IS_LETTER = /\p{L}/u;
/** Whitespace test (sentence-case state machine). */
const IS_WHITESPACE = /\s/u;
/** Sentence terminators that trigger capitalisation of the next sentence. */
const IS_SENTENCE_TERMINATOR = /[.!?…]/u;

/** Capitalises the first letter of every word, leaving the rest untouched. */
function transformTitleCase(text: string): string {
  return text.replace(TITLE_WORD, (word) => {
    const lead = String.fromCodePoint(word.codePointAt(0) ?? 0);
    return lead.toUpperCase() + word.slice(lead.length);
  });
}

/**
 * Builds the per-portion string transform for a case mode. Sentence case is
 * stateful: the "capitalize next letter" flag carries across text-node
 * portions so sentences spanning inline formatting boundaries still work.
 */
function createCaseTransformer(mode: CaseMode): (portion: string) => string {
  switch (mode) {
    case "upper":
      return (text) => text.toUpperCase();
    case "lower":
      return (text) => text.toLowerCase();
    case "title":
      return transformTitleCase;
    case "sentence": {
      let capitalizeNext = true; // start of the transformed text
      let afterTerminator = false;
      return (text) => {
        let out = "";
        for (const ch of text.toLowerCase()) {
          if (IS_SENTENCE_TERMINATOR.test(ch)) {
            out += ch;
            afterTerminator = true;
          } else if (IS_WHITESPACE.test(ch)) {
            out += ch;
            if (afterTerminator) capitalizeNext = true;
            afterTerminator = false;
          } else {
            if (capitalizeNext && IS_LETTER.test(ch)) {
              out += ch.toUpperCase();
              capitalizeNext = false;
            } else {
              out += ch;
            }
            afterTerminator = false;
          }
        }
        return out;
      };
    }
  }
}

/**
 * Rewrites every text node of a detached DOM fragment in document order.
 * Sentence-case state carries across text-node boundaries exactly like the
 * previous in-place implementation, so sentences spanning inline elements
 * still capitalise correctly.
 */
function transformFragmentText(frag: DocumentFragment, mode: CaseMode): void {
  const transform = createCaseTransformer(mode);
  const walker = document.createTreeWalker(frag, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const value = node.nodeValue ?? "";
    const transformed = transform(value);
    if (transformed !== value) {
      node.nodeValue = transformed;
    }
    node = walker.nextNode();
  }
}

/**
 * Serialises a range's contents with their case transformed. cloneContents()
 * preserves inline styles, links and hr attributes, so the HTML needs no
 * post-processing.
 */
function transformedRangeHtml(range: Range, mode: CaseMode): string {
  const frag = range.cloneContents();
  transformFragmentText(frag, mode);
  const wrap = document.createElement("div");
  wrap.appendChild(frag);
  return wrap.innerHTML;
}

/**
 * Transforms the case of the current selection's text (preserving inline
 * formatting), or of the whole editor when the selection is collapsed /
 * empty. The re-cased HTML is re-inserted through a single
 * execCommand('insertHTML') call, so the change IS undoable (Ctrl+Z
 * restores the previous casing) and fires the native input events that
 * keep the editor's content sync running.
 */
export function transformCase(root: HTMLElement | null, mode: CaseMode): void {
  if (!root) return;

  // Only honour a non-collapsed selection that lives inside the editor.
  const selection = window.getSelection();
  let range: Range | null = null;
  if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
    const candidate = selection.getRangeAt(0);
    if (root.contains(candidate.commonAncestorContainer)) range = candidate;
  }

  if (range) {
    // Replace the selection with identically formatted but re-cased HTML
    // in one undoable transaction.
    exec("insertHTML", transformedRangeHtml(range, mode));
    return;
  }

  // Whole-document path. Nothing to do for an empty editor; a lone <hr>
  // still counts as content.
  if (!(root.textContent ?? "").trim() && !root.querySelector("hr")) return;

  const all = document.createRange();
  all.selectNodeContents(root);
  if (selection) {
    selection.removeAllRanges();
    selection.addRange(all);
  }
  exec("insertHTML", transformedRangeHtml(all, mode));
}
