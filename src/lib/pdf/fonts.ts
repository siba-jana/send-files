/**
 * Font registry and lazy loader for PDF generation.
 *
 * Every font family used by the PDF engine is loaded on demand from /public/fonts
 * (only the families actually present in the document are downloaded), registered
 * into pdfmake's virtual file system and mapped to normal/bold/italic variants.
 */

import type { ScriptId } from "./unicode";

export interface FontFiles {
  normal: string;
  bold: string;
  italics: string;
  bolditalics: string;
}

export interface FontFamilyDef {
  /** pdfmake family identifier. */
  id: string;
  /** Human label used in the UI. */
  label: string;
  /** CSS stack used by the on-screen editor. */
  cssStack: string;
  files: FontFiles;
  /** Scripts this family is used for as an automatic fallback. */
  scripts?: ScriptId[];
}

export const FONT_FAMILIES: Record<string, FontFamilyDef> = {
  Roboto: {
    id: "Roboto",
    label: "Sans",
    cssStack: "Roboto, 'Segoe UI', Arial, sans-serif",
    files: {
      normal: "Roboto-Regular.ttf",
      bold: "Roboto-Medium.ttf",
      italics: "Roboto-Italic.ttf",
      bolditalics: "Roboto-MediumItalic.ttf",
    },
  },
  NotoSerif: {
    id: "NotoSerif",
    label: "Serif",
    cssStack: "'Noto Serif', Georgia, 'Times New Roman', serif",
    files: {
      normal: "NotoSerif-Regular.ttf",
      bold: "NotoSerif-Bold.ttf",
      italics: "NotoSerif-Italic.ttf",
      bolditalics: "NotoSerif-BoldItalic.ttf",
    },
  },
  NotoSansMono: {
    id: "NotoSansMono",
    label: "Monospace",
    cssStack: "'Noto Sans Mono', 'Courier New', monospace",
    files: {
      normal: "NotoSansMono-Regular.ttf",
      bold: "NotoSansMono-Bold.ttf",
      // Noto Sans Mono has no true italics; fall back to the upright cuts.
      italics: "NotoSansMono-Regular.ttf",
      bolditalics: "NotoSansMono-Bold.ttf",
    },
  },
  NotoSansDevanagari: {
    id: "NotoSansDevanagari",
    label: "Devanagari",
    cssStack: "'Noto Sans Devanagari', sans-serif",
    scripts: ["devanagari"],
    files: {
      normal: "NotoSansDevanagari-Regular.ttf",
      bold: "NotoSansDevanagari-Bold.ttf",
      italics: "NotoSansDevanagari-Regular.ttf",
      bolditalics: "NotoSansDevanagari-Bold.ttf",
    },
  },
  NotoSansBengali: {
    id: "NotoSansBengali",
    label: "Bengali",
    cssStack: "'Noto Sans Bengali', sans-serif",
    scripts: ["bengali"],
    files: {
      normal: "NotoSansBengali-Regular.ttf",
      bold: "NotoSansBengali-Bold.ttf",
      italics: "NotoSansBengali-Regular.ttf",
      bolditalics: "NotoSansBengali-Bold.ttf",
    },
  },
  NotoSansGujarati: {
    id: "NotoSansGujarati",
    label: "Gujarati",
    cssStack: "'Noto Sans Gujarati', sans-serif",
    scripts: ["gujarati"],
    files: {
      normal: "NotoSansGujarati-Regular.ttf",
      bold: "NotoSansGujarati-Bold.ttf",
      italics: "NotoSansGujarati-Regular.ttf",
      bolditalics: "NotoSansGujarati-Bold.ttf",
    },
  },
  NotoSansGurmukhi: {
    id: "NotoSansGurmukhi",
    label: "Gurmukhi",
    cssStack: "'Noto Sans Gurmukhi', sans-serif",
    scripts: ["gurmukhi"],
    files: {
      normal: "NotoSansGurmukhi-Regular.ttf",
      bold: "NotoSansGurmukhi-Bold.ttf",
      italics: "NotoSansGurmukhi-Regular.ttf",
      bolditalics: "NotoSansGurmukhi-Bold.ttf",
    },
  },
  NotoSansOriya: {
    id: "NotoSansOriya",
    label: "Odia",
    cssStack: "'Noto Sans Oriya', sans-serif",
    scripts: ["oriya"],
    files: {
      normal: "NotoSansOriya-Regular.ttf",
      bold: "NotoSansOriya-Bold.ttf",
      italics: "NotoSansOriya-Regular.ttf",
      bolditalics: "NotoSansOriya-Bold.ttf",
    },
  },
  NotoSansTamil: {
    id: "NotoSansTamil",
    label: "Tamil",
    cssStack: "'Noto Sans Tamil', sans-serif",
    scripts: ["tamil"],
    files: {
      normal: "NotoSansTamil-Regular.ttf",
      bold: "NotoSansTamil-Bold.ttf",
      italics: "NotoSansTamil-Regular.ttf",
      bolditalics: "NotoSansTamil-Bold.ttf",
    },
  },
  NotoSansTelugu: {
    id: "NotoSansTelugu",
    label: "Telugu",
    cssStack: "'Noto Sans Telugu', sans-serif",
    scripts: ["telugu"],
    files: {
      normal: "NotoSansTelugu-Regular.ttf",
      bold: "NotoSansTelugu-Bold.ttf",
      italics: "NotoSansTelugu-Regular.ttf",
      bolditalics: "NotoSansTelugu-Bold.ttf",
    },
  },
  NotoSansKannada: {
    id: "NotoSansKannada",
    label: "Kannada",
    cssStack: "'Noto Sans Kannada', sans-serif",
    scripts: ["kannada"],
    files: {
      normal: "NotoSansKannada-Regular.ttf",
      bold: "NotoSansKannada-Bold.ttf",
      italics: "NotoSansKannada-Regular.ttf",
      bolditalics: "NotoSansKannada-Bold.ttf",
    },
  },
  NotoSansMalayalam: {
    id: "NotoSansMalayalam",
    label: "Malayalam",
    cssStack: "'Noto Sans Malayalam', sans-serif",
    scripts: ["malayalam"],
    files: {
      normal: "NotoSansMalayalam-Regular.ttf",
      bold: "NotoSansMalayalam-Bold.ttf",
      italics: "NotoSansMalayalam-Regular.ttf",
      bolditalics: "NotoSansMalayalam-Bold.ttf",
    },
  },
  NotoSansThai: {
    id: "NotoSansThai",
    label: "Thai",
    cssStack: "'Noto Sans Thai', sans-serif",
    scripts: ["thai"],
    files: {
      normal: "NotoSansThai-Regular.ttf",
      bold: "NotoSansThai-Bold.ttf",
      italics: "NotoSansThai-Regular.ttf",
      bolditalics: "NotoSansThai-Bold.ttf",
    },
  },
  NotoNaskhArabic: {
    id: "NotoNaskhArabic",
    label: "Arabic",
    cssStack: "'Noto Naskh Arabic', sans-serif",
    scripts: ["arabic"],
    files: {
      normal: "NotoNaskhArabic-Regular.ttf",
      bold: "NotoNaskhArabic-Bold.ttf",
      italics: "NotoNaskhArabic-Regular.ttf",
      bolditalics: "NotoNaskhArabic-Bold.ttf",
    },
  },
  NotoEmoji: {
    id: "NotoEmoji",
    label: "Emoji",
    cssStack: "'Noto Emoji', sans-serif",
    scripts: ["emoji"],
    files: {
      normal: "NotoEmoji-Regular.ttf",
      bold: "NotoEmoji-Regular.ttf",
      italics: "NotoEmoji-Regular.ttf",
      bolditalics: "NotoEmoji-Regular.ttf",
    },
  },
};

