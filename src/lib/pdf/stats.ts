/**
 * Document statistics: word/character/paragraph counts and an estimated
 * page count based on the current page geometry and typography settings.
 */

import { pageGeometry } from "./geometry";
import type { PdfConfig } from "./types";

export interface DocStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  paragraphs: number;
  estimatedPages: number;
  /** Estimated reading time in minutes at ~200 words per minute (0 when empty). */
  readingMinutes: number;
}

export function computeStats(plainText: string, config: PdfConfig): DocStats {
  const text = plainText ?? "";
  const trimmed = text.trim();

  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  const characters = text.length;
  const charactersNoSpaces = text.replace(/\s/g, "").length;
  const paragraphs = trimmed ? trimmed.split(/\n{2,}/).filter((p) => p.trim()).length : 0;

  // Rough page estimate: average glyph width ~0.5 em, line height 1.2 * lineHeight.
  const geom = pageGeometry(config);
  const fontSize = Math.max(4, config.typography.fontSize);
  const lineHeightPt = fontSize * 1.18 * Math.max(0.5, config.typography.lineHeight);
  const charsPerLine = Math.max(8, Math.round(geom.contentWidthPt / (fontSize * 0.5)));
  const linesPerPage = Math.max(3, Math.floor(geom.contentHeightPt / lineHeightPt));
  const estimatedPages = Math.max(
    trimmed ? 1 : 0,
    Math.ceil(characters / (charsPerLine * linesPerPage))
  );

  // Reading time estimate at an average reading speed of 200 words per
  // minute; non-empty documents always report at least one minute.
  const readingMinutes = words > 0 ? Math.max(1, Math.round(words / 200)) : 0;

  return { words, characters, charactersNoSpaces, paragraphs, estimatedPages, readingMinutes };
}
