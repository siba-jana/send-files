/**
 * Client state for the converter: editor content (rich HTML / plain text),
 * the PDF configuration, and session draft persistence.
 *
 * The draft is stored in sessionStorage only — it lives for the browser
 * session and is never sent anywhere.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_CONFIG, mergeConfigPatch, type PdfConfig } from "@/lib/pdf/types";
import { htmlToPlainText, plainTextToHtml } from "@/lib/editor/dom";
import { sanitizeEditorHtml } from "@/lib/editor/sanitize";

export type EditorMode = "rich" | "plain";

/** One-click document presets available in the settings panel. */
export type PresetId = "classic" | "compact" | "modern" | "letter";

/** Practical content limit so very large documents cannot freeze the tab. */
export const MAX_CHARS = 300_000;

/** Deeply partial PdfConfig — the patch shape accepted by `mergeConfigPatch`. */
type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
type ConfigPatch = DeepPartial<PdfConfig>;

const SAMPLE_HTML = `
<h1>Meeting Notes — Project Aurora</h1>
<p><b>Date:</b> March 14 &nbsp;·&nbsp; <b>Attendees:</b> Priya, Arjun, Mei, Daniel</p>
<h2>Agenda</h2>
<ol><li>Quarterly review</li><li>Roadmap priorities</li><li>Open questions</li></ol>
<h2>Summary</h2>
<p>The team reviewed <b>quarterly progress</b> and agreed that the <i>Aurora</i> release is on track.
Key risks were discussed, with mitigation owners assigned below.</p>
<ul>
<li><b>Performance:</b> page load improved by 38% since January.</li>
<li><b>Reliability:</b> one incident, resolved in 42 minutes.</li>
<li><b>Hiring:</b> two backend roles open from next month.</li>
</ul>
<blockquote>Decision: freeze scope on April 2 and move QA hardening one week earlier.</blockquote>
<h2>Action items</h2>
<p>Arjun will finalise the migration plan, Mei will publish the updated dashboard,
and Daniel will schedule the customer briefing. Questions can go to
<a href="https://example.com/team">the team workspace</a>.</p>
<p><span style="font-family:monospace">Note:</span> these sample notes are editable — replace them with your own text, or clear the editor to start from scratch.</p>
`;

/** Shape written to sessionStorage by `partialize` (and returned by `migrate`). */
interface PersistedDraft {
  mode: EditorMode;
  html: string;
  plainText: string;
  config: PdfConfig;
}

/**
 * Migrates a persisted draft (version 3 or older) to the current shape: the
 * stored config is deep-merged over the current DEFAULT_CONFIG so fields added
 * after the draft was written (e.g. `pageNumber.startAt`, `tableOfContents`)
 * fall back to their defaults instead of rehydrating as `undefined`. Payloads
 * that are not objects fall back to a fresh draft with the default config.
 */
function migrateDraft(persisted: unknown): PersistedDraft {
  if (typeof persisted !== "object" || persisted === null) {
    return { mode: "rich", html: "", plainText: "", config: DEFAULT_CONFIG };
  }
  const source = persisted as Partial<PersistedDraft>;
  const rawConfig: unknown = source.config;
  const storedConfig: Record<string, unknown> =
    typeof rawConfig === "object" && rawConfig !== null
      ? (rawConfig as Record<string, unknown>)
      : {};
  return {
    mode: source.mode === "plain" ? "plain" : "rich",
    html: typeof source.html === "string" ? source.html : "",
    plainText: typeof source.plainText === "string" ? source.plainText : "",
    config: mergeConfigPatch(DEFAULT_CONFIG, storedConfig),
  };
}

/**
 * One-click document presets. Each patch is deep-merged on top of
 * DEFAULT_CONFIG (keeping the user's metadata, file name, watermark, custom
 * page dimensions and table-of-contents choice) by the `applyPreset` action.
 */
const PRESET_PATCHES: Record<PresetId, ConfigPatch> = {
  /** "Classic report": serif body text with centered page numbers. */
  classic: {
    pageSize: "A4",
    orientation: "portrait",
    marginPreset: "normal",
    typography: {
      fontFamily: "NotoSerif",
      fontSize: 11,
      lineHeight: 1.2,
      paragraphSpacing: 8,
      textColor: "#111827",
    },
    header: { enabled: false },
    footer: { enabled: false },
    pageNumber: {
      enabled: true,
      position: "bottom-center",
      format: "pageOf",
      fontSize: 9,
      color: "#6b7280",
      startAt: 1,
      hideOnFirstPage: false,
    },
  },
  /** "Compact": narrow margins, smaller type, no page furniture. */
  compact: {
    pageSize: "A4",
    orientation: "portrait",
    marginPreset: "narrow",
    typography: {
      fontFamily: "Roboto",
      fontSize: 10,
      lineHeight: 1.1,
      paragraphSpacing: 4,
    },
    header: { enabled: false },
    footer: { enabled: false },
    pageNumber: { enabled: false },
  },
  /** "Modern": airy spacing with page numbers bottom right. */
  modern: {
    pageSize: "A4",
    orientation: "portrait",
    marginPreset: "moderate",
    typography: {
      fontFamily: "Roboto",
      fontSize: 11,
      lineHeight: 1.35,
      paragraphSpacing: 10,
    },
    header: { enabled: false },
    footer: { enabled: false },
    pageNumber: {
      enabled: true,
      position: "bottom-right",
      format: "slash",
    },
  },
  /** "US Letter": Letter paper with centered page numbers. */
  letter: {
    pageSize: "LETTER",
    orientation: "portrait",
    marginPreset: "normal",
    typography: {
      fontFamily: "Roboto",
      fontSize: 11,
      lineHeight: 1.2,
      paragraphSpacing: 8,
    },
    pageNumber: {
      enabled: true,
      position: "bottom-center",
      format: "pageOf",
    },
  },
};

