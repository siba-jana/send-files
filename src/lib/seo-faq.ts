export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * Single source of truth for the FAQ content.
 * Used by the FAQ accordion UI and the FAQPage JSON-LD so they can never diverge.
 */
export const faqItems: FaqItem[] = [
  {
    question: "How can I convert text to PDF online?",
    answer:
      "Type or paste your text into the editor, adjust any formatting or page settings you need, watch the live preview, then click Download PDF. The whole process takes less than a minute and requires no installation or registration.",
  },
  {
    question: "Is this Text to PDF Converter free?",
    answer:
      "Yes. The converter is completely free with no usage limits, accounts, or hidden charges. You can create as many PDF documents as you like.",
  },
  {
    question: "Can I customize the font and text size?",
    answer:
      "Yes. Choose between sans, serif, and monospace font families, set the base font size from 6 to 36 pt, pick text colors and highlights, and adjust line spacing, paragraph spacing, letter spacing, and first-line indentation.",
  },
  {
    question: "Can I convert a large text document into PDF?",
    answer:
      "Yes. The editor comfortably handles long documents and paginates them automatically. For performance reasons there is a practical limit of 300,000 characters, which is roughly a 150-page document.",
  },
  {
    question: "Can I change the PDF page size and orientation?",
    answer:
      "Yes. Select A4, A3, A5, Letter, Legal, or Tabloid sizes, define fully custom dimensions in millimetres, and switch between portrait and landscape orientation at any time.",
  },
  {
    question: "Can I add page numbers to my PDF?",
    answer:
      'Yes. Enable page numbers and choose a position (top or bottom, left, center, or right) and a format such as "Page 1", "Page 1 of 10", or "1 / 10".',
  },
  {
    question: "Can I add headers, footers, and watermarks?",
    answer:
      "Yes. Configure custom header and footer text with alignment, font size, color, and an optional border line, and add text watermarks such as DRAFT or CONFIDENTIAL with adjustable size, color, opacity, rotation angle, and position.",
  },
  {
    question: "Can I convert TXT files into PDF?",
    answer:
      "Yes. Use the Import TXT button in the editor toolbar to open a plain text file. Its contents are loaded into the editor, where you can format them before converting to PDF. You can also simply copy and paste text from any application.",
  },
  {
    question: "Does the converter preserve paragraph formatting?",
    answer:
      "Yes. Paragraph breaks, line breaks, bold, italic, underline, strikethrough, colors, highlights, lists, headings, links, and text alignment are all carried over into the generated PDF.",
  },
  {
    question: "Is my text uploaded to a server?",
    answer:
      "No. The entire conversion happens locally in your browser. Your text is never uploaded, stored, or logged anywhere. The only downloads are static font files that the converter fetches from this website when your document uses non-Latin scripts such as Devanagari or Arabic.",
  },
  {
    question: "Can I create a multi-page PDF document?",
    answer:
      "Yes. Long text is automatically split across pages with correct margins on every page, and you can also insert manual page breaks wherever you need them.",
  },
  {
    question: "Does the generated PDF contain selectable text?",
    answer:
      "Yes. The PDF contains real, selectable, and searchable text with embedded fonts — not a screenshot or image of your document.",
  },
];
