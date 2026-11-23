/**
 * Small colour helpers shared by the PDF generation pipeline.
 * Only #rgb and #rrggbb hex strings are accepted (what the colour inputs produce).
 */

export interface Rgb01 {
  r: number;
  g: number;
  b: number;
}

export function isValidHex(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

export function normalizeHex(value: string, fallback = "#000000"): string {
  const v = value?.trim();
  if (!v) return fallback;
  if (isValidHex(v)) {
    if (v.length === 4) {
      return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase();
    }
    return v.toLowerCase();
  }
  return fallback;
}

export function hexToRgb01(hex: string, fallback: Rgb01 = { r: 0, g: 0, b: 0 }): Rgb01 {
  const h = normalizeHex(hex, "#000000");
  const r = parseInt(h.slice(1, 3), 16) / 255;
  const g = parseInt(h.slice(3, 5), 16) / 255;
  const b = parseInt(h.slice(5, 7), 16) / 255;
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return fallback;
  return { r, g, b };
}