interface ToolState {
  mode: EditorMode;
  html: string;
  plainText: string;
  config: PdfConfig;
  /** Bumped whenever content changes so consumers can react without deep-watching strings. */
  revision: number;

  setMode: (mode: EditorMode) => void;
  setHtml: (html: string) => void;
  setPlainText: (text: string) => void;
  updateConfig: (patch: Record<string, unknown>) => void;
  resetConfig: () => void;
  applyPreset: (id: PresetId) => void;
  clearContent: () => void;
  loadSample: () => void;
  importText: (text: string) => string | null;
  contentText: () => string;
}

export const useToolStore = create<ToolState>()(
  persist(
    (set, get) => ({
      mode: "rich",
      html: SAMPLE_HTML.trim(),
      plainText: htmlToPlainText(SAMPLE_HTML.trim()),
      config: DEFAULT_CONFIG,
      revision: 0,

      setMode: (mode) => {
        const state = get();
        if (mode === state.mode) return;
        if (mode === "plain") {
          set({
            mode,
            plainText: htmlToPlainText(state.html),
            revision: state.revision + 1,
          });
        } else {
          set({
            mode,
            html: state.plainText ? sanitizeEditorHtml(plainTextToHtml(state.plainText)) : "",
            revision: state.revision + 1,
          });
        }
      },

      setHtml: (html) => set({ html, revision: get().revision + 1 }),

      setPlainText: (text) => set({ plainText: text, revision: get().revision + 1 }),

      updateConfig: (patch) => set({ config: mergeConfigPatch(get().config, patch) }),

      resetConfig: () => set({ config: DEFAULT_CONFIG }),

      applyPreset: (id) => {
        const patch = PRESET_PATCHES[id];
        if (!patch) return;
        const current = get().config;
        // Presets are predictable: start from the defaults, carry over the
        // user's content-related settings, then deep-merge the preset patch.
        const preserved = mergeConfigPatch(DEFAULT_CONFIG, {
          metadata: current.metadata,
          filename: current.filename,
          watermark: current.watermark,
          customPageWidth: current.customPageWidth,
          customPageHeight: current.customPageHeight,
          tableOfContents: current.tableOfContents,
        });
        set({ config: mergeConfigPatch(preserved, patch) });
      },

      clearContent: () => set({ html: "", plainText: "", revision: get().revision + 1 }),

      loadSample: () => {
        const html = sanitizeEditorHtml(SAMPLE_HTML.trim());
        set({
          mode: "rich",
          html,
          plainText: htmlToPlainText(html),
          revision: get().revision + 1,
        });
      },

      importText: (text) => {
        const currentLength = get().contentText().length;
        const remaining = MAX_CHARS - currentLength;
        if (remaining <= 0) {
          return "The editor already contains the maximum supported amount of text.";
        }
        let imported = text;
        let warning: string | null = null;
        if (text.length > remaining) {
          imported = text.slice(0, remaining);
          warning = `The file was truncated to stay within the ${MAX_CHARS.toLocaleString()} character limit.`;
        }
        const state = get();
        if (state.mode === "plain") {
          set({ plainText: state.plainText ? state.plainText + "\n\n" + imported : imported, revision: state.revision + 1 });
        } else {
          const addition = sanitizeEditorHtml(plainTextToHtml(imported));
          set({ html: state.html ? state.html + addition : addition, revision: state.revision + 1 });
        }
        return warning;
      },

      contentText: () => {
        const state = get();
        return state.mode === "plain" ? state.plainText : htmlToPlainText(state.html);
      },
    }),
    {
      name: "t2pdf-draft-v1",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? window.sessionStorage
          : ({
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            } as unknown as Storage)
      ),
      version: 3,
      partialize: (state): PersistedDraft => ({
        mode: state.mode,
        html: state.html,
        plainText: state.plainText,
        config: state.config,
      }),
      // Version 1 drafts predate `pageNumber.startAt` / `hideOnFirstPage` and
      // version 2 drafts predate `tableOfContents`; older and unknown payloads
      // are normalised against DEFAULT_CONFIG.
      migrate: (persisted: unknown, _version: number) => migrateDraft(persisted),
    }
  )
);
