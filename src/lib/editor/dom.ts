/**
 * DOM helpers for the editor: selection management, HTML <-> plain text
 * conversions and escaping. Browser-only (used from client components).
 */

/** Escapes HTML special characters. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Converts editor HTML into clean plain text (block aware). */
export function htmlToPlainText(html: string): string {
  if (typeof window === "undefined" || !html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const parts: string[] = [];

  const isList = (el: Element) => el.tagName === "UL" || el.tagName === "OL";

  const walkInline = (node: Node, out: string[]): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) {
        out.push(child.nodeValue ?? "");
      } else if (child.nodeType === 1) {
        const el = child as Element;
        const tag = el.tagName.toUpperCase();
        if (tag === "BR") {
          out.push("\n");
        } else if (tag === "TD" || tag === "TH") {
          walkInline(el, out);
          out.push("  ");
        } else {
          walkInline(el, out);
        }
      }
    }
  };

  const walkBlock = (parent: Node, indent = 0): void => {
    for (const child of Array.from(parent.childNodes)) {
      if (child.nodeType === 3) {
        const text = (child.nodeValue ?? "").trim();
        if (text) parts.push(text + "\n\n");
        continue;
      }
      if (child.nodeType !== 1) continue;
      const el = child as Element;
      const tag = el.tagName.toUpperCase();
      const pad = "  ".repeat(indent);

      if (tag === "BR") continue;

      if (/^H[1-6]$/.test(tag) || tag === "P" || tag === "DIV" || tag === "BLOCKQUOTE" || tag === "PRE") {
        const out: string[] = [];
        walkInline(el, out);
        const text = out.join("").replace(/[ \t]+/g, " ").trim();
        parts.push(text + "\n\n");
      } else if (isList(el)) {
        const items = Array.from(el.children).filter((li) => li.tagName === "LI");
        items.forEach((li, index) => {
          const out: string[] = [];
          walkInline(li, out);
          const text = out.join("").replace(/[ \t]+/g, " ").trim();
          const marker = tag === "OL" ? `${index + 1}. ` : "- ";
          parts.push(pad + marker + text + "\n");
          // Nested lists
          for (const sub of Array.from(li.children)) {
            if (isList(sub)) walkBlock(sub, indent + 1);
          }
        });
        parts.push("\n");
      } else if (tag === "TABLE") {
        for (const tr of Array.from(el.querySelectorAll("tr"))) {
          const cells = Array.from(tr.children)
            .filter((c) => c.tagName === "TD" || c.tagName === "TH")
            .map((c) => (c.textContent ?? "").trim());
          if (cells.length) parts.push(cells.join("  ") + "\n");
        }
        parts.push("\n");
      } else if (tag === "HR") {
        parts.push("---\n\n");
      } else {
        walkBlock(el, indent);
      }
    }
  };

  walkBlock(doc.body);
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

/** Converts plain text into editor HTML (paragraphs + line breaks). */
export function plainTextToHtml(text: string): string {
  if (!text) return "";
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return blocks
    .map((block) => {
      const lines = block.split("\n").map((l) => escapeHtml(l));
      return `<p>${lines.join("<br>")}</p>`;
    })
    .join("");
}

/**
 * Saves and restores the editor selection so toolbar popovers and selects
 * can steal focus without losing the user's text selection.
 */
export class SelectionManager {
  private range: Range | null = null;
  private root: HTMLElement | null = null;

  constructor(root: HTMLElement | null) {
    this.root = root;
  }

  setRoot(root: HTMLElement | null): void {
    this.root = root;
  }

  save(): void {
    if (typeof window === "undefined" || !this.root) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (this.root.contains(range.commonAncestorContainer)) {
      this.range = range.cloneRange();
    }
  }

  hasSelection(): boolean {
    return this.range !== null;
  }

  restore(focus = true): boolean {
    if (typeof window === "undefined" || !this.range) return false;
    const sel = window.getSelection();
    if (!sel) return false;
    if (focus && this.root) {
      this.root.focus({ preventScroll: true });
    }
    try {
      sel.removeAllRanges();
      sel.addRange(this.range);
      return true;
    } catch {
      return false;
    }
  }

  clear(): void {
    this.range = null;
  }

  /** Text of the current selection (empty string when nothing selected). */
  selectedText(): string {
    return this.range?.toString() ?? "";
  }
}