/** Maps a detected script to the family that renders it. */
export const SCRIPT_FONT: Record<ScriptId, string> = {
  devanagari: "NotoSansDevanagari",
  bengali: "NotoSansBengali",
  gujarati: "NotoSansGujarati",
  gurmukhi: "NotoSansGurmukhi",
  oriya: "NotoSansOriya",
  tamil: "NotoSansTamil",
  telugu: "NotoSansTelugu",
  kannada: "NotoSansKannada",
  malayalam: "NotoSansMalayalam",
  thai: "NotoSansThai",
  arabic: "NotoNaskhArabic",
  emoji: "NotoEmoji",
};

/** Base families offered in the typography settings (label order matters). */
export const BASE_FONT_IDS = ["Roboto", "NotoSerif", "NotoSansMono"] as const;

let fontBaseUrl = "/fonts/";
let pdfMakeInstance: any = null;
const loadedFamilies = new Set<string>();
const pendingFamilies = new Map<string, Promise<void>>();
const rawFontCache = new Map<string, Uint8Array>();

/** Overrides where font files are fetched from (used by tooling/tests). */
export function setFontBaseUrl(url: string): void {
  fontBaseUrl = url;
}

async function fetchFontBytes(file: string): Promise<Uint8Array> {
  const cached = rawFontCache.get(file);
  if (cached) return cached;
  const res = await fetch(`${fontBaseUrl}${encodeURIComponent(file)}`);
  if (!res.ok) {
    throw new Error(`Unable to load font file "${file}" (HTTP ${res.status}).`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  rawFontCache.set(file, bytes);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Returns the pdfmake singleton. In the browser this resolves to the browser
 * build (via the package "browser" field); under Node/Bun it resolves to the
 * server build. Both expose createPdf()/fonts handling the same way.
 */
export async function getPdfMake(): Promise<any> {
  if (pdfMakeInstance) return pdfMakeInstance;
  const mod: any = await import("pdfmake");
  pdfMakeInstance = mod.default ?? mod;

  // Restrict external resource loading: the browser build may only fetch
  // same-origin URLs; fonts are served through the in-memory VFS anyway.
  const isNode = typeof window === "undefined";
  if (typeof pdfMakeInstance.setUrlAccessPolicy === "function") {
    pdfMakeInstance.setUrlAccessPolicy(
      isNode ? () => true : (url: string) => url.startsWith(window.location.origin)
    );
  }
  if (isNode && typeof pdfMakeInstance.setLocalAccessPolicy === "function") {
    pdfMakeInstance.setLocalAccessPolicy(() => true);
  }
  return pdfMakeInstance;
}

/** Registers font files into pdfmake's virtual file system (browser and node builds). */
function registerVfs(pdfMake: any, vfs: Record<string, string>): void {
  if (typeof pdfMake.addVirtualFileSystem === "function") {
    // Browser build
    pdfMake.addVirtualFileSystem(vfs);
    return;
  }
  if (pdfMake.sharedVirtualfs?.writeFileSync) {
    // Node/server build
    for (const [file, base64] of Object.entries(vfs)) {
      pdfMake.sharedVirtualfs.writeFileSync(file, base64, "base64");
    }
    return;
  }
  pdfMake.vfs = { ...(pdfMake.vfs ?? {}), ...vfs };
}

/**
 * Makes sure the given font family ids are registered with pdfmake,
 * downloading the required TTF files at most once.
 */
export async function ensureFontFamilies(families: Iterable<string>): Promise<void> {
  const pdfMake = await getPdfMake();
  for (const familyId of families) {
    const def = FONT_FAMILIES[familyId];
    if (!def || loadedFamilies.has(familyId)) continue;

    let pending = pendingFamilies.get(familyId);
    if (!pending) {
      pending = (async () => {
        const uniqueFiles = Array.from(
          new Set([def.files.normal, def.files.bold, def.files.italics, def.files.bolditalics])
        );
        const vfs: Record<string, string> = {};
        for (const file of uniqueFiles) {
          vfs[file] = bytesToBase64(await fetchFontBytes(file));
        }
        registerVfs(pdfMake, vfs);
        if (typeof pdfMake.addFonts === "function") {
          pdfMake.addFonts({ [familyId]: def.files });
        } else {
          pdfMake.fonts = { ...(pdfMake.fonts ?? {}), [familyId]: def.files };
        }
      })().finally(() => {
        pendingFamilies.delete(familyId);
      });
      pendingFamilies.set(familyId, pending);
    }
    await pending;
    loadedFamilies.add(familyId);
  }
}

/** Raw TTF bytes for a font file (used when embedding fonts with pdf-lib). */
export async function getFontFileBytes(file: string): Promise<Uint8Array> {
  return fetchFontBytes(file);
}

/** Family that renders a given script, or the fallback base family. */
export function familyForScript(script: ScriptId): string {
  return SCRIPT_FONT[script];
}
