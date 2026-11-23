/**
 * Watermark overlay applied with pdf-lib after the base document is generated.
 * This runs fully client-side and supports arbitrary rotation angles,
 * positions, colours and opacity (more control than the generator's built-in
 * watermark support).
 */

import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { FONT_FAMILIES, getFontFileBytes, SCRIPT_FONT } from "./fonts";
import { hexToRgb01 } from "./colors";
import { detectScripts } from "./unicode";
import type { WatermarkConfig } from "./types";

function resolveAngle(wm: WatermarkConfig): number {
  if (wm.placement === "horizontal") return 0;
  if (wm.placement === "diagonal") return 45;
  return Math.max(-90, Math.min(90, wm.angle));
}

/** Picks a Unicode-capable family when the watermark text is non Latin-1. */
function pickUnicodeFamily(text: string): string | null {
  const scripts = detectScripts(text);
  for (const script of scripts) {
    const fam = SCRIPT_FONT[script];
    if (fam) return fam;
  }
  return null;
}

export async function applyWatermark(bytes: Uint8Array, wm: WatermarkConfig): Promise<Uint8Array> {
  const text = wm.text.trim();
  if (!text) return bytes;

  const pdfDoc = await PDFDocument.load(bytes);
  const pages = pdfDoc.getPages();

  const isLatinOnly = !/[^\u0000-\u00ff]/.test(text);
  let font;
  if (isLatinOnly) {
    font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  } else {
    // Custom fonts require a fontkit instance on the document. pdf-lib's
    // subsetter targets fontkit 1.x, so custom watermark fonts are embedded
    // whole (subset: false) using the same fontkit 3.x the generator uses.
    const fontkitModule: any = await import("fontkit");
    const fontkit = fontkitModule.default ?? fontkitModule;
    if (typeof pdfDoc.registerFontkit === "function") {
      pdfDoc.registerFontkit(fontkit);
    }
    const familyId = pickUnicodeFamily(text) ?? "NotoSerif";
    const def = FONT_FAMILIES[familyId];
    const fontBytes = await getFontFileBytes(def.files.bold);
    font = await pdfDoc.embedFont(fontBytes, { subset: false });
  }

  const color = hexToRgb01(wm.color, { r: 0.6, g: 0.1, b: 0.1 });
  const angleDeg = resolveAngle(wm);
  const theta = (angleDeg * Math.PI) / 180;

  for (const page of pages) {
    const { width, height } = page.getSize();

    let size = wm.fontSize;
    let textWidth = font.widthOfTextAtSize(text, size);
    const maxWidth = Math.sqrt(width * width + height * height) * 0.85;
    if (textWidth > maxWidth) {
      size = Math.max(6, Math.round(size * (maxWidth / textWidth)));
      textWidth = font.widthOfTextAtSize(text, size);
    }

    let cx = width / 2;
    let cy = height / 2;
    switch (wm.position) {
      case "top":
        cx = width / 2;
        cy = height * 0.82;
        break;
      case "bottom":
        cx = width / 2;
        cy = height * 0.18;
        break;
      case "left":
        cx = width * 0.25;
        cy = height / 2;
        break;
      case "right":
        cx = width * 0.75;
        cy = height / 2;
        break;
      default:
        break;
    }

    const halfW = textWidth / 2;
    const halfH = size * 0.36; // visual centre of the glyphs
    const x = cx - halfW * Math.cos(theta) + halfH * Math.sin(theta);
    const y = cy - halfW * Math.sin(theta) - halfH * Math.cos(theta);

    page.drawText(text, {
      x,
      y,
      size,
      font,
      color: rgb(color.r, color.g, color.b),
      opacity: Math.max(0.02, Math.min(1, wm.opacity)),
      rotate: degrees(angleDeg),
    });
  }

  return pdfDoc.save({ useObjectStreams: false });
}

/** Counts pages of a PDF without rendering it (used for status display). */
export async function countPdfPages(bytes: Uint8Array): Promise<number> {
  const pdfDoc = await PDFDocument.load(bytes);
  return pdfDoc.getPageCount();
}
