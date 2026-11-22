import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";
import { DocumentSettings, THEME_CONFIGS } from "./types";

/**
 * Triggers the browser's native Print dialog, configured for high-fidelity vector PDF saving.
 * Vector PDF printing preserves true text sharpness, clickable links, crisp math & code,
 * and exact paper sizing.
 */
export function printVectorPdf(
  settings: DocumentSettings,
  documentTitle: string
) {
  const pageSizeParam = settings.pageSize === "letter" ? "letter" : "A4";

  let marginMm = 20;
  if (settings.margin === "compact") marginMm = 12;
  if (settings.margin === "wide") marginMm = 28;

  // Set document title temporarily so the browser suggests it as default PDF filename
  const previousTitle = document.title;
  if (documentTitle.trim()) {
    document.title = documentTitle.trim();
  }

  const orientationParam = settings.orientation || "portrait";

  // Create temporary print style tag
  const styleEl = document.createElement("style");
  styleEl.id = "chatgpt-dynamic-print-style";
  styleEl.innerHTML = `
    @page {
      size: ${pageSizeParam} ${orientationParam};
      margin: ${marginMm}mm;
    }
    @media print {
      html, body {
        background: #ffffff !important;
        color: #000000 !important;
        margin: 0 !important;
        padding: 0 !important;
        font-family: ${
          settings.fontFamily === "serif"
            ? "Georgia, Cambria, 'Times New Roman', serif"
            : settings.fontFamily === "mono"
            ? "'SFMono-Regular', Menlo, Monaco, Consolas, monospace"
            : "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        } !important;
      }
      body * {
        visibility: hidden !important;
      }
      #chatgpt-printable-document, #chatgpt-printable-document * {
        visibility: visible !important;
      }
      #chatgpt-printable-document {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border: none !important;
        background: #ffffff !important;
        color: #000000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .chatgpt-page-viewport {
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
      }
      .chatgpt-page-content {
        transform: none !important;
      }
      .no-print, .no-print * {
        display: none !important;
        visibility: hidden !important;
      }
      .break-inside-avoid {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      .break-after-avoid {
        break-after: avoid !important;
        page-break-after: avoid !important;
      }
    }
  `;

  document.head.appendChild(styleEl);

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      styleEl.remove();
      document.title = previousTitle;
    }, 1000);
  }, 150);
}

interface RenderPage {
  pageEl: HTMLElement;
  contentEl: HTMLElement;
  footerBadgeEl?: HTMLElement;
}

/**
 * High-Quality Direct Client-Side PDF Generation.
 *
 * Solves the classic "ugly html2pdf" bugs:
 * 1. Intelligent block-level pagination — eliminates sliced text lines, cut-off code, and split headers.
 * 2. Proper 4-sided page margins on EVERY page.
 * 3. Theme accent header and "Page X of Y" footer on EVERY page.
 * 4. Lossless PNG rendering at 2.5x retina scale (240+ DPI) for razor-sharp text.
 * 5. Direct file download with zero print dialog.
 */
