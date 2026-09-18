"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { FileIcon } from "./file-icon";

export interface FileThumbProps {
  /** Blob or File to preview (Files carry their own name/MIME). */
  blob: Blob;
  name: string;
  mimeType?: string | null;
  className?: string;
}

const MAX_THUMB_BYTES = 32 * 1024 * 1024;

/**
 * Blobs built in memory (receiver results) can carry an empty MIME type, so
 * fall back to the file-name extension when the blob has no type.
 */
const IMAGE_EXTENSIONS =
  /\.(png|jpe?g|gif|webp|bmp|svg|ico|avif|heic|heif|tiff)$/i;

/**
 * Image blobs (≤ 32 MB) get a real thumbnail; everything else falls back to
 * the type-derived icon. The object URL is created in an effect, assigned via
 * ref (no setState-in-effect) and revoked on cleanup.
 */
export function FileThumb({ blob, name, mimeType, className }: FileThumbProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const type = mimeType ?? blob.type;
  const isImage =
    blob.size <= MAX_THUMB_BYTES &&
    (type.startsWith("image/") ||
      (!type && IMAGE_EXTENSIONS.test(name)));

  useEffect(() => {
    if (!isImage) return;
    const url = URL.createObjectURL(blob);
    if (imgRef.current) imgRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [isImage, blob]);

  if (!isImage) {
    return <FileIcon name={name} mimeType={type} className={className} />;
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "group/thumb flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40",
        className,
      )}
    >
      <img
        ref={imgRef}
        alt=""
        loading="lazy"
        decoding="async"
        className="size-full object-cover transition-transform duration-200 group-hover/thumb:scale-110 motion-reduce:transition-none motion-reduce:group-hover/thumb:scale-100"
      />
    </span>
  );
}
