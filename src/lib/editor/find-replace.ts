/**
 * Find & replace engine for the editor.
 *
 * Rich mode works directly on the contentEditable DOM: text nodes are
 * indexed into one virtual string, matches are highlighted with <mark>
 * elements and replacements preserve the surrounding formatting.
 */

export interface FindOptions {
  caseSensitive: boolean;
}

interface TextNodePart {
  node: Text;
  start: number; // offset of this node inside the virtual string
  end: number;
}

export interface FindState {
  matches: Array<{ start: number; end: number }>;
  text: string;
  parts: TextNodePart[];
}

/** Builds the virtual text + node index of a contentEditable root. */
function indexNodes(root: HTMLElement): { text: string; parts: TextNodePart[] } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = (node as Text).parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (tag === "SCRIPT" || tag === "STYLE") return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const parts: TextNodePart[] = [];
  let text = "";
  let current = walker.nextNode() as Text | null;
  while (current) {
    const value = current.nodeValue ?? "";
    if (value.length) {
      parts.push({ node: current, start: text.length, end: text.length + value.length });
      text += value;
    }
    current = walker.nextNode() as Text | null;
  }
  return { text, parts };
}

function findAll(haystack: string, needle: string, caseSensitive: boolean): Array<{ start: number; end: number }> {
  if (!needle) return [];
  const results: Array<{ start: number; end: number }> = [];
  const hay = caseSensitive ? haystack : haystack.toLowerCase();
  const nd = caseSensitive ? needle : needle.toLowerCase();
  let index = hay.indexOf(nd);
  while (index !== -1) {
    results.push({ start: index, end: index + needle.length });
    index = hay.indexOf(nd, index + Math.max(1, needle.length));
  }
  return results;
}

/** Removes existing find highlights from the editor. */
function clearHighlights(root: HTMLElement): void {
  for (const mark of Array.from(root.querySelectorAll("mark[data-t2p-find]"))) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  }
  root.normalize();
}

export interface RichFindResult {
  count: number;
  /** The DOM changed (highlights added) and needs to be synced to the store. */
  domChanged: boolean;
}

/**
 * Finds all occurrences, highlighting them in the editor.
 * Returns match count; call scrollMatch to focus a specific match.
 */
export function richFind(root: HTMLElement, query: string, options: FindOptions): RichFindResult {
  clearHighlights(root);
  if (!query) return { count: 0, domChanged: false };

  const { text, parts } = indexNodes(root);
  const matches = findAll(text, query, options.caseSensitive);
  if (!matches.length) return { count: 0, domChanged: true };

  const locate = (offset: number): { part: TextNodePart; inner: number } | null => {
    for (const part of parts) {
      if (offset >= part.start && offset <= part.end) {
        return { part, inner: offset - part.start };
      }
    }
    return null;
  };

  // Highlight from last to first so earlier offsets stay valid.
  for (let i = matches.length - 1; i >= 0; i--) {
    const { start, end } = matches[i];
    const from = locate(start);
    const to = locate(end);
    if (!from || !to) continue;
    try {
      const range = document.createRange();
      range.setStart(from.part.node, from.inner);
      range.setEnd(to.part.node, to.inner - to.part.start);
      const mark = document.createElement("mark");
      mark.setAttribute("data-t2p-find", i.toString());
      mark.className = "t2p-find-hit";
      range.surroundContents(mark);
    } catch {
      // Cross-element matches that cannot be wrapped are skipped gracefully.
    }
  }
  return { count: matches.length, domChanged: true };
}

/** Scrolls to and emphasises the match with the given index (0-based). */
export function focusMatch(root: HTMLElement, index: number): void {
  const marks = Array.from(root.querySelectorAll<HTMLElement>("mark[data-t2p-find]"));
  const target = marks.find((m) => m.getAttribute("data-t2p-find") === String(index));
  if (!target) return;
  for (const m of marks) m.classList.remove("t2p-find-current");
  target.classList.add("t2p-find-current");
  target.scrollIntoView({ block: "center", behavior: "smooth" });
}

/** Replaces the currently focused match. Returns true when a replacement happened. */
export function richReplaceCurrent(root: HTMLElement, query: string, replacement: string, options: FindOptions): boolean {
  const mark = root.querySelector<HTMLElement>("mark.t2p-find-current") ?? root.querySelector<HTMLElement>("mark[data-t2p-find]");
  if (mark) {
    const textNode = document.createTextNode(replacement);
    mark.parentNode?.replaceChild(textNode, mark);
    root.normalize();
    return true;
  }
  // No highlight (match spans elements) -> replace the first plain occurrence.
  const { text } = indexNodes(root);
  const matches = findAll(text, query, options.caseSensitive);
  if (!matches.length) return false;
  const first = matches[0];
  const part = indexNodes(root).parts.find((p) => first.start >= p.start && first.start <= p.end);
  if (!part) return false;
  const inner = first.start - part.start;
  part.node.deleteData(inner, query.length);
  part.node.insertData(inner, replacement);
  return true;
}

/** Replaces every occurrence, preserving formatting outside the matches. */
export function richReplaceAll(root: HTMLElement, query: string, replacement: string, options: FindOptions): number {
  if (!query) return 0;
  let replaced = 0;
  // Iterate last-to-first on the virtual string, re-indexing after each
  // replacement (node splits change the index).
  let guard = 0;
  while (guard++ < 10000) {
    clearHighlights(root);
    const { text, parts } = indexNodes(root);
    const matches = findAll(text, query, options.caseSensitive);
    if (!matches.length) break;
    const last = matches[matches.length - 1];
    const startPart = parts.find((p) => last.start >= p.start && last.start <= p.end);
    const endPart = parts.find((p) => last.end >= p.start && last.end <= p.end);
    if (!startPart || !endPart) break;

    try {
      if (startPart.node === endPart.node) {
        const inner = last.start - startPart.start;
        startPart.node.deleteData(inner, query.length);
        startPart.node.insertData(inner, replacement);
      } else {
        // Multi-node match: delete the range and insert the replacement.
        const range = document.createRange();
        range.setStart(startPart.node, last.start - startPart.start);
        range.setEnd(endPart.node, last.end - endPart.start);
        range.deleteContents();
        range.insertNode(document.createTextNode(replacement));
        root.normalize();
      }
      replaced++;
    } catch {
      break;
    }
  }
  return replaced;
}

/** Removes any leftover highlight marks (call when closing the find dialog). */
export function richCleanup(root: HTMLElement): void {
  clearHighlights(root);
}

/* ------------------------------------------------------------------ */
/* Plain-text mode                                                     */
/* ------------------------------------------------------------------ */

export function plainFind(text: string, query: string, options: FindOptions): Array<{ start: number; end: number }> {
  return findAll(text, query, options.caseSensitive);
}

export function plainReplaceAll(text: string, query: string, replacement: string, options: FindOptions): { text: string; count: number } {
  if (!query) return { text, count: 0 };
  const matches = findAll(text, query, options.caseSensitive);
  if (!matches.length) return { text, count: 0 };
  const hay = options.caseSensitive ? text : text.toLowerCase();
  const nd = options.caseSensitive ? query : query.toLowerCase();
  let out = "";
  let cursor = 0;
  let index = hay.indexOf(nd);
  while (index !== -1) {
    out += text.slice(cursor, index) + replacement;
    cursor = index + query.length;
    index = hay.indexOf(nd, cursor);
  }
  out += text.slice(cursor);
  return { text: out, count: matches.length };
}
