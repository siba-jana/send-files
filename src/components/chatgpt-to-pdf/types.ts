export type DocumentTheme =
  | "clean"
  | "chatgpt"
  | "modern"
  | "academic"
  | "minimal"
  | "warm";

export type PageSize = "a4" | "letter";
export type Orientation = "portrait" | "landscape";
export type MarginSize = "compact" | "normal" | "wide";
export type BaseFontSize = "sm" | "base" | "lg";
export type DocumentFont = "sans" | "serif" | "mono";
export type LineHeight = "compact" | "normal" | "relaxed";

export interface DocumentSettings {
  theme: DocumentTheme;
  pageSize: PageSize;
  orientation: Orientation;
  margin: MarginSize;
  fontSize: BaseFontSize;
  fontFamily: DocumentFont;
  lineHeight: LineHeight;
  showPageNumbers: boolean;
  fileName?: string;
}

export interface DocumentData {
  content: string;
}

export const THEME_CONFIGS: Record<
  DocumentTheme,
  {
    name: string;
    description: string;
    primaryColor: string;
    accentColor: string;
    badgeBg: string;
    badgeText: string;
    containerClass: string;
    headingClass: string;
    cardBorder: string;
    previewBg: string;
  }
> = {
  clean: {
    name: "Clean Document",
    description: "Crisp purple accents matching ilovedoc.org standard",
    primaryColor: "#7c3aed",
    accentColor: "#6d28d9",
    badgeBg: "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800",
    badgeText: "text-violet-600 dark:text-violet-400",
    containerClass: "theme-clean",
    headingClass: "text-slate-900 border-b border-violet-500/20",
    cardBorder: "border-violet-500/30",
    previewBg: "#ffffff",
  },
  chatgpt: {
    name: "ChatGPT Signature",
    description: "Official emerald accents with clean modern AI look",
    primaryColor: "#10a37f",
    accentColor: "#059669",
    badgeBg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    badgeText: "text-emerald-600 dark:text-emerald-400",
    containerClass: "theme-chatgpt",
    headingClass: "text-slate-900 border-b border-emerald-500/20",
    cardBorder: "border-emerald-500/30",
    previewBg: "#ffffff",
  },
  modern: {
    name: "Modern Indigo",
    description: "Contemporary tech style with deep indigo accents",
    primaryColor: "#4f46e5",
    accentColor: "#6366f1",
    badgeBg: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    badgeText: "text-indigo-600 dark:text-indigo-400",
    containerClass: "theme-modern",
    headingClass: "text-slate-900 border-b border-indigo-500/20",
    cardBorder: "border-indigo-500/30",
    previewBg: "#ffffff",
  },
  academic: {
    name: "Academic Journal",
    description: "Classic serif typography, formal paper style",
    primaryColor: "#1e293b",
    accentColor: "#334155",
    badgeBg: "bg-slate-100 text-slate-800 border-slate-300",
    badgeText: "text-slate-700",
    containerClass: "theme-academic font-serif",
    headingClass: "text-slate-950 border-b border-slate-300 font-serif",
    cardBorder: "border-slate-300",
    previewBg: "#fbfbfa",
  },
  minimal: {
    name: "Pure Monochrome",
    description: "Ink-saving, ultra-clean black & white",
    primaryColor: "#000000",
    accentColor: "#262626",
    badgeBg: "bg-neutral-100 text-neutral-800 border-neutral-300",
    badgeText: "text-neutral-700",
    containerClass: "theme-minimal",
    headingClass: "text-black border-b border-neutral-200",
    cardBorder: "border-neutral-300",
    previewBg: "#ffffff",
  },
  warm: {
    name: "Warm Editorial",
    description: "Warm charcoal & amber accents for guides and essays",
    primaryColor: "#d97706",
    accentColor: "#b45309",
    badgeBg: "bg-amber-50 text-amber-800 border-amber-200",
    badgeText: "text-amber-700",
    containerClass: "theme-warm",
    headingClass: "text-amber-950 border-b border-amber-500/20",
    cardBorder: "border-amber-500/30",
    previewBg: "#fffdfa",
  },
};
