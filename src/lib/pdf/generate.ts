/**
 * PDF generation orchestrator.
 *
 * Pipeline: editor HTML -> pdfmake docDefinition -> PDF bytes -> optional
 * watermark overlay (pdf-lib) -> result consumed by the preview and download.
 *
 * When the optional table of contents is enabled, the doc definition starts
 * with a `toc` element that collects the H1–H3 headings tagged `tocItem` by
 * the converter (pdfmake resolves their page numbers) followed by a page
 * break, so the body content begins on a fresh page.
 *
 * Everything runs in the user's browser; no document data ever leaves the page.
 */

import { htmlToPdfContent } from "./convert";
import { ensureFontFamilies, getPdfMake } from "./fonts";
import { pageGeometry } from "./geometry";
import { applyWatermark, countPdfPages } from "./watermark";
import { normalizeHex } from "./colors";
import type { PdfConfig } from "./types";

export interface GenerateResult {
  bytes: Uint8Array;
  pageCount: number;
  pageWidthPt: number;
  pageHeightPt: number;
}

/* ------------------------------------------------------------------ */
/* Header / footer builders                                            */
/* ------------------------------------------------------------------ */

/** Resolved values injected into header/footer text tokens at render time. */
interface TokenContext {
  /** Localized current date, e.g. "Mar 14, 2025". */
  date: string;
  /** Localized current time, e.g. "2:30 PM". */
  time: string;
  /** Document title: metadata title, else filename without extension, else fallback. */
  title: string;
  /** Display page number (already offset-adjusted). */
  page: number;
  /** Display total page count (already offset-adjusted). */
  pages: number;
}

/**
 * Expands the dynamic tokens supported in header and footer text:
 * `{date}`, `{time}`, `{title}`, `{page}` and `{pages}`. Unknown tokens are
 * left untouched. Pure rewrite — the result depends only on the inputs.
 */
function expandTokens(text: string, ctx: TokenContext): string {
  return text.replace(/\{(\w+)\}/g, (token, name: string) => {
    switch (name) {
      case "date":
        return ctx.date;
      case "time":
        return ctx.time;
      case "title":
        return ctx.title;
      case "page":
        return String(ctx.page);
      case "pages":
        return String(ctx.pages);
      default:
        return token;
    }
  });
}

/** Clamps the page-numbering start offset to the supported 0–9999 range. */
function pageStartAt(raw: number): number {
  const value = typeof raw === "number" && Number.isFinite(raw) ? raw : 1;
  return Math.min(9999, Math.max(0, Math.round(value)));
}

/**
 * Builds the token context for one rendered page: fresh localized date and
 * time strings, the resolved document title, and page counters adjusted by
 * the numbering start offset.
 */
function tokenContextForPage(
  config: PdfConfig,
  current: number,
  total: number,
  startAt: number
): TokenContext {
  const metaTitle = config.metadata.title.trim();
  const filenameStem = config.filename.trim().replace(/\.pdf$/i, "").trim();
  return {
    date: new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    time: new Date().toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }),
    title: metaTitle || filenameStem || "Untitled document",
    page: current + startAt - 1,
    pages: total + startAt - 1,
  };
}

function pageNumberText(format: PdfConfig["pageNumber"]["format"], current: number, total: number): string {
  switch (format) {
    case "page":
      return `Page ${current}`;
    case "pageOf":
      return `Page ${current} of ${total}`;
    case "slash":
      return `${current} / ${total}`;
    case "plain":
    default:
      return `${current}`;
  }
}

function columnOf(position: string): "left" | "center" | "right" {
  if (position.endsWith("-left")) return "left";
  if (position.endsWith("-center")) return "center";
  return "right";
}

/** Builds the three-column (left/center/right) row used by headers and footers. */
function buildRow(items: Array<{ slot: "left" | "center" | "right"; text: string; fontSize: number; color: string }>): any {
  const slots: Record<"left" | "center" | "right", any> = {
    left: "",
    center: "",
    right: "",
  };
  for (const item of items) {
    if (!item.text) continue;
    if (slots[item.slot] === "" || slots[item.slot] == null) {
      slots[item.slot] = { text: item.text, fontSize: item.fontSize, color: item.color };
    } else {
      // Two items share the same slot -> join on one line.
      const existing = slots[item.slot];
      slots[item.slot] = {
        text: [
          existing,
          { text: "  ·  ", fontSize: item.fontSize, color: item.color },
          { text: item.text, fontSize: item.fontSize, color: item.color },
        ],
      };
    }
  }
  const col = (content: any, alignment: "left" | "center" | "right") => ({
    text: content ?? "",
    alignment,
    width: "*",
  });
  return { columns: [col(slots.left, "left"), col(slots.center, "center"), col(slots.right, "right")], columnGap: 0 };
}

