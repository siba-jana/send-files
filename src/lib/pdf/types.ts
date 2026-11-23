/**
 * Core configuration types for the Text to PDF converter.
 * All the PDF document options exposed in the settings UI live here.
 */

export type PageSizeId = "A4" | "A3" | "A5" | "LETTER" | "LEGAL" | "TABLOID" | "CUSTOM";
export type Orientation = "portrait" | "landscape";
export type MarginPresetId = "normal" | "narrow" | "moderate" | "wide" | "custom";
export type Align = "left" | "center" | "right" | "justify";

/** Margins in millimetres. */
export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PageBorderConfig {
  enabled: boolean;
  color: string;
  /** Border width in points. */
  width: number;
  style: "solid" | "dashed" | "dotted";
  /** Distance from the page edge in points. */
  inset: number;
}

export interface HeaderConfig {
  enabled: boolean;
  text: string;
  align: Exclude<Align, "justify">;
  fontSize: number;
  color: string;
  showBorder: boolean;
}

export interface FooterConfig {
  enabled: boolean;
  text: string;
  align: Exclude<Align, "justify">;
  fontSize: number;
  color: string;
  showBorder: boolean;
}

export type PageNumberPosition =
  | "bottom-center"
  | "bottom-left"
  | "bottom-right"
  | "top-center"
  | "top-left"
  | "top-right";

export type PageNumberFormat = "page" | "pageOf" | "slash" | "plain";

export interface PageNumberConfig {
  enabled: boolean;
  position: PageNumberPosition;
  format: PageNumberFormat;
  fontSize: number;
  color: string;
  /** Number shown on the first page (offset). */
  startAt: number;
  /** Suppress the page number on the first page. */
  hideOnFirstPage: boolean;
}

export interface WatermarkConfig {
  enabled: boolean;
  text: string;
  fontSize: number;
  color: string;
  /** 0 (transparent) to 1 (opaque). */
  opacity: number;
  /** Degrees, counter-clockwise. Used when placement is "custom". */
  angle: number;
  placement: "diagonal" | "horizontal" | "custom";
  position: "center" | "top" | "bottom" | "left" | "right";
}

/** Base document font families available to the user. */
export type BaseFontId = "Roboto" | "NotoSerif" | "NotoSansMono";

export interface TypographyConfig {
  fontFamily: BaseFontId;
  /** Body font size in points. */
  fontSize: number;
  lineHeight: number;
  /** Space between paragraphs in points. */
  paragraphSpacing: number;
  firstLineIndent: boolean;
  /** Letter spacing in points. */
  letterSpacing: number;
  textColor: string;
}

/** Optional table of contents generated from the document's H1–H3 headings. */
export interface TableOfContentsConfig {
  enabled: boolean;
  /** Heading shown above the contents list. */
  title: string;
}

export interface MetadataConfig {
  title: string;
  author: string;
  subject: string;
  keywords: string;
}

export interface PdfConfig {
  pageSize: PageSizeId;
  /** Custom page width in millimetres (used when pageSize is CUSTOM). */
  customPageWidth: number;
  /** Custom page height in millimetres (used when pageSize is CUSTOM). */
  customPageHeight: number;
  orientation: Orientation;
  marginPreset: MarginPresetId;
  /** Custom margins in mm (used when marginPreset is CUSTOM). */
  customMargins: Margins;
  backgroundColor: string;
  pageBorder: PageBorderConfig;
  /** Try to keep headings on the same page as the paragraph that follows them. */
  keepHeadingsWithContent: boolean;
  /** Optional contents page built from the H1–H3 headings. */
  tableOfContents: TableOfContentsConfig;
  typography: TypographyConfig;
  header: HeaderConfig;
  footer: FooterConfig;
  pageNumber: PageNumberConfig;
  watermark: WatermarkConfig;
  metadata: MetadataConfig;
  filename: string;
}

/** Named page sizes in PDF points (portrait). */
export const PAGE_SIZES_PT: Record<Exclude<PageSizeId, "CUSTOM">, [number, number]> = {
  A4: [595.28, 841.89],
  A3: [841.89, 1190.55],
  A5: [419.53, 595.28],
  LETTER: [612, 792],
  LEGAL: [612, 1008],
  TABLOID: [792, 1224],
};

/** Margin presets in millimetres, modelled on the classic word processor presets. */
export const MARGIN_PRESETS_MM: Record<Exclude<MarginPresetId, "custom">, Margins> = {
  normal: { top: 25.4, right: 25.4, bottom: 25.4, left: 25.4 },
  narrow: { top: 12.7, right: 12.7, bottom: 12.7, left: 12.7 },
  moderate: { top: 25.4, right: 19.05, bottom: 25.4, left: 19.05 },
  wide: { top: 25.4, right: 50.8, bottom: 25.4, left: 50.8 },
};

export const DEFAULT_CONFIG: PdfConfig = {
  pageSize: "A4",
  customPageWidth: 210,
  customPageHeight: 297,
  orientation: "portrait",
  marginPreset: "normal",
  customMargins: { top: 25.4, right: 25.4, bottom: 25.4, left: 25.4 },
  backgroundColor: "#ffffff",
  pageBorder: {
    enabled: false,
    color: "#9ca3af",
    width: 1,
    style: "solid",
    inset: 18,
  },
  keepHeadingsWithContent: true,
  tableOfContents: {
    enabled: false,
    title: "Table of Contents",
  },
  typography: {
    fontFamily: "Roboto",
    fontSize: 11,
    lineHeight: 1.2,
    paragraphSpacing: 8,
    firstLineIndent: false,
    letterSpacing: 0,
    textColor: "#111827",
  },
  header: {
    enabled: false,
    text: "",
    align: "center",
    fontSize: 9,
    color: "#6b7280",
    showBorder: true,
  },
  footer: {
    enabled: false,
    text: "",
    align: "center",
    fontSize: 9,
    color: "#6b7280",
    showBorder: true,
  },
  pageNumber: {
    enabled: false,
    position: "bottom-center",
    format: "pageOf",
    fontSize: 9,
    color: "#6b7280",
    startAt: 1,
    hideOnFirstPage: false,
  },
  watermark: {
    enabled: false,
    text: "DRAFT",
    fontSize: 48,
    color: "#ef4444",
    opacity: 0.15,
    angle: 45,
    placement: "diagonal",
    position: "center",
  },
  metadata: {
    title: "",
    author: "",
    subject: "",
    keywords: "",
  },
  filename: "text-document.pdf",
};

/** Millimetres to PDF points. */
export function mmToPt(mm: number): number {
  return mm * 2.8346456693;
}

/** Deep-merges a partial config patch into a full PdfConfig (objects merged, values replaced). */
export function mergeConfigPatch(base: PdfConfig, patch: Record<string, unknown>): PdfConfig {
  const out: Record<string, unknown> = { ...(base as unknown as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch)) {
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof out[key] === "object" &&
      out[key] !== null &&
      !Array.isArray(out[key])
    ) {
      out[key] = mergeConfigPatch(out[key] as unknown as PdfConfig, value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out as unknown as PdfConfig;
}
