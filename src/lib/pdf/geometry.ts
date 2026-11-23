/**
 * Page geometry calculations shared by the generator, the stats estimator
 * and the preview panel. Mirrors pdfmake's page-size normalisation rules so
 * the numbers always match the produced document.
 */

import {
  MARGIN_PRESETS_MM,
  PAGE_SIZES_PT,
  mmToPt,
  type Margins,
  type PdfConfig,
} from "./types";

export interface PageGeometry {
  /** Final page width in points. */
  widthPt: number;
  /** Final page height in points. */
  heightPt: number;
  /** User margins in points (without header/footer reservation). */
  marginsPt: Margins;
  /** Content area width in points. */
  contentWidthPt: number;
  /** Content area height in points. */
  contentHeightPt: number;
}

function resolveRawSize(config: PdfConfig): [number, number] {
  if (config.pageSize === "CUSTOM") {
    const w = Math.max(30, Math.min(2000, config.customPageWidth || 210));
    const h = Math.max(30, Math.min(2000, config.customPageHeight || 297));
    return [mmToPt(w), mmToPt(h)];
  }
  return PAGE_SIZES_PT[config.pageSize];
}

export function resolveMargins(config: PdfConfig): Margins {
  if (config.marginPreset === "custom") {
    const m = config.customMargins;
    return {
      top: Math.max(0, Math.min(80, m.top || 0)),
      right: Math.max(0, Math.min(80, m.right || 0)),
      bottom: Math.max(0, Math.min(80, m.bottom || 0)),
      left: Math.max(0, Math.min(80, m.left || 0)),
    };
  }
  return MARGIN_PRESETS_MM[config.marginPreset];
}

/**
 * Computes the final page geometry for a configuration, applying the same
 * width/height swap pdfmake performs for mismatched orientations.
 */
export function pageGeometry(config: PdfConfig): PageGeometry {
  let [width, height] = resolveRawSize(config);
  const landscape = config.orientation === "landscape";
  if ((landscape && width < height) || (!landscape && width > height)) {
    [width, height] = [height, width];
  }
  const mm = resolveMargins(config);
  const marginsPt: Margins = {
    top: mmToPt(mm.top),
    right: mmToPt(mm.right),
    bottom: mmToPt(mm.bottom),
    left: mmToPt(mm.left),
  };
  return {
    widthPt: width,
    heightPt: height,
    marginsPt,
    contentWidthPt: width - marginsPt.left - marginsPt.right,
    contentHeightPt: height - marginsPt.top - marginsPt.bottom,
  };
}