export async function downloadPdfDirect(
  sourceRootElement: HTMLElement,
  filename: string,
  settings: DocumentSettings,
  onProgress?: (progress: number) => void
): Promise<void> {
  onProgress?.(5);

  // Ensure fonts are ready for crisp rendering
  if (typeof document !== "undefined" && "fonts" in document) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore
    }
  }

  const themeConfig = THEME_CONFIGS[settings.theme] || THEME_CONFIGS.clean;
  const isLandscape = settings.orientation === "landscape";
  const isLetter = settings.pageSize === "letter";

  // Standard PDF point sizes (72 pt per inch)
  const ptWidth = isLetter ? 612 : 595.28;
  const ptHeight = isLetter ? 792 : 841.89;
  const pdfWidth = isLandscape ? ptHeight : ptWidth;
  const pdfHeight = isLandscape ? ptWidth : ptHeight;

  // Exact pixel dimensions for DOM page simulation (standard 96 DPI CSS pixels)
  // A4 portrait: 794 x 1123 px (aspect ratio 1.414)
  // Letter portrait: 816 x 1056 px (aspect ratio 1.294)
  const cssWidth = isLandscape ? (isLetter ? 1056 : 1123) : (isLetter ? 816 : 794);
  const cssHeight = isLandscape ? (isLetter ? 792 : 842) : (isLetter ? 1056 : 1123);

  // Margins in CSS pixels
  let padX = 48;
  let padTop = 38;
  let padBottom = 34;

  if (settings.margin === "compact") {
    padX = 32;
    padTop = 28;
    padBottom = 26;
  } else if (settings.margin === "wide") {
    padX = 64;
    padTop = 50;
    padBottom = 42;
  }

  const topAccentHeight = 6;
  const topAccentGap = 16;
  const footerHeight = settings.showPageNumbers ? 32 : 0;
  const footerGap = 14;

  // Maximum printable height inside each page card
  const contentMaxHeight = Math.max(
    300,
    cssHeight - padTop - padBottom - topAccentHeight - topAccentGap - footerHeight - footerGap
  );

  // Font family string
  const fontFamilyStr =
    settings.fontFamily === "serif"
      ? "Georgia, Cambria, 'Times New Roman', serif"
      : settings.fontFamily === "mono"
      ? "'SFMono-Regular', Menlo, Monaco, Consolas, monospace"
      : "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  // Font size & line height classes
  const fontClass =
    settings.fontFamily === "serif"
      ? "font-serif"
      : settings.fontFamily === "mono"
      ? "font-mono"
      : "font-sans";

  const fontSizeClass =
    settings.fontSize === "sm"
      ? "text-[13.5px]"
      : settings.fontSize === "lg"
      ? "text-[16.5px]"
      : "text-[15px]";

  const lineHeightClass =
    settings.lineHeight === "compact"
      ? "leading-normal"
      : settings.lineHeight === "relaxed"
      ? "leading-loose"
      : "leading-relaxed";

  // Create an offscreen staging container (hidden from view behind the body)
  const host = document.createElement("div");
  host.id = "chatgpt-pdf-render-host";
  host.style.position = "fixed";
  host.style.left = "0";
  host.style.top = "0";
  host.style.zIndex = "-99999";
  host.style.pointerEvents = "none";
  host.style.width = `${cssWidth}px`;
  document.body.appendChild(host);

  function buildNewPage(pageIndex: number): RenderPage {
    const pageEl = document.createElement("div");
    pageEl.className = "chatgpt-export-page";
    pageEl.style.width = `${cssWidth}px`;
    pageEl.style.minHeight = `${cssHeight}px`;
    pageEl.style.boxSizing = "border-box";
    pageEl.style.backgroundColor = themeConfig.previewBg || "#ffffff";
    pageEl.style.color = "#0f172a";
    pageEl.style.padding = `${padTop}px ${padX}px ${padBottom}px ${padX}px`;
    pageEl.style.display = "flex";
    pageEl.style.flexDirection = "column";
    pageEl.style.justifyContent = "space-between";
    pageEl.style.position = "relative";
    pageEl.style.fontFamily = fontFamilyStr;

    // Top accent bar
    const accentBar = document.createElement("div");
    accentBar.style.position = "absolute";
    accentBar.style.top = "0";
    accentBar.style.left = "0";
    accentBar.style.right = "0";
    accentBar.style.height = `${topAccentHeight}px`;
    accentBar.style.backgroundColor = themeConfig.primaryColor;
    pageEl.appendChild(accentBar);

    // Content container - natural auto height during assembly for accurate measurement
    const contentEl = document.createElement("div");
    contentEl.className = `prose-chatgpt ${fontClass} ${fontSizeClass} ${lineHeightClass}`;
    contentEl.style.width = "100%";
    contentEl.style.boxSizing = "border-box";
    contentEl.style.marginTop = `${topAccentGap}px`;
    contentEl.style.marginBottom = `${footerGap}px`;
    pageEl.appendChild(contentEl);

    // Footer
    let footerBadgeEl: HTMLElement | undefined;
    if (settings.showPageNumbers) {
      const footerEl = document.createElement("footer");
      footerEl.style.height = `${footerHeight}px`;
      footerEl.style.borderTop = "1px solid #e2e8f0";
      footerEl.style.display = "flex";
      footerEl.style.alignItems = "center";
      footerEl.style.justifyContent = "space-between";
      footerEl.style.fontSize = "11px";
      footerEl.style.color = "#64748b";
      footerEl.style.marginTop = "auto";
      footerEl.style.boxSizing = "border-box";

      const brandSpan = document.createElement("span");
      brandSpan.style.color = "#94a3b8";
      brandSpan.textContent = "Generated with ilovedoc.org";
      footerEl.appendChild(brandSpan);

      footerBadgeEl = document.createElement("div");
      footerBadgeEl.style.fontFamily = "ui-monospace, monospace";
      footerBadgeEl.style.fontSize = "11px";
      footerBadgeEl.style.fontWeight = "600";
      footerBadgeEl.style.color = "#475569";
      footerBadgeEl.style.backgroundColor = "#f1f5f9";
      footerBadgeEl.style.padding = "2px 8px";
      footerBadgeEl.style.borderRadius = "4px";
      footerBadgeEl.textContent = `Page ${pageIndex}`;
      footerEl.appendChild(footerBadgeEl);

      pageEl.appendChild(footerEl);
    }

    return { pageEl, contentEl, footerBadgeEl };
  }

  try {
    // Locate the source markdown element
    const proseEl =
      sourceRootElement.querySelector<HTMLElement>(".prose-chatgpt") ||
      sourceRootElement.querySelector<HTMLElement>(".chatgpt-page-content") ||
      sourceRootElement;

    const sourceChildren = Array.from(proseEl.children) as HTMLElement[];

    const pages: RenderPage[] = [];
    let currentPage = buildNewPage(1);
    pages.push(currentPage);
    host.appendChild(currentPage.pageEl);

    onProgress?.(15);

    // Helper to get true rendered content height of the current page
    const getPageContentHeight = () => {
      return currentPage.contentEl.offsetHeight;
    };

    // Helper to check if an element is an intro line (e.g. ends with ":") or a heading
    const isIntroOrHeading = (el: HTMLElement) => {
      const tag = el.tagName.toUpperCase();
      if (["H1", "H2", "H3", "H4"].includes(tag)) return true;
      if (tag === "P") {
        const txt = el.textContent?.trim() || "";
        return txt.endsWith(":") && txt.length < 100;
      }
      return false;
    };

    // Distribute source block elements into pages cleanly
    for (let i = 0; i < sourceChildren.length; i++) {
      const originalBlock = sourceChildren[i];
      const clone = originalBlock.cloneNode(true) as HTMLElement;

      // Clean up interactive buttons (e.g. "Copy code" button)
      clone.querySelectorAll("button").forEach((btn) => btn.remove());

      // Ensure tables do not clip horizontally
      if (clone.tagName.toUpperCase() === "DIV" && clone.querySelector("table")) {
        clone.style.overflowX = "visible";
      }

      const tagName = clone.tagName.toUpperCase();
      const isList = tagName === "UL" || tagName === "OL";
      const isHeadingOrIntro = isIntroOrHeading(clone);

      // Try appending to current page
      currentPage.contentEl.appendChild(clone);
      const currentHeight = getPageContentHeight();

      // CASE 1: The block fits comfortably on the current page
      if (currentHeight <= contentMaxHeight) {
        // Prevent orphan heading or orphan intro line at the very bottom (less than 90px remaining)
        if (
          isHeadingOrIntro &&
          contentMaxHeight - currentHeight < 90 &&
          currentPage.contentEl.children.length > 1
        ) {
          currentPage.contentEl.removeChild(clone);
          // Start fresh page
          currentPage = buildNewPage(pages.length + 1);
          pages.push(currentPage);
          host.appendChild(currentPage.pageEl);
          currentPage.contentEl.appendChild(clone);
        }
        continue;
      }

      // CASE 2: The block overflows the current page!
      currentPage.contentEl.removeChild(clone);

      // SUB-CASE 2A: It's a LIST (UL or OL) -> Split items across pages to fill remaining space!
      if (isList) {
        const items = Array.from(clone.children) as HTMLElement[];
        if (items.length > 0) {
          // Check if at least 1 item fits on the current page
          const firstPart = clone.cloneNode(false) as HTMLElement;
          currentPage.contentEl.appendChild(firstPart);

          let itemIdx = 0;
          while (itemIdx < items.length) {
            const li = items[itemIdx].cloneNode(true) as HTMLElement;
            firstPart.appendChild(li);

            if (getPageContentHeight() <= contentMaxHeight) {
              itemIdx++;
            } else {
              firstPart.removeChild(li);
              break;
            }
          }

          // If at least 1 item fit on the current page:
          if (firstPart.children.length > 0) {
            // If all items fit, we are done
            if (itemIdx >= items.length) {
              continue;
            }

            // Start a new page for remaining items
            currentPage = buildNewPage(pages.length + 1);
            pages.push(currentPage);
            host.appendChild(currentPage.pageEl);

            let currentPart = clone.cloneNode(false) as HTMLElement;
            if (tagName === "OL") {
              (currentPart as HTMLOListElement).start = itemIdx + 1;
            }
            currentPage.contentEl.appendChild(currentPart);

            for (let r = itemIdx; r < items.length; r++) {
              const li = items[r].cloneNode(true) as HTMLElement;
              currentPart.appendChild(li);

              if (getPageContentHeight() > contentMaxHeight && currentPart.children.length > 1) {
                currentPart.removeChild(li);
                // Start next page
                currentPage = buildNewPage(pages.length + 1);
                pages.push(currentPage);
                host.appendChild(currentPage.pageEl);

                currentPart = clone.cloneNode(false) as HTMLElement;
                if (tagName === "OL") {
                  (currentPart as HTMLOListElement).start = r + 1;
                }
                currentPage.contentEl.appendChild(currentPart);
                currentPart.appendChild(li);
              }
            }
            continue;
          } else {
            // Not even 1 item fit on current page: remove empty list container
            firstPart.remove();

            // If the preceding element was an orphan intro line (like "Include:"), pull it to the new page too
            let pulledIntro: HTMLElement | null = null;
            if (
              currentPage.contentEl.lastElementChild &&
              isIntroOrHeading(currentPage.contentEl.lastElementChild as HTMLElement) &&
              currentPage.contentEl.children.length > 1
            ) {
              pulledIntro = currentPage.contentEl.lastElementChild as HTMLElement;
              currentPage.contentEl.removeChild(pulledIntro);
            }

            // Start new page
            currentPage = buildNewPage(pages.length + 1);
            pages.push(currentPage);
            host.appendChild(currentPage.pageEl);

            if (pulledIntro) {
              currentPage.contentEl.appendChild(pulledIntro);
            }

            // Place list on fresh page, splitting across pages if needed
            let currentPart = clone.cloneNode(false) as HTMLElement;
            currentPage.contentEl.appendChild(currentPart);

            for (let r = 0; r < items.length; r++) {
              const li = items[r].cloneNode(true) as HTMLElement;
              currentPart.appendChild(li);

              if (getPageContentHeight() > contentMaxHeight && currentPart.children.length > 1) {
                currentPart.removeChild(li);
                // Start next page
                currentPage = buildNewPage(pages.length + 1);
                pages.push(currentPage);
                host.appendChild(currentPage.pageEl);

                currentPart = clone.cloneNode(false) as HTMLElement;
                if (tagName === "OL") {
                  (currentPart as HTMLOListElement).start = r + 1;
                }
                currentPage.contentEl.appendChild(currentPart);
                currentPart.appendChild(li);
              }
            }
            continue;
          }
        }
      }

      // SUB-CASE 2B: Non-list block (paragraph, heading, code block, table, blockquote)
      // If current page already has content, start a fresh page
      if (currentPage.contentEl.children.length > 0) {
        // If the preceding element was an intro line (e.g. "Include:"), pull it forward
        let pulledIntro: HTMLElement | null = null;
        if (
          currentPage.contentEl.lastElementChild &&
          isIntroOrHeading(currentPage.contentEl.lastElementChild as HTMLElement) &&
          currentPage.contentEl.children.length > 1
        ) {
          pulledIntro = currentPage.contentEl.lastElementChild as HTMLElement;
          currentPage.contentEl.removeChild(pulledIntro);
        }

        currentPage = buildNewPage(pages.length + 1);
        pages.push(currentPage);
        host.appendChild(currentPage.pageEl);

        if (pulledIntro) {
          currentPage.contentEl.appendChild(pulledIntro);
        }

        currentPage.contentEl.appendChild(clone);
        if (getPageContentHeight() <= contentMaxHeight) {
          continue;
        }
      } else {
        // Fresh page fallback
        currentPage.contentEl.appendChild(clone);
      }
    }

    onProgress?.(30);

    // Finalize all pages to exact physical sheet dimensions and pin footers
    const totalPages = pages.length;
    pages.forEach((p, idx) => {
      p.pageEl.style.height = `${cssHeight}px`;
      p.pageEl.style.maxHeight = `${cssHeight}px`;
      p.pageEl.style.overflow = "hidden";
      p.contentEl.style.flex = "1";
      p.contentEl.style.maxHeight = `${contentMaxHeight}px`;
      p.contentEl.style.overflow = "hidden";

      if (p.footerBadgeEl) {
        p.footerBadgeEl.textContent = `Page ${idx + 1} of ${totalPages}`;
      }
    });

    // Initialize jsPDF document
    const pdf = new jsPDF({
      orientation: isLandscape ? "landscape" : "portrait",
      unit: "pt",
      format: isLetter ? "letter" : "a4",
      compress: true,
    });

    // Render each page card into high-DPI canvas & add to PDF
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];

      const canvas = await html2canvas(page.pageEl, {
        scale: 2.5, // 240+ DPI retina crispness
        useCORS: true,
        logging: false,
        backgroundColor: themeConfig.previewBg || "#ffffff",
        width: cssWidth,
        height: cssHeight,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
      });

      // Lossless PNG data eliminates all JPEG blur and noise
      const pageImgData = canvas.toDataURL("image/png");

      if (i > 0) {
        pdf.addPage(
          isLetter ? "letter" : "a4",
          isLandscape ? "landscape" : "portrait"
        );
      }

      pdf.addImage(
        pageImgData,
        "PNG",
        0,
        0,
        pdfWidth,
        pdfHeight,
        undefined,
        "FAST"
      );

      const progress = 30 + Math.round(((i + 1) / pages.length) * 65);
      onProgress?.(progress);
    }

    onProgress?.(98);
    const finalFilename = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
    pdf.save(finalFilename);
    onProgress?.(100);
  } finally {
    // Clean up staging host element
    host.remove();
  }
}

/**
 * Download raw content as a Markdown (.md) file.
 */
export function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".md") ? filename : `${filename}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download styled standalone HTML file.
 */
export function downloadHtml(
  title: string,
  htmlContent: string,
  filename: string
) {
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title || "ChatGPT Document"}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      max-width: 820px;
      margin: 40px auto;
      padding: 0 20px;
      color: #1e293b;
      background: #f8fafc;
    }
    .document-card {
      background: #ffffff;
      padding: 48px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    }
    pre {
      background: #1e1e1e;
      color: #f8fafc;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #e2e8f0;
      padding: 10px 14px;
    }
    th {
      background: #f1f5f9;
      font-weight: 600;
    }
    blockquote {
      border-left: 4px solid #10a37f;
      background: #f0fdf4;
      padding: 8px 16px;
      margin: 16px 0;
    }
    @media print {
      body { background: white; margin: 0; padding: 0; }
      .document-card { box-shadow: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="document-card">
    ${htmlContent}
  </div>
</body>
</html>`;

  const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".html") ? filename : `${filename}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