function borderLine(contentWidthPt: number, marginTop = 0, marginBottom = 0): any {
  return {
    canvas: [
      { type: "line", x1: 0, y1: 0, x2: contentWidthPt, y2: 0, lineWidth: 0.75, lineColor: "#d1d5db" },
    ],
    margin: [0, marginTop, 0, marginBottom],
  };
}

interface HeaderFooterBuild {
  header?: (current: number, total: number, pageSize: any) => any;
  footer?: (current: number, total: number, pageSize: any) => any;
  /** Vertical space (pt) the header/footer needs inside the page margin band. */
  headerBand: number;
  footerBand: number;
}

function buildHeaderFooter(config: PdfConfig, contentWidthPt: number): HeaderFooterBuild {
  const margin = pageGeometry(config).marginsPt;
  const result: HeaderFooterBuild = { headerBand: 0, footerBand: 0 };

  const startAt = pageStartAt(config.pageNumber.startAt);
  const hideOnFirstPage = config.pageNumber.hideOnFirstPage === true;
  const numberTop =
    config.pageNumber.enabled && config.pageNumber.position.startsWith("top-");
  const numberBottom =
    config.pageNumber.enabled && config.pageNumber.position.startsWith("bottom-");
  const headerHasText = config.header.enabled && config.header.text.trim().length > 0;
  const footerHasText = config.footer.enabled && config.footer.text.trim().length > 0;

  const headerVisible = headerHasText || numberTop || (config.header.enabled && config.header.showBorder);
  const footerVisible = footerHasText || numberBottom || (config.footer.enabled && config.footer.showBorder);

  if (headerVisible) {
    const fontSize = headerHasText ? config.header.fontSize : config.pageNumber.fontSize;
    const line = fontSize * 1.3;
    const borderSpace = config.header.enabled && config.header.showBorder ? 9 : 0;
    const topPad = 20;
    result.headerBand = topPad + line + borderSpace + 6;

    result.header = (current: number, total: number) => {
      const ctx = tokenContextForPage(config, current, total, startAt);
      const items: Array<{ slot: "left" | "center" | "right"; text: string; fontSize: number; color: string }> = [];
      if (headerHasText) {
        items.push({
          slot: config.header.align,
          text: expandTokens(config.header.text.trim(), ctx),
          fontSize: config.header.fontSize,
          color: normalizeHex(config.header.color, "#6b7280"),
        });
      }
      if (numberTop && !(hideOnFirstPage && current === 1)) {
        items.push({
          slot: columnOf(config.pageNumber.position),
          text: pageNumberText(config.pageNumber.format, ctx.page, ctx.pages),
          fontSize: config.pageNumber.fontSize,
          color: normalizeHex(config.pageNumber.color, "#6b7280"),
        });
      }
      const stack: any[] = [buildRow(items)];
      if (config.header.enabled && config.header.showBorder) {
        stack.push(borderLine(contentWidthPt, 5, 0));
      }
      return { margin: [margin.left, topPad, margin.right, 0], stack };
    };
  }

  if (footerVisible) {
    const fontSize = footerHasText ? config.footer.fontSize : config.pageNumber.fontSize;
    const line = fontSize * 1.3;
    const borderSpace = config.footer.enabled && config.footer.showBorder ? 9 : 0;
    const bottomGap = 18;
    result.footerBand = bottomGap + line + borderSpace + 6;

    const band = result.footerBand;

    result.footer = (current: number, total: number) => {
      const ctx = tokenContextForPage(config, current, total, startAt);
      const items: Array<{ slot: "left" | "center" | "right"; text: string; fontSize: number; color: string }> = [];
      if (footerHasText) {
        items.push({
          slot: config.footer.align,
          text: expandTokens(config.footer.text.trim(), ctx),
          fontSize: config.footer.fontSize,
          color: normalizeHex(config.footer.color, "#6b7280"),
        });
      }
      if (numberBottom && !(hideOnFirstPage && current === 1)) {
        items.push({
          slot: columnOf(config.pageNumber.position),
          text: pageNumberText(config.pageNumber.format, ctx.page, ctx.pages),
          fontSize: config.pageNumber.fontSize,
          color: normalizeHex(config.pageNumber.color, "#6b7280"),
        });
      }
      const stack: any[] = [];
      if (config.footer.enabled && config.footer.showBorder) {
        stack.push(borderLine(contentWidthPt, 0, 4));
      }
      stack.push(buildRow(items));
      // Position the row so its text bottom sits `bottomGap` above the page edge.
      const rowTop = Math.max(0, band - bottomGap - line - (config.footer.enabled && config.footer.showBorder ? 9 : 0));
      return { margin: [margin.left, rowTop, margin.right, 0], stack };
    };
  }

  return result;
}

/* ------------------------------------------------------------------ */
/* Doc definition                                                      */
/* ------------------------------------------------------------------ */

