/**
 * Filename sanitisation for downloads.
 */

const DEFAULT_FILENAME = "text-document.pdf";

/**
 * Returns a safe PDF filename:
 *  - removes path separators and reserved characters
 *  - removes any existing extension and re-appends .pdf
 *  - falls back to the default name when nothing usable remains
 */
export function sanitizeFilename(raw: string | null | undefined): string {
  let name = (raw ?? "").trim();
  if (!name) return DEFAULT_FILENAME;

  // Remove reserved characters and control characters.
  name = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "");
  // Collapse whitespace.
  name = name.replace(/\s+/g, " ").trim();
  // No leading dots or hyphens (hidden files / odd names).
  name = name.replace(/^[.\-\s]+/, "");
  // Remove any extension, then re-append .pdf.
  name = name.replace(/\.[A-Za-z0-9]{1,5}$/, "");
  name = name.trim();

  if (!name) return DEFAULT_FILENAME;
  if (name.length > 100) name = name.slice(0, 100).trim();
  return `${name}.pdf`;
}
