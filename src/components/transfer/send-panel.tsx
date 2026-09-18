"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
  type ChangeEvent,
} from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import {
  CircleCheckBig,
  CircleX,
  Clock,
  CloudUpload,
  Copy,
  FolderUp,
  Gauge,
  History,
  Hourglass,
  Link2,
  LoaderCircle,
  Lock,
  Mail,
  MessageCircle,
  MonitorSmartphone,
  QrCode,
  RotateCcw,
  Send,
  Settings2,
  Share2,
  ShieldCheck,
  Timer,
  TriangleAlert,
  Upload,
  WifiOff,
  X,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useSendTransfer } from "@/hooks/use-send";
import { formatBytes, formatSpeed } from "@/lib/transfer/stats";
import {
  addRecentTransfer,
  clearRecentTransfers,
  formatRelativeTime,
  useRecentTransfers,
  type RecentTransferStatus,
} from "@/lib/transfer/recent";
import { ConnectionSteps, ProgressPanel } from "./progress-panel";
import { FileThumb } from "./file-thumb";
import { KbdHint } from "./kbd-hint";
import { scrollToTransfer } from "./scroll-utils";
import { SessionLog } from "./session-log";
import { formatDuration } from "./format-utils";

const QrDialog = dynamic(() => import("./qr-dialog"), { ssr: false });

/** Small colored status dot for recent-transfer rows. */
function RecentStatusIcon({ status }: { status: RecentTransferStatus }) {
  const className = "size-2 shrink-0 rounded-full";
  switch (status) {
    case "completed":
      return <span aria-hidden="true" className={cn(className, "bg-emerald-500")} />;
    case "failed":
      return <span aria-hidden="true" className={cn(className, "bg-destructive")} />;
    case "expired":
      return <span aria-hidden="true" className={cn(className, "bg-amber-500")} />;
    default:
      return <span aria-hidden="true" className={cn(className, "bg-muted-foreground/50")} />;
  }
}

const EXPIRY_OPTIONS = [
  { value: "1", label: "1 hour" },
  { value: "6", label: "6 hours" },
  { value: "24", label: "24 hours" },
  { value: "72", label: "3 days" },
  { value: "168", label: "7 days" },
] as const;

const LARGE_TRANSFER_BYTES = 8 * 1024 * 1024 * 1024; // 8 GB

/** "482917" → "482 917" */
function formatCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

async function copyText(text: string, successMessage: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      throw new Error("Clipboard API unavailable");
    }
    toast.success(successMessage);
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
      toast.success(successMessage);
    } catch {
      toast.error("Couldn't copy — please copy it manually.");
    }
  }
}

const emptySubscribe = () => () => {};

/** false during SSR + hydration, true afterwards (no effect setState). */
function useIsHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

let folderPickerCache: boolean | null = null;
function getFolderPickerSnapshot(): boolean {
  if (folderPickerCache === null) {
    folderPickerCache =
      "webkitdirectory" in document.createElement("input");
  }
  return folderPickerCache;
}

let webShareCache: boolean | null = null;
function getWebShareSnapshot(): boolean {
  if (webShareCache === null) {
    webShareCache = typeof navigator !== "undefined" && "share" in navigator;
  }
  return webShareCache;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Expired";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours} h ${minutes.toString().padStart(2, "0")} min`;
  if (minutes > 0) return `${minutes} min ${seconds.toString().padStart(2, "0")} s`;
  return `${seconds} s`;
}

