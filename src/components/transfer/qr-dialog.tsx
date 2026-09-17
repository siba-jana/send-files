"use client";

import { useEffect, useState } from "react";
import { Download, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface QrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
}

/**
 * QR code for the share link. Loaded lazily (next/dynamic, ssr: false) so the
 * `qrcode` bundle is only fetched when a sender actually opens it.
 */
export default function QrDialog({ open, onOpenChange, url }: QrDialogProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setDataUrl(null);
    setFailed(false);
    (async () => {
      try {
        const QR = (await import("qrcode")).default;
        const data = await QR.toDataURL(url, {
          margin: 2,
          width: 480,
          color: { dark: "#0f172a", light: "#ffffff" },
        });
        if (!cancelled) setDataUrl(data);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, url]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode aria-hidden="true" className="size-5 text-rose-600 dark:text-rose-500" />
            Share with a QR code
          </DialogTitle>
          <DialogDescription>
            Point a phone or another device&apos;s camera at the code to open
            the transfer link.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center">
          {dataUrl ? (
            <img
              src={dataUrl}
              alt="QR code for the transfer link"
              width={480}
              height={480}
              className="w-full max-w-[280px] rounded-2xl border bg-white p-2"
            />
          ) : failed ? (
            <div
              role="alert"
              className="flex size-[280px] items-center justify-center rounded-2xl border p-6 text-center text-sm text-muted-foreground"
            >
              Could not generate the QR code. Use the share link instead.
            </div>
          ) : (
            <div
              aria-hidden="true"
              className="flex size-[280px] items-center justify-center rounded-2xl border bg-muted/40"
            >
              <QrCode className="size-10 animate-pulse text-muted-foreground/50" />
            </div>
          )}
        </div>

        <p className="text-center text-sm font-medium text-muted-foreground">
          Scan to receive files
        </p>

        <DialogFooter className="flex-row items-center justify-center gap-3 sm:justify-center">
          <Button asChild variant="outline" className="h-11 rounded-xl" disabled={!dataUrl}>
            <a href={dataUrl ?? undefined} download="ilovedoc-transfer.png">
              <Download aria-hidden="true" />
              Download QR
            </a>
          </Button>
          <DialogClose asChild>
            <Button variant="ghost" className="h-11 rounded-xl">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
