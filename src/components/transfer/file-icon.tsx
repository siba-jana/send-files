import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Presentation,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

type FileKind =
  | "document"
  | "image"
  | "video"
  | "audio"
  | "archive"
  | "code"
  | "spreadsheet"
  | "presentation"
  | "other";

const KIND_META: Record<FileKind, { Icon: LucideIcon; className: string }> = {
  document: {
    Icon: FileText,
    className: "text-rose-600 dark:text-rose-400",
  },
  image: {
    Icon: FileImage,
    className: "text-emerald-600 dark:text-emerald-400",
  },
  video: {
    Icon: FileVideo,
    className: "text-orange-600 dark:text-orange-400",
  },
  audio: {
    Icon: FileAudio,
    className: "text-pink-600 dark:text-pink-400",
  },
  archive: {
    Icon: FileArchive,
    className: "text-amber-600 dark:text-amber-400",
  },
  code: {
    Icon: FileCode,
    className: "text-teal-600 dark:text-teal-400",
  },
  spreadsheet: {
    Icon: FileSpreadsheet,
    className: "text-green-700 dark:text-green-400",
  },
  presentation: {
    Icon: Presentation,
    className: "text-orange-700 dark:text-orange-400",
  },
  other: {
    Icon: File,
    className: "text-muted-foreground",
  },
};

const EXTENSIONS: Record<string, FileKind> = {
  // documents
  pdf: "document",
  doc: "document",
  docx: "document",
  txt: "document",
  rtf: "document",
  odt: "document",
  pages: "document",
  md: "document",
  markdown: "document",
  epub: "document",
  // images
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  svg: "image",
  bmp: "image",
  ico: "image",
  heic: "image",
  heif: "image",
  avif: "image",
  tiff: "image",
  // video
  mp4: "video",
  mov: "video",
  avi: "video",
  mkv: "video",
  webm: "video",
  flv: "video",
  wmv: "video",
  m4v: "video",
  // audio
  mp3: "audio",
  wav: "audio",
  flac: "audio",
  aac: "audio",
  ogg: "audio",
  m4a: "audio",
  wma: "audio",
  opus: "audio",
  // archives
  zip: "archive",
  rar: "archive",
  "7z": "archive",
  tar: "archive",
  gz: "archive",
  bz2: "archive",
  xz: "archive",
  tgz: "archive",
  // code
  js: "code",
  jsx: "code",
  ts: "code",
  tsx: "code",
  py: "code",
  rb: "code",
  go: "code",
  rs: "code",
  java: "code",
  c: "code",
  h: "code",
  cpp: "code",
  hpp: "code",
  cs: "code",
  php: "code",
  swift: "code",
  kt: "code",
  html: "code",
  css: "code",
  scss: "code",
  json: "code",
  xml: "code",
  yaml: "code",
  yml: "code",
  toml: "code",
  ini: "code",
  sh: "code",
  bash: "code",
  sql: "code",
  vue: "code",
  svelte: "code",
  // spreadsheets
  xls: "spreadsheet",
  xlsx: "spreadsheet",
  ods: "spreadsheet",
  csv: "spreadsheet",
  tsv: "spreadsheet",
  // presentations
  ppt: "presentation",
  pptx: "presentation",
  odp: "presentation",
  key: "presentation",
};

/** Derive a coarse file kind from a file name + optional MIME type. */
function classifyFile(name: string, mimeType?: string | null): FileKind {
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  const byExt = ext ? EXTENSIONS[ext] : undefined;
  if (byExt) return byExt;

  if (mimeType) {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType.startsWith("text/")) return "document";
    if (
      mimeType === "application/pdf" ||
      mimeType === "application/zip" ||
      mimeType === "application/x-7z-compressed" ||
      mimeType === "application/x-tar" ||
      mimeType === "application/gzip"
    ) {
      return mimeType === "application/pdf" ? "document" : "archive";
    }
  }
  return "other";
}

export interface FileIconProps {
  name: string;
  mimeType?: string | null;
  className?: string;
}

/**
 * Type-derived lucide file icon with a tasteful muted color.
 * Decorative — pair with a visible file name for screen readers.
 */
export function FileIcon({ name, mimeType, className }: FileIconProps) {
  const { Icon, className: colorClass } = KIND_META[classifyFile(name, mimeType)];
  return (
    <Icon
      aria-hidden="true"
      className={cn("size-5 shrink-0", colorClass, className)}
    />
  );
}
