/**
 * HTML sanitisation for the rich text editor.
 *
 * All pasted content and any HTML restored into the editor passes through
 * DOMPurify with a strict allowlist; the same sanitiser runs again before
 * PDF generation as defence in depth.
 */

import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "p",
  "div",
  "br",
  "span",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "ins",
  "s",
  "strike",
  "del",
  "a",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "pre",
  "code",
  "tt",
  "kbd",
  "samp",
  "hr",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "mark",
  "sub",
  "sup",
  "small",
  "font",
  "center",
];

const ALLOWED_ATTR = ["href", "style", "align", "color", "face", "size", "data-pagebreak"];

/** Style properties kept on inline elements. */
const ALLOWED_CSS_PROPS = new Set([
  "color",
  "background-color",
  "background",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-align",
  "text-decoration",
  "text-decoration-line",
]);

let configured = false;

function ensureConfigured(): void {
  if (configured) return;
  DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
    if (data.attrName !== "style") return;
    if (typeof data.attrValue !== "string") {
      data.keepAttr = false;
      return;
    }
    const kept: string[] = [];
    for (const decl of data.attrValue.split(";")) {
      const idx = decl.indexOf(":");
      if (idx === -1) continue;
      const prop = decl.slice(0, idx).trim().toLowerCase();
      const value = decl.slice(idx + 1).trim();
      if (prop && ALLOWED_CSS_PROPS.has(prop) && value) {
        kept.push(`${prop}: ${value}`);
      }
    }
    if (kept.length) {
      data.attrValue = kept.join("; ");
    } else {
      data.keepAttr = false;
    }
  });
  configured = true;
}

/** Sanitises an HTML fragment for safe use inside the editor. */
export function sanitizeEditorHtml(html: string): string {
  if (typeof window === "undefined" || !html) return "";
  ensureConfigured();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    FORBID_TAGS: ["script", "style", "img", "svg", "iframe", "object", "embed", "form", "input", "video", "audio"],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
    KEEP_CONTENT: true,
  });
}

/** True when the HTML has no visible text content. */
export function htmlIsEmpty(html: string): boolean {
  if (!html) return true;
  if (typeof window === "undefined") {
    return html.replace(/<[^>]*>/g, "").trim().length === 0;
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  const text = (doc.body?.textContent ?? "").replace(/\u200b/g, "").trim();
  if (text.length > 0) return false;
  // A document that only contains an <hr> is not empty.
  return !doc.body?.querySelector("hr,table,ul,ol");
}

/** Unwraps <mark> elements (find highlights) leaving their text intact. */
export function unwrapMarks(root: HTMLElement): void {
  for (const mark of Array.from(root.querySelectorAll("mark"))) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  }
  root.normalize();
}