/** Live "Expires in 23 h 59 min" label. Starts null to avoid SSR mismatch. */
function useCountdown(expiresAt: string | null | undefined): string | null {
  const [snapshot, setSnapshot] = useState<{
    expiresAt: string;
    label: string;
  } | null>(null);

  useEffect(() => {
    if (!expiresAt) return;
    const target = new Date(expiresAt).getTime();
    const tick = () => {
      setSnapshot({ expiresAt, label: formatRemaining(target - Date.now()) });
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  return snapshot && snapshot.expiresAt === expiresAt
    ? snapshot.label
    : null;
}

/** Image files (≤ 32 MB) get a real thumbnail; everything else the type icon. */
function SendFileThumb({ file }: { file: File }) {
  return <FileThumb blob={file} name={file.name} mimeType={file.type} />;
}

interface ShareTarget {
  key: string;
  label: string;
  icon: typeof Mail;
  href: string;
}

/** Build messenger/email share links for the waiting card. */
function buildShareTargets(
  link: string,
  summary: string,
): ShareTarget[] {
  const text = `${summary} — ${link}`;
  return [
    {
      key: "email",
      label: "Share via email",
      icon: Mail,
      href: `mailto:?subject=${encodeURIComponent("Files for you — I Love Doc")}&body=${encodeURIComponent(text)}`,
    },
    {
      key: "telegram",
      label: "Share on Telegram",
      icon: Send,
      href: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(summary)}`,
    },
    {
      key: "whatsapp",
      label: "Share on WhatsApp",
      icon: MessageCircle,
      href: `https://wa.me/?text=${encodeURIComponent(text)}`,
    },
  ];
}

export function SendPanel() {
  const {
    supported,
    files,
    totalBytes,
    options,
    phase,
    info,
    progress,
    error,
    shareLink,
    addFiles,
    removeFile,
    clearFiles,
    setOption,
    create,
    cancel,
    reset,
  } = useSendTransfer();

  // Capability probes are read post-hydration (useSyncExternalStore) so the
  // server-rendered HTML and the first client render stay identical.
  const hydrated = useIsHydrated();
  const folderPickerSupported = useSyncExternalStore(
    emptySubscribe,
    getFolderPickerSnapshot,
    () => false,
  );
  const webShareSupported = useSyncExternalStore(
    emptySubscribe,
    getWebShareSnapshot,
    () => false,
  );
  const unsupported = hydrated && !supported;

  const [dragOver, setDragOver] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  const countdown = useCountdown(phase === "waiting" ? info?.expiresAt : null);

  // Recent transfer history: record each transfer exactly once when it
  // reaches a terminal phase (localStorage + store notify — no setState here).
  const recent = useRecentTransfers();
  const recordedTokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      phase !== "completed" &&
      phase !== "cancelled" &&
      phase !== "failed" &&
      phase !== "expired"
    ) {
      return;
    }
    if (!info || recordedTokenRef.current === info.token) return;
    recordedTokenRef.current = info.token;
    addRecentTransfer({
      code: info.code,
      fileCount: files.length,
      totalBytes,
      createdAt: Date.now(),
      status: phase as RecentTransferStatus,
    });
  }, [phase, info, files.length, totalBytes]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  // Keyboard shortcuts on the waiting card: C = copy code, L = copy link.
  // Plain keys only — browser/system combos (Ctrl/Cmd/Alt) are left alone,
  // and typing in a field never triggers a copy.
  useEffect(() => {
    if (phase !== "waiting") return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "c" && info) {
        e.preventDefault();
        void copyText(info.code, "Code copied (C)");
      } else if (key === "l" && shareLink) {
        e.preventDefault();
        void copyText(shareLink, "Link copied (L)");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, info, shareLink]);
  const attachFolderInput = useCallback((el: HTMLInputElement | null) => {
    folderInputRef.current = el;
    if (el) {
      el.setAttribute("webkitdirectory", "");
      el.setAttribute("directory", "");
    }
  }, []);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (selected && selected.length > 0) addFiles(selected);
    e.target.value = ""; // allow re-picking the same file
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer?.files ?? []);
    if (dropped.length > 0) addFiles(dropped);
  };

  // ------------------------------------------------------------- unsupported

  if (unsupported) {
    return (
      <Card className="rounded-2xl border-destructive/40">
        <CardContent className="p-6">
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>Browser not supported</AlertTitle>
            <AlertDescription>
              Your browser does not support direct browser-to-browser
              transfers. Try the latest Chrome, Edge, Firefox or Safari.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // ------------------------------------------------------------- live phases

  if (phase === "waiting") {
    return (
      <>
        {qrOpen && shareLink && (
          <QrDialog open={qrOpen} onOpenChange={setQrOpen} url={shareLink} />
        )}
        <Card className="rounded-2xl fade-slide-in">
          <CardContent className="flex flex-col items-center p-6 text-center sm:p-8">
            <p className="inline-flex items-center gap-2.5 text-sm font-medium text-muted-foreground">
              <span aria-hidden="true" className="relative flex size-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60" />
                <span className="relative inline-flex size-2.5 rounded-full bg-rose-600 dark:bg-rose-500" />
              </span>
              Waiting for recipient
            </p>

            <p className="mt-7 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Transfer code
            </p>
            <div className="relative mt-2">
              <span
                aria-hidden="true"
                className="code-glow pointer-events-none absolute inset-x-8 top-1/2 -z-10 h-16 -translate-y-1/2 rounded-full bg-rose-400/20 blur-2xl dark:bg-rose-500/25"
              />
              <p
                className="select-text text-5xl font-bold tracking-widest tabular-nums sm:text-6xl"
                aria-label={`Transfer code ${formatCode(info?.code ?? "")}`}
              >
                {formatCode(info?.code ?? "")}
              </p>
            </div>

            <div className="mt-8 w-full space-y-2 text-left">
              <Label
                htmlFor="share-link"
                className="text-xs font-medium text-muted-foreground"
              >
                Share link
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="share-link"
                  readOnly
                  value={shareLink ?? ""}
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-11 rounded-xl font-mono text-xs sm:text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11 shrink-0 rounded-xl"
                  aria-label="Copy share link"
                  onClick={() =>
                    shareLink && void copyText(shareLink, "Link copied")
                  }
                >
                  <Copy aria-hidden="true" />
                </Button>
              </div>
            </div>

            <div className="mt-5 grid w-full grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Button
                type="button"
                className="col-span-2 h-11 rounded-xl bg-rose-600 text-white shadow-lg shadow-rose-600/25 hover:bg-rose-700 dark:bg-rose-500 dark:shadow-rose-500/20 dark:hover:bg-rose-600 sm:col-span-1"
                onClick={() =>
                  shareLink && void copyText(shareLink, "Link copied")
                }
                title="Shortcut: L"
              >
                <Link2 aria-hidden="true" />
                Copy Link
                <KbdHint onPrimary>l</KbdHint>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl"
                onClick={() =>
                  info && void copyText(info.code, "Code copied")
                }
                title="Shortcut: C"
              >
                Copy Code
                <KbdHint>c</KbdHint>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl"
                onClick={() => setQrOpen(true)}
              >
                <QrCode aria-hidden="true" />
                Show QR
              </Button>
            </div>

            {/* Share straight to a chat or inbox — opens in a new tab. */}
            {shareLink && (
              <div className="mt-3 flex w-full items-center justify-center gap-2">
                {buildShareTargets(
                  shareLink,
                  `${files.length} file${files.length === 1 ? "" : "s"} (${formatBytes(totalBytes)}) waiting for you`,
                ).map((target) => (
                  <a
                    key={target.key}
                    href={target.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={target.label}
                    title={target.label}
                    className="inline-flex size-9 items-center justify-center rounded-full border text-muted-foreground transition-all outline-none hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 focus-visible:ring-2 focus-visible:ring-rose-500/60 dark:hover:border-rose-500/50 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                  >
                    <target.icon aria-hidden="true" className="size-4" />
                  </a>
                ))}
                {webShareSupported ? (
                  <button
                    type="button"
                    aria-label="More sharing options"
                    title="More sharing options"
                    onClick={() => {
                      void navigator
                        .share({
                          title: "Files for you — I Love Doc",
                          text: `${files.length} file${files.length === 1 ? "" : "s"} (${formatBytes(totalBytes)}) waiting for you`,
                          url: shareLink,
                        })
                        .catch(() => {
                          /* user dismissed the sheet — nothing to do */
                        });
                    }}
                    className="inline-flex size-9 items-center justify-center rounded-full border text-muted-foreground transition-all outline-none hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 focus-visible:ring-2 focus-visible:ring-rose-500/60 dark:hover:border-rose-500/50 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                  >
                    <Share2 aria-hidden="true" className="size-4" />
                  </button>
                ) : null}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              className="mt-2.5 h-11 w-full rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => void cancel("Cancelled by sender")}
            >
              <CircleX aria-hidden="true" />
              Cancel Transfer
            </Button>

            <p className="mt-6 inline-flex items-start gap-2 text-sm text-muted-foreground">
              <MonitorSmartphone
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              Keep this tab open — files transfer directly from your browser.
            </p>
            <p className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock aria-hidden="true" className="size-3.5" />
              {countdown ? `Expires in ${countdown}` : "Expires soon"}
            </p>

            {/* Live event timeline for this session (sender view). */}
            {info && (
              <div className="mt-5 w-full text-left">
                <SessionLog
                  token={info.token}
                  authToken={info.senderToken}
                  role="sender"
                  live
                />
              </div>
            )}
          </CardContent>
        </Card>
      </>
    );
  }

  if (phase === "connecting") {
    return (
      <Card className="rounded-2xl fade-slide-in">
        <CardContent className="flex flex-col items-center p-6 text-center sm:p-10">
          <LoaderCircle
            aria-hidden="true"
            className="size-10 animate-spin text-rose-600 dark:text-rose-500"
          />
          <h3 className="mt-5 text-lg font-semibold">Connecting to recipient…</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Setting up a secure channel between the two browsers. This usually
            takes a few seconds.
          </p>
          <ConnectionSteps
            steps={["Offer sent", "Answer received", "Secure channel"]}
            className="mt-7"
          />
        </CardContent>
      </Card>
    );
  }

  if (phase === "transferring" || phase === "reconnecting") {
    return (
      <div className="space-y-4">
        {phase === "reconnecting" && (
          <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <WifiOff aria-hidden="true" />
            <AlertDescription className="text-amber-900 dark:text-amber-200">
              Connection interrupted — reconnecting… Keep both browsers open.
            </AlertDescription>
          </Alert>
        )}
        {progress && <ProgressPanel progress={progress} variant="sending" />}
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => void cancel("Cancelled by sender")}
        >
          <CircleX aria-hidden="true" />
          Cancel Transfer
        </Button>
      </div>
    );
  }

  if (phase === "completed") {
    const duration = progress?.durationMs ?? null;
    const avgSpeed =
      duration !== null && duration > 0 && totalBytes > 0
        ? totalBytes / (duration / 1000)
        : null;
    return (
      <Card className="rounded-2xl fade-slide-in">
        <CardContent className="flex flex-col items-center p-6 text-center sm:p-10">
          <CircleCheckBig
            aria-hidden="true"
            className="size-12 text-emerald-600 dark:text-emerald-500"
          />
          <h3 className="mt-4 text-xl font-semibold">Transfer complete</h3>
          <p className="mt-1.5 text-sm text-muted-foreground tabular-nums">
            {files.length} file{files.length === 1 ? "" : "s"} •{" "}
            {formatBytes(totalBytes)}
          </p>
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
            <ShieldCheck aria-hidden="true" className="size-3.5" />
            SHA-256 verified ✓
          </p>
          {duration !== null && (
            <p className="mt-2.5 inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border bg-muted/40 px-3.5 py-1 text-xs text-muted-foreground tabular-nums">
              <span className="inline-flex items-center gap-1.5">
                <Timer aria-hidden="true" className="size-3.5" />
                Completed in {formatDuration(duration)}
              </span>
              {avgSpeed !== null && (
                <span
                  className="inline-flex items-center gap-1.5"
                  title="Total bytes divided by the wall-clock duration"
                >
                  <Gauge aria-hidden="true" className="size-3.5" />
                  Average {formatSpeed(avgSpeed)}
                </span>
              )}
            </p>
          )}

          {/* Post-mortem: what the server recorded for this transfer. */}
          {info && (
            <div className="mt-6 w-full text-left">
              <SessionLog
                token={info.token}
                authToken={info.senderToken}
                role="sender"
                live={false}
              />
            </div>
          )}
          <Button
            type="button"
            className="mt-7 h-11 w-full rounded-xl bg-rose-600 text-white shadow-lg shadow-rose-600/25 hover:bg-rose-700 dark:bg-rose-500 dark:shadow-rose-500/20 dark:hover:bg-rose-600 sm:w-auto sm:px-8"
            onClick={() => {
              reset();
              scrollToTransfer();
            }}
          >
            <Upload aria-hidden="true" />
            Send More Files
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (phase === "cancelled") {
    return (
      <Card className="rounded-2xl fade-slide-in">
        <CardContent className="flex flex-col items-center p-6 text-center sm:p-10">
          <CircleX
            aria-hidden="true"
            className="size-12 text-muted-foreground"
          />
          <h3 className="mt-4 text-xl font-semibold">Transfer cancelled</h3>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            The transfer was cancelled before it finished. No files were
            shared.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-7 h-11 w-full rounded-xl sm:w-auto sm:px-8"
            onClick={() => {
              reset();
              scrollToTransfer();
            }}
          >
            <Upload aria-hidden="true" />
            Send More Files
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (phase === "failed") {
    return (
      <Card className="rounded-2xl fade-slide-in">
        <CardContent className="p-6 sm:p-8">
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>Transfer failed</AlertTitle>
            <AlertDescription>
              {error ?? "Something went wrong while setting up the transfer."}
            </AlertDescription>
          </Alert>
          <Button
            type="button"
            className="mt-5 h-11 w-full rounded-xl bg-rose-600 text-white shadow-lg shadow-rose-600/25 hover:bg-rose-700 dark:bg-rose-500 dark:shadow-rose-500/20 dark:hover:bg-rose-600"
            onClick={() => {
              reset();
              scrollToTransfer();
            }}
          >
            <RotateCcw aria-hidden="true" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (phase === "expired") {
    return (
      <Card className="rounded-2xl fade-slide-in">
        <CardContent className="flex flex-col items-center p-6 text-center sm:p-10">
          <Hourglass
            aria-hidden="true"
            className="size-12 text-muted-foreground"
          />
          <h3 className="mt-4 text-xl font-semibold">This transfer has expired.</h3>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            The share window ran out. Start a new transfer to send these files.
          </p>
          <Button
            type="button"
            className="mt-7 h-11 w-full rounded-xl bg-rose-600 text-white shadow-lg shadow-rose-600/25 hover:bg-rose-700 dark:bg-rose-500 dark:shadow-rose-500/20 dark:hover:bg-rose-600 sm:w-auto sm:px-8"
            onClick={() => {
              reset();
              scrollToTransfer();
            }}
          >
            <Upload aria-hidden="true" />
            Start New Transfer
          </Button>
        </CardContent>
      </Card>
    );
  }

  // -------------------------------------------------- idle | ready | creating

  const editing = phase === "idle" || phase === "ready";
  const creating = phase === "creating";
  const passwordTooShort =
    options.usePassword && options.password.length > 0 && options.password.length < 4;

  return (
    <Card className="gap-0 rounded-2xl py-0">
      <CardContent className="p-6 sm:p-8">
        <h3 className="sr-only">Send files</h3>

        {/* Drop zone: drag & drop target; the labeled buttons below are the
            keyboard-accessible path, so the div itself stays non-interactive. */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              setDragOver(false);
            }
          }}
          onDrop={handleDrop}
          className={cn(
            "rounded-2xl border-2 border-dashed text-center transition-all duration-200",
            files.length > 0 ? "p-5" : "p-8 sm:p-10",
            dragOver
              ? "border-rose-500 bg-rose-50 shadow-lg shadow-rose-600/10 dark:border-rose-400 dark:bg-rose-500/10"
              : "border-border bg-muted/20 hover:border-rose-300 dark:hover:border-rose-500/50",
          )}
        >
          <CloudUpload
            aria-hidden="true"
            className={cn(
              "mx-auto transition-transform duration-200",
              files.length > 0 ? "size-7" : "size-10 sm:size-12",
              dragOver
                ? "scale-110 text-rose-600 dark:text-rose-400"
                : "text-muted-foreground",
            )}
          />
          <p className={cn("font-medium", files.length > 0 ? "mt-2 text-sm" : "mt-4")}>
            {dragOver
              ? "Drop files here"
              : files.length > 0
                ? "Drop more files here"
                : "Drag & drop files here"}
          </p>
          {files.length === 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              or choose files from your device
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            <Button
              type="button"
              className="h-11 rounded-xl bg-rose-600 px-6 text-white shadow-lg shadow-rose-600/25 hover:bg-rose-700 dark:bg-rose-500 dark:shadow-rose-500/20 dark:hover:bg-rose-600"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload aria-hidden="true" />
              Select Files
            </Button>
            {folderPickerSupported && (
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl px-6"
                onClick={() => folderInputRef.current?.click()}
              >
                <FolderUp aria-hidden="true" />
                Select Folder
              </Button>
            )}
          </div>
          <input
            ref={fileInputRef}
            id="send-file-input"
            type="file"
            multiple
            aria-label="Choose files to send"
            className="sr-only"
            onChange={handleInputChange}
          />
          <input
            ref={attachFolderInput}
            id="send-folder-input"
            type="file"
            multiple
            aria-label="Choose a folder to send"
            className="sr-only"
            onChange={handleInputChange}
          />
        </div>

        {/* Inline errors while composing */}
        {error && editing && (
          <Alert variant="destructive" className="mt-4">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Large transfer warning */}
        {files.length > 0 && totalBytes > LARGE_TRANSFER_BYTES && (
          <Alert className="mt-4 border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <TriangleAlert aria-hidden="true" />
            <AlertDescription className="text-amber-900 dark:text-amber-200">
              Large transfer — keep both browsers open and awake.
            </AlertDescription>
          </Alert>
        )}

        {/* File list */}
        {files.length > 0 && (
          <div className="mt-6">
            <ul
              aria-label="Files to send"
              className="max-h-72 divide-y overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:transparent"
            >
              {files.map(({ key, file }) => (
                <li
                  key={key}
                  className="flex items-center gap-3 py-2.5 first:pt-0"
                >
                  <SendFileThumb file={file} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatBytes(file.size)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${file.name}`}
                    disabled={creating}
                    onClick={() => removeFile(key)}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="mt-1 flex items-center justify-between border-t pt-3">
              <p className="text-sm text-muted-foreground tabular-nums">
                {files.length} file{files.length === 1 ? "" : "s"} •{" "}
                {formatBytes(totalBytes)}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 text-muted-foreground hover:text-destructive"
                disabled={creating}
                onClick={clearFiles}
              >
                <X aria-hidden="true" />
                Clear
              </Button>
            </div>
          </div>
        )}

        <Separator className="my-5" />

        {/* Transfer options */}
        <Collapsible open={optionsOpen} onOpenChange={setOptionsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full justify-between px-2 text-muted-foreground hover:text-foreground"
            >
              <span className="inline-flex items-center gap-2">
                <Settings2 aria-hidden="true" className="size-4" />
                Transfer options
              </span>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn(
                  "size-4 transition-transform duration-200",
                  optionsOpen && "rotate-180",
                )}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2.5 sm:col-span-2">
                <div className="flex items-center justify-between gap-3 rounded-xl border p-3.5">
                  <div className="flex items-start gap-2.5">
                    <Lock
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    />
                    <div>
                      <Label
                        htmlFor="use-password-switch"
                        className="text-sm font-medium"
                      >
                        Password protect
                      </Label>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Recipients must enter the password to unlock the files.
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="use-password-switch"
                    checked={options.usePassword}
                    onCheckedChange={(checked) =>
                      setOption("usePassword", checked)
                    }
                  />
                </div>
                {options.usePassword && (
                  <div className="space-y-1.5">
                    <Label htmlFor="transfer-password" className="text-sm font-medium">
                      Password
                    </Label>
                    <Input
                      id="transfer-password"
                      type="password"
                      value={options.password}
                      autoComplete="new-password"
                      placeholder="At least 4 characters"
                      className="h-11 rounded-xl"
                      aria-invalid={passwordTooShort || undefined}
                      onChange={(e) => setOption("password", e.target.value)}
                    />
                    <p
                      className={cn(
                        "text-xs",
                        passwordTooShort
                          ? "text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {passwordTooShort
                        ? "Password must be at least 4 characters."
                        : "Minimum 4 characters."}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiry-select" className="text-sm font-medium">
                  Link expires after
                </Label>
                <Select
                  value={String(options.expiresInHours)}
                  onValueChange={(value) =>
                    setOption("expiresInHours", Number(value))
                  }
                >
                  <SelectTrigger
                    id="expiry-select"
                    className="h-11 w-full rounded-xl"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="max-downloads-select"
                  className="text-sm font-medium"
                >
                  Max downloads
                </Label>
                <Select
                  value={String(options.maxDownloads)}
                  onValueChange={(value) =>
                    setOption("maxDownloads", Number(value))
                  }
                >
                  <SelectTrigger
                    id="max-downloads-select"
                    className="h-11 w-full rounded-xl"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="sender-name" className="text-sm font-medium">
                  Your name{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="sender-name"
                  value={options.senderName}
                  maxLength={40}
                  placeholder="Anonymous sender"
                  className="h-11 rounded-xl"
                  onChange={(e) => setOption("senderName", e.target.value)}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Create */}
        <Button
          type="button"
          size="lg"
          disabled={files.length === 0 || creating}
          onClick={() => void create()}
          className="mt-4 h-12 w-full rounded-xl bg-rose-600 text-base text-white shadow-lg shadow-rose-600/25 hover:bg-rose-700 dark:bg-rose-500 dark:shadow-rose-500/20 dark:hover:bg-rose-600"
        >
          {creating ? (
            <>
              <LoaderCircle aria-hidden="true" className="animate-spin" />
              Creating transfer…
            </>
          ) : (
            <>
              <Upload aria-hidden="true" />
              Create Transfer
            </>
          )}
        </Button>

        <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
          Files transfer directly between connected browsers — nothing is
          uploaded until a recipient connects.
        </p>

        {/* Recent transfer history (this browser only, privacy-safe fields) */}
        {recent.length > 0 && (
          <div className="mt-5 rounded-xl border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <History aria-hidden="true" className="size-4" />
                Recent transfers
                <span className="text-xs font-normal">&nbsp;&bull; this browser only
                </span>
              </p>
              <button
                type="button"
                aria-label="Clear recent transfer history"
                onClick={clearRecentTransfers}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </div>
            <ul className="mt-2.5 space-y-1">
              {recent.map((entry) => (
                <li
                  key={entry.code}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/60"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <RecentStatusIcon status={entry.status} />
                    <span
                      className="font-mono text-sm font-medium tabular-nums"
                      title={`Transfer code ${entry.code}`}
                    >
                      {formatCode(entry.code)}
                    </span>
                    <span className="truncate text-xs text-muted-foreground tabular-nums">
                      {entry.fileCount} file{entry.fileCount === 1 ? "" : "s"} •{" "}
                      {formatBytes(entry.totalBytes)}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeTime(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