function buildDocDefinition(html: string, config: PdfConfig, converted: ReturnType<typeof htmlToPdfContent>): any {
  const geom = pageGeometry(config);
  const { header, footer, headerBand, footerBand } = buildHeaderFooter(config, geom.contentWidthPt);

  // Reserve room for header/footer bands inside the page margin bands.
  const topMargin = Math.max(geom.marginsPt.top, headerBand > 0 ? headerBand + 8 : 0);
  const bottomMargin = Math.max(geom.marginsPt.bottom, footerBand > 0 ? footerBand + 6 : 0);

  // pdfmake 0.3 expects custom sizes as {width, height} objects (in points).
  const pageSize: any =
    config.pageSize === "CUSTOM"
      ? {
          width: Math.max(30, Math.min(2000, config.customPageWidth || 210)) * 2.8346456693,
          height: Math.max(30, Math.min(2000, config.customPageHeight || 297)) * 2.8346456693,
        }
      : config.pageSize;

  const background = (currentPage: number, pageSizeInfo: { width: number; height: number }) => {
    const canvas: any[] = [
      {
        type: "rect",
        x: 0,
        y: 0,
        w: pageSizeInfo.width,
        h: pageSizeInfo.height,
        color: normalizeHex(config.backgroundColor, "#ffffff"),
      },
    ];
    if (config.pageBorder.enabled) {
      const inset = Math.max(
        0,
        Math.min(config.pageBorder.inset, Math.min(pageSizeInfo.width, pageSizeInfo.height) / 2 - 4)
      );
      const style = config.pageBorder.style;
      canvas.push({
        type: "rect",
        x: inset,
        y: inset,
        w: pageSizeInfo.width - inset * 2,
        h: pageSizeInfo.height - inset * 2,
        lineWidth: config.pageBorder.width,
        lineColor: normalizeHex(config.pageBorder.color, "#9ca3af"),
        ...(style === "dashed" ? { dash: { length: 6, space: 4 } } : {}),
        ...(style === "dotted" ? { dash: { length: 0.5, space: 3 }, lineCap: "round" } : {}),
      });
    }
    return { canvas };
  };

  const keywords = config.metadata.keywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  const info: Record<string, string> = { creator: "Text to PDF Converter" };
  if (config.metadata.title.trim()) info.title = config.metadata.title.trim();
  if (config.metadata.author.trim()) info.author = config.metadata.author.trim();
  if (config.metadata.subject.trim()) info.subject = config.metadata.subject.trim();
  if (keywords.length) info.keywords = keywords.join(", ");

  const defaultStyle: any = {
    font: config.typography.fontFamily,
    fontSize: config.typography.fontSize,
    lineHeight: config.typography.lineHeight,
    color: normalizeHex(config.typography.textColor, "#111827"),
  };
  if (config.typography.letterSpacing > 0) {
    defaultStyle.characterSpacing = config.typography.letterSpacing;
  }

  // Optional contents page: the toc element lists every H1–H3 heading tagged
  // with `tocItem` by the converter, with page numbers computed by pdfmake.
  // The page break after it starts the body content on a fresh page.
  const tocTitle = config.tableOfContents.title.trim();
  const content: any[] = config.tableOfContents.enabled
    ? [
        {
          toc: tocTitle
            ? {
                title: {
                  text: tocTitle,
                  bold: true,
                  fontSize: 14,
                  margin: [0, 0, 0, 10],
                },
              }
            : {},
          pageBreak: "after",
        },
        ...converted.content,
      ]
    : converted.content;

  return {
    pageSize,
    pageOrientation: config.orientation,
    pageMargins: [geom.marginsPt.left, topMargin, geom.marginsPt.right, bottomMargin],
    background,
    ...(header ? { header } : {}),
    ...(footer ? { footer } : {}),
    info,
    defaultStyle,
    content,
  };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function generatePdf(html: string, config: PdfConfig): Promise<GenerateResult> {
  const geom = pageGeometry(config);
  const converted = htmlToPdfContent(html, { config, contentWidthPt: geom.contentWidthPt });

  const pdfMake = await getPdfMake();
  await ensureFontFamilies(converted.fontsUsed);

  const dd = buildDocDefinition(html, config, converted);
  const doc = pdfMake.createPdf(dd);

  let bytes: Uint8Array;
  if (typeof doc.getBlob === "function") {
    const blob: Blob = await doc.getBlob();
    bytes = new Uint8Array(await blob.arrayBuffer());
  } else {
    const buffer = await doc.getBuffer();
    bytes = new Uint8Array(buffer as unknown as ArrayLike<number>);
  }

  if (config.watermark.enabled && config.watermark.text.trim()) {
    bytes = await applyWatermark(bytes, config.watermark);
  }

  const pageCount = await countPdfPages(bytes).catch(() => 1);

  return {
    bytes,
    pageCount,
    pageWidthPt: geom.widthPt,
    pageHeightPt: geom.heightPt,
  };
}
