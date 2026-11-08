"use client";

import React, { forwardRef, useRef, useEffect, useState } from "react";
import { DocumentData, DocumentSettings, THEME_CONFIGS } from "./types";
import { ChatGptMarkdownRenderer } from "./chatgpt-markdown-renderer";
import { useI18n } from "@/i18n/context";

interface ChatGptPreviewProps {
  data: DocumentData;
  settings: DocumentSettings;
  scale?: number;
  currentPage?: number;
  onTotalPagesCalculated?: (total: number) => void;
}

export const ChatGptPreview = forwardRef<HTMLDivElement, ChatGptPreviewProps>(
  (
    {
      data,
      settings,
      scale = 1,
      currentPage = 1,
      onTotalPagesCalculated,
    },
    ref
  ) => {
    const { t } = useI18n();
    const contentRef = useRef<HTMLDivElement>(null);
    const [measuredPages, setMeasuredPages] = useState(1);
    const themeConfig = THEME_CONFIGS[settings.theme];

    // Margin padding mapping
    const marginClasses = {
      compact: "p-6 sm:p-8",
      normal: "p-8 sm:p-12",
      wide: "p-10 sm:p-16",
    }[settings.margin];

    // Font family mapping
    const fontClass = {
      sans: "font-sans",
      serif: "font-serif",
      mono: "font-mono",
    }[settings.fontFamily];

    // Base font size
    const fontSizeClass = {
      sm: "text-[13.5px]",
      base: "text-[15px]",
      lg: "text-[16.5px]",
    }[settings.fontSize];

    // Line height
    const lineHeightClass = {
      compact: "leading-normal",
      normal: "leading-relaxed",
      relaxed: "leading-loose",
    }[settings.lineHeight];

    // Page dimensions
    const isLandscape = settings.orientation === "landscape";
    const isLetter = settings.pageSize === "letter";

    // Exact printable sheet dimensions in pixels (at 96 DPI)
    const sheetHeight = isLandscape
      ? isLetter
        ? 792
        : 842
      : isLetter
      ? 1056
      : 1123;

    const sheetWidthClasses = isLandscape
      ? isLetter
        ? "max-w-[1056px]"
        : "max-w-[1123px]"
      : isLetter
      ? "max-w-[820px]"
      : "max-w-[820px]";

    // Height reserved for margins (top & bottom) + header accent (6px) + footer (48px)
    const marginVerticalTotal =
      settings.margin === "compact" ? 96 : settings.margin === "wide" ? 144 : 112;
    const contentViewportHeight = Math.max(400, sheetHeight - marginVerticalTotal - 54);

    const [pageOffsets, setPageOffsets] = useState<number[]>([0]);

    // Calculate dynamic total pages and natural block-level break offsets
    useEffect(() => {
      if (!contentRef.current) return;
      const container = contentRef.current;
      const prose = container.querySelector(".prose-chatgpt") || container;
      const children = Array.from(prose.children) as HTMLElement[];

      if (children.length === 0) {
        setPageOffsets([0]);
        setMeasuredPages(1);
        onTotalPagesCalculated?.(1);
        return;
      }

      const offsets: number[] = [0];
      let currentBreak = 0;

      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const childTop = child.offsetTop;
        const childBottom = childTop + child.offsetHeight;

        // If child exceeds current page viewport window, break before this child
        if (childBottom - currentBreak > contentViewportHeight && childTop > currentBreak) {
          currentBreak = childTop;
          offsets.push(currentBreak);
        }
      }

      const total = Math.max(1, offsets.length);
      setPageOffsets(offsets);
      setMeasuredPages(total);
      onTotalPagesCalculated?.(total);
    }, [data.content, settings, contentViewportHeight, onTotalPagesCalculated]);

    // Ensure safe valid page number
    const safeCurrentPage = Math.min(Math.max(1, currentPage), measuredPages);
    const activeShift = pageOffsets[safeCurrentPage - 1] ?? 0;

    return (
      <div
        className="w-full flex justify-center transition-transform duration-200 origin-top"
        style={{
          transform: scale !== 1 ? `scale(${scale})` : undefined,
        }}
      >
        <div
          ref={ref}
          id="chatgpt-printable-document"
          className={`relative w-full ${sheetWidthClasses} bg-white text-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.05)] rounded-xs sm:rounded-sm transition-all duration-150 flex flex-col justify-between ${marginClasses} ${fontClass} ${fontSizeClass} ${lineHeightClass} print:m-0 print:p-0 print:max-w-none print:shadow-none print:w-full print:min-h-0 print:h-auto print:rounded-none`}
          style={{
            backgroundColor: themeConfig.previewBg,
            height: `${sheetHeight}px`,
          }}
        >
          {/* Top subtle decorative color accent bar based on theme */}
          <div
            className="absolute top-0 left-0 right-0 h-1.5 rounded-t print:hidden"
            style={{ backgroundColor: themeConfig.primaryColor }}
          />

          {/* MAIN DOCUMENT BODY - Paginated Viewport Window */}
          <div
            className="chatgpt-page-viewport relative flex-1 overflow-hidden w-full print:overflow-visible print:h-auto"
            style={{
              height: `${contentViewportHeight}px`,
              maxHeight: `${contentViewportHeight}px`,
            }}
          >
            <div
              ref={contentRef}
              className="chatgpt-page-content transition-transform duration-300 ease-out print:transform-none"
              style={{
                transform: `translateY(-${activeShift}px)`,
              }}
            >
              <ChatGptMarkdownRenderer
                content={
                  data.content ||
                  `*${t("chatgptToPdf.emptyHint")}*`
                }
                theme={settings.theme}
              />
            </div>
          </div>

          {/* Footer Section */}
          {settings.showPageNumbers && (
            <footer className="mt-auto pt-3 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between break-inside-avoid print:border-black/20">
              <span className="text-[11px] text-slate-400">
                Generated with ilovedoc.org
              </span>
              <div className="text-[11px] font-mono text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-2.5 py-0.5 rounded font-medium">
                Page {safeCurrentPage} of {measuredPages}
              </div>
            </footer>
          )}
        </div>
      </div>
    );
  }
);

ChatGptPreview.displayName = "ChatGptPreview";
