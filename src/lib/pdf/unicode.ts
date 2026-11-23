/**
 * Unicode script detection and text segmentation.
 *
 * The default document fonts only cover Latin/Cyrillic/Greek/Greek-Hebrew ranges,
 * so text runs are segmented by script and rendered with a matching Noto font
 * (lazy-loaded from /fonts) whenever necessary.
 */

export type ScriptId =
  | "devanagari"
  | "bengali"
  | "gujarati"
  | "gurmukhi"
  | "oriya"
  | "tamil"
  | "telugu"
  | "kannada"
  | "malayalam"
  | "thai"
  | "arabic"
  | "emoji";

interface Range {
  script: ScriptId;
  from: number;
  to: number;
}

const RANGES: Range[] = [
  { script: "devanagari", from: 0x0900, to: 0x097f },
  { script: "bengali", from: 0x0980, to: 0x09ff },
  { script: "gurmukhi", from: 0x0a00, to: 0x0a7f },
  { script: "gujarati", from: 0x0a80, to: 0x0aff },
  { script: "oriya", from: 0x0b00, to: 0x0b7f },
  { script: "tamil", from: 0x0b80, to: 0x0bff },
  { script: "telugu", from: 0x0c00, to: 0x0c7f },
  { script: "kannada", from: 0x0c80, to: 0x0cff },
  { script: "malayalam", from: 0x0d00, to: 0x0d7f },
  { script: "thai", from: 0x0e00, to: 0x0e7f },
  { script: "arabic", from: 0x0600, to: 0x06ff },
  { script: "arabic", from: 0x0750, to: 0x077f },
  { script: "arabic", from: 0x08a0, to: 0x08ff },
  { script: "arabic", from: 0xfb50, to: 0xfdff },
  { script: "arabic", from: 0xfe70, to: 0xfeff },
  { script: "emoji", from: 0x1f000, to: 0x1faff },
  { script: "emoji", from: 0x2600, to: 0x26ff },
  { script: "emoji", from: 0x2700, to: 0x27bf },
  { script: "emoji", from: 0x2b00, to: 0x2bff },
];

/** Invisible characters that are safe to drop before rendering to PDF. */
const INVISIBLE_RE = /[\u200b\u200c\u200d\uFE0F\uFEFF]/g;

export function stripInvisible(text: string): string {
  return text.replace(INVISIBLE_RE, "");
}

/** Returns the script of a code point, or null when the base font should handle it. */
export function charScript(code: number): ScriptId | null {
  for (const r of RANGES) {
    if (code >= r.from && code <= r.to) return r.script;
  }
  return null;
}

/** Detects all non-Latin scripts used anywhere in the text. */
export function detectScripts(text: string): Set<ScriptId> {
  const found = new Set<ScriptId>();
  for (let i = 0; i < text.length; i++) {
    const s = charScript(text.codePointAt(i) ?? 0);
    if (s) found.add(s);
  }
  return found;
}

export interface ScriptSegment {
  text: string;
  script: ScriptId | null;
}

/**
 * Splits a string into maximal runs of characters that belong to the same script
 * (null = default/base font). Whitespace and punctuation stay with the
 * surrounding segment so words do not break unnecessarily.
 */
export function segmentByScript(text: string): ScriptSegment[] {
  const segments: ScriptSegment[] = [];
  let current: ScriptSegment | null = null;

  const flush = () => {
    if (current && current.text) segments.push(current);
    current = null;
  };

  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    const isNeutral =
      ch === " " ||
      ch === "\n" ||
      ch === "\t" ||
      (code < 0x2b0 && charScript(code) === null); // ASCII + Latin-1 punctuation etc.
    const script = charScript(code);

    if (isNeutral && !script) {
      // Neutral characters attach to the current segment if there is one.
      if (current) {
        current.text += ch;
      } else {
        current = { text: ch, script: null };
      }
      continue;
    }

    if (current && current.script === script) {
      current.text += ch;
    } else {
      flush();
      current = { text: ch, script };
    }
  }
  flush();
  return segments;
}
