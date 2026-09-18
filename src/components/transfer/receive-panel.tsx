"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  CircleCheckBig,
  CircleX,
  Clock,
  Copy,
  Download,
  FileArchive,
  HardDrive,
  History,
  Link2,
  LoaderCircle,
  Lock,
  RotateCcw,
  ShieldCheck,
  Timer,
  TriangleAlert,
  User,
  WifiOff,
  X,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  extractToken,
  normalizeCode,
  useReceiveTransfer,
} from "@/hooks/use-receive";
import { formatBytes, formatSpeed } from "@/lib/transfer/stats";
import {
  addRecentReceived,
  clearRecentReceived,
  useRecentReceived,
  type RecentReceivedStatus,
} from "@/lib/transfer/received";
import { formatRelativeTime } from "@/lib/transfer/recent";
import { formatDuration } from "./format-utils";
import { buildZipBlob, canZip } from "@/lib/transfer/zip";
import { ConnectionSteps, ProgressPanel } from "./progress-panel";
import { FileIcon } from "./file-icon";
import { FileThumb } from "./file-thumb";
import { KbdHint } from "./kbd-hint";
import { scrollToTransfer } from "./scroll-utils";
import { SessionLog } from "./session-log";

/** Imperative API the TransferWidget uses for share-link / ?code= entry. */
export interface ReceiveControllerApi {
  startByToken: (token: string) => void;
  startByCode: (code: string) => void;
}

export interface ReceivePanelProps {
  registerController?: (api: ReceiveControllerApi) => void;
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

/** Copy text with execCommand fallback; toast on success. */
async function copyText(text: string, successMessage: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    toast.success(successMessage);
  } catch {
    toast.error("Couldn't copy — your browser blocked clipboard access.");
  }
}

/** Small colored status dot for received-history rows. */
function RecentStatusIcon({ status }: { status: RecentReceivedStatus }) {
  const className = "size-2 shrink-0 rounded-full";
  switch (status) {
    case "completed":
      return <span aria-hidden="true" className={cn(className, "bg-emerald-500")} />;
    case "failed":
      return <span aria-hidden="true" className={cn(className, "bg-destructive")} />;
    default:
      return <span aria-hidden="true" className={cn(className, "bg-muted-foreground/50")} />;
  }
}

/** "482917" → "482 917" */
function formatCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

export function ReceivePanel({ registerController }: ReceivePanelProps) {
  const {
    supported,
    fsSupported,
    phase,
    meta,
    progress,
    error,
    unlocked,
    receiverToken,
    startByToken,
    startByCode,
    submitPassword,
    accept,
    decline,
    cancel,
    reset,
    downloadFile,
    downloadAll,
  } = useReceiveTransfer();

  // Capability probes are read post-hydration (useSyncExternalStore) so the
  // server-rendered HTML and the first client render stay identical.
  const hydrated = useIsHydrated();
  const unsupported = hydrated && !supported;
  const diskAvailable = hydrated && fsSupported;

  const [code, setCode] = useState("");
  const [linkValue, setLinkValue] = useState("");
  const [password, setPassword] = useState("");
  const [saveToDisk, setSaveToDisk] = useState(true);
  const [zipping, setZipping] = useState(false);

  const countdown = useCountdown(
    phase === "confirm" || phase === "unlocking" ? meta?.expiresAt : null,
  );

  // Received history: record each transfer exactly once when it reaches a
  // terminal phase (localStorage + store notify — no setState here). Only
  // privacy-safe fields the receiver already saw: sender display name,
  // counts, sizes, outcome, plus the share code when joined by code.
  const receivedHistory = useRecentReceived();
  const recordedTokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      phase !== "completed" &&
      phase !== "cancelled" &&
      phase !== "failed"
    ) {
      return;
    }
    if (!meta || recordedTokenRef.current === meta.token) return;
    recordedTokenRef.current = meta.token;
    const enteredCode = normalizeCode(code);
    const results = progress?.results ?? [];
    addRecentReceived({
      code: enteredCode.length === 6 ? enteredCode : null,
      senderName: meta.senderName?.trim() || null,
      fileCount:
        phase === "completed" && results.length > 0
          ? results.length
          : meta.fileCount,
      totalBytes:
        phase === "completed" && results.length > 0
          ? results.reduce((acc, r) => acc + r.size, 0)
          : meta.totalBytes,
      createdAt: Date.now(),
      status: phase as RecentReceivedStatus,
    });
  }, [phase, meta, code, progress]);

  // Expose lookup entry points to the orchestrating widget (share links etc.).
  useEffect(() => {
    registerController?.({
      startByToken: (token: string) => void startByToken(token),
      startByCode: (value: string) => void startByCode(value),
    });
  }, [registerController, startByToken, startByCode]);

  const submitCode = () => {
    if (normalizeCode(code).length === 6) void startByCode(code);
  };

  /** Full reset: clears the panel inputs too, so a fresh code/link is typed
   * from scratch (the previous code would otherwise linger in the field). */
  const resetPanel = (scroll = true) => {
    reset();
    setCode("");
    setLinkValue("");
    setPassword("");
    if (scroll) scrollToTransfer();
  };

  const submitLink = (e: FormEvent) => {
    e.preventDefault();
    const token = extractToken(linkValue);
    if (token) {
      void startByToken(token);
    } else {
      toast.error("That doesn't look like a transfer link.");
    }
  };

  const handleCodeKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitCode();
    }
  };

  const handleCodePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!text) return;
    // A share link pasted into the code field is routed to the link flow —
    // a common slip that would otherwise produce nonsense digits.
    if (/https?:\/\//i.test(text) || /[?&]t=/i.test(text)) {
      const token = extractToken(text);
      if (token) {
        e.preventDefault();
        void startByToken(token);
        return;
      }
    }
    e.preventDefault();
    const digits = normalizeCode(text).slice(0, 6);
    if (digits) setCode(digits);
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

  // ------------------------------------------------------------- lookup states

  if (phase === "resolving") {
    return (
      <Card className="rounded-2xl fade-slide-in">
        <CardContent className="flex flex-col items-center p-6 text-center sm:p-10">
          <LoaderCircle
            aria-hidden="true"
            className="size-10 animate-spin text-rose-600 dark:text-rose-500"
          />
          <h3 className="mt-5 text-lg font-semibold">Looking up transfer…</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Checking the code with the transfer service.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ---------------------------------------------------- confirm | unlocking

  if (phase === "confirm" || phase === "unlocking") {
    const unlocking = phase === "unlocking";
    const totalLabel = meta
      ? `${meta.fileCount} file${meta.fileCount === 1 ? "" : "s"} • ${formatBytes(meta.totalBytes)}`
      : "";
    return (
      <Card className="gap-0 rounded-2xl py-0 fade-slide-in">
        <CardContent className="p-6 sm:p-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold">Files ready to receive</h3>
            <p className="mt-1.5 inline-flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <User aria-hidden="true" className="size-4" />
              From: {meta?.senderName?.trim() || "Anonymous sender"}
            </p>
          </div>

          <div className="mt-6">
            {meta?.files ? (
              <>
                <ul
                  aria-label="Files in this transfer"
                  className="max-h-72 divide-y overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:transparent"
                >
                  {meta.files.map((file, i) => (
                    <li key={`${i}-${file.name}`} className="flex items-center gap-3 py-2.5 first:pt-0">
                      <FileIcon name={file.name} mimeType={file.mimeType} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatBytes(file.size)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-1 flex items-center justify-between border-t pt-3">
                  <p className="text-sm text-muted-foreground tabular-nums">
                    Total: {totalLabel}
                  </p>
                  <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock aria-hidden="true" className="size-3.5" />
                    {countdown ? `Expires in ${countdown}` : "Expires soon"}
                  </p>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed p-6 text-center">
                <Lock
                  aria-hidden="true"
                  className="mx-auto size-8 text-muted-foreground"
                />
                <p className="mt-3 font-medium tabular-nums">{totalLabel}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  File names are hidden until you unlock this transfer.
                </p>
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock aria-hidden="true" className="size-3.5" />
                  {countdown ? `Expires in ${countdown}` : "Expires soon"}
                </p>
              </div>
            )}
          </div>

          {!unlocked ? (
            <form
              className="mt-6 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void submitPassword(password);
              }}
            >
              <div className="space-y-2">
                <Label
                  htmlFor="transfer-password-input"
                  className="flex items-center gap-1.5 text-sm font-medium"
                >
                  <Lock aria-hidden="true" className="size-4 text-muted-foreground" />
                  Enter the transfer password
                </Label>
                <Input
                  id="transfer-password-input"
                  type="password"
                  value={password}
                  autoComplete="current-password"
                  placeholder="Password"
                  className="h-11 rounded-xl"
                  autoFocus
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
                <Button
                  type="submit"
                  disabled={unlocking || password.length === 0}
                  className="h-11 flex-1 rounded-xl bg-rose-600 text-white shadow-lg shadow-rose-600/25 hover:bg-rose-700 dark:bg-rose-500 dark:shadow-rose-500/20 dark:hover:bg-rose-600"
                >
                  {unlocking ? (
                    <>
                      <LoaderCircle aria-hidden="true" className="animate-spin" />
                      Unlocking…
                    </>
                  ) : (
                    <>
                      <Lock aria-hidden="true" />
                      Unlock
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 flex-1 rounded-xl"
                  onClick={decline}
                >
                  Back
                </Button>
              </div>
            </form>
          ) : (
            <div className="mt-6 space-y-4">
              {diskAvailable && (
                <div className="flex items-start justify-between gap-3 rounded-xl border p-3.5">
                  <div className="flex items-start gap-2.5">
                    <HardDrive
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    />
                    <div>
                      <Label
                        htmlFor="save-disk-switch"
                        className="text-sm font-medium"
                      >
                        Save directly to disk{" "}
                        <span className="font-normal text-muted-foreground">
                          (recommended)
                        </span>
                      </Label>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Streams files straight to a folder you pick — no memory
                        limits, even for huge transfers.
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="save-disk-switch"
                    checked={saveToDisk}
                    onCheckedChange={setSaveToDisk}
                  />
                </div>
              )}

              <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
                <Button
                  type="button"
                  size="lg"
                  className="h-12 flex-1 rounded-xl bg-rose-600 text-base text-white shadow-lg shadow-rose-600/25 hover:bg-rose-700 dark:bg-rose-500 dark:shadow-rose-500/20 dark:hover:bg-rose-600"
                  onClick={() => void accept(diskAvailable ? saveToDisk : false)}
                >
                  <Download aria-hidden="true" />
                  Accept Files
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 flex-1 rounded-xl sm:max-w-36"
                  onClick={decline}
                >
                  Back
                </Button>
              </div>
            </div>
          )}

          <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
            Files stream directly from the sender&apos;s browser to yours — they
            are never stored on our servers. Every file is SHA-256 verified on
            arrival.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ------------------------------------------------------------- connecting

  if (phase === "connecting") {
    return (
      <Card className="rounded-2xl fade-slide-in">
        <CardContent className="flex flex-col items-center p-6 text-center sm:p-10">
          <LoaderCircle
            aria-hidden="true"
            className="size-10 animate-spin text-rose-600 dark:text-rose-500"
          />
          <h3 className="mt-5 text-lg font-semibold">Connecting to sender…</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Setting up a secure channel between the two browsers. This usually
            takes a few seconds.
          </p>
          <ConnectionSteps
            steps={["Offer received", "Answer sent", "Secure channel opening"]}
            className="mt-7"
          />
        </CardContent>
      </Card>
    );
  }

  // ------------------------------------------------- transferring | reconnecting

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
        {progress && <ProgressPanel progress={progress} variant="receiving" />}
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => void cancel("Stopped by recipient")}
        >
          <CircleX aria-hidden="true" />
          Stop Receiving
        </Button>
      </div>
    );
  }

  // ------------------------------------------------------------- completed

  if (phase === "completed") {
    const results = progress?.results ?? [];
    const totalBytesReceived = results.reduce((acc, r) => acc + r.size, 0);
    const downloadable = results.filter((r) => r.blob);
    const zipSupported = downloadable.length > 1 && canZip(downloadable);
    const duration = progress?.durationMs ?? null;
    const avgSpeed =
      duration !== null && duration > 0 && totalBytesReceived > 0
        ? totalBytesReceived / (duration / 1000)
        : null;

    /** Build one ZIP from the in-memory results (deflated when it saves space). */
    const downloadAllAsZip = async () => {
      if (!zipSupported || zipping) return;
      setZipping(true);
      try {
        const { blob, bytesSaved, deflatedEntries } = await buildZipBlob(
          downloadable.map((r) => ({
            name: r.name,
            blob: r.blob as Blob,
            expectedSize: r.size,
            lastModified: r.mtime ?? undefined,
          })),
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ilovedoc-files-${(meta?.token ?? "transfer").slice(0, 6)}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
        if (deflatedEntries > 0 && bytesSaved > 0) {
          toast.success(
            `ZIP downloaded — ${deflatedEntries} of ${downloadable.length} files compressed, saving ${formatBytes(bytesSaved)}`,
          );
        } else {
          toast.success("ZIP archive downloaded");
        }
      } catch {
        toast.error("Couldn't build the ZIP — use the per-file downloads.");
      } finally {
        setZipping(false);
      }
    };

    return (
      <Card className="gap-0 rounded-2xl py-0 fade-slide-in">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <CircleCheckBig
              aria-hidden="true"
              className="size-12 text-emerald-600 dark:text-emerald-500"
            />
            <h3 className="mt-4 text-xl font-semibold">
              Files received successfully
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground tabular-nums">
              {results.length > 0
                ? `${results.length} file${results.length === 1 ? "" : "s"} • ${formatBytes(totalBytesReceived)}`
                : meta
                  ? `${meta.fileCount} file${meta.fileCount === 1 ? "" : "s"}`
                  : ""}
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
                    title="Total bytes received divided by the wall-clock duration"
                  >
                    <ShieldCheck aria-hidden="true" className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    Average {formatSpeed(avgSpeed)}
                  </span>
                )}
              </p>
            )}
          </div>

          {results.length > 0 ? (
            <ul
              aria-label="Received files"
              className="mt-6 max-h-72 space-y-1 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:transparent"
            >
              {results.map((item, i) => (
                <li
                  key={`${i}-${item.name}`}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5 first:pt-2.5 transition-colors hover:bg-muted/50"
                >
                  <FileThumb blob={item.blob ?? new Blob()} name={item.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={item.name}>
                      {item.name}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="tabular-nums">{formatBytes(item.size)}</span>
                      {item.sha256 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex cursor-pointer items-center gap-1 rounded font-medium text-emerald-700 outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:text-emerald-400"
                              title={`SHA-256: ${item.sha256} — click to copy`}
                              onClick={() =>
                                void copyText(
                                  item.sha256 as string,
                                  "SHA-256 hash copied",
                                )
                              }
                            >
                              <ShieldCheck aria-hidden="true" className="size-3.5" />
                              SHA-256 verified ✓
                              <Copy aria-hidden="true" className="size-3 opacity-60" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            className="max-w-64 break-all font-mono text-[10px]"
                          >
                            SHA-256 {item.sha256.slice(0, 16)}… — click to copy
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span>Received</span>
                      )}
                    </p>
                  </div>
                  {item.savedToDisk ? (
                    <Badge className="shrink-0 gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
                      <HardDrive aria-hidden="true" className="size-3" />
                      Saved to disk
                    </Badge>
                  ) : (
                    item.blob && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 shrink-0 rounded-lg"
                        onClick={() => downloadFile(item)}
                      >
                        <Download aria-hidden="true" />
                        Download
                      </Button>
                    )
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              The sender cancelled before any files finished.
            </p>
          )}

          <Separator className="my-5" />

          {/* Post-mortem: what the server recorded for this transfer (receiver view). */}
          {meta && receiverToken && (
            <div className="mb-5">
              <SessionLog
                token={meta.token}
                authToken={receiverToken}
                role="receiver"
                live={false}
              />
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            {zipSupported ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    className="h-11 w-full rounded-xl bg-rose-600 text-white shadow-lg shadow-rose-600/25 hover:bg-rose-700 dark:bg-rose-500 dark:shadow-rose-500/20 dark:hover:bg-rose-600"
                    disabled={zipping}
                    onClick={() => void downloadAllAsZip()}
                  >
                    {zipping ? (
                      <LoaderCircle aria-hidden="true" className="animate-spin" />
                    ) : (
                      <FileArchive aria-hidden="true" />
                    )}
                    {zipping ? "Building ZIP…" : `Download All as ZIP (${downloadable.length})`}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  One archive, built in your browser — names, sizes and SHA-256
                  hashes are exactly the ones shown above. Files are
                  deflate-compressed when that saves space.
                </TooltipContent>
              </Tooltip>
            ) : null}
            {downloadable.length > 0 && (
              <Button
                type="button"
                variant={zipSupported ? "outline" : "default"}
                className={cn(
                  "h-11 w-full rounded-xl",
                  !zipSupported &&
                    "bg-rose-600 text-white shadow-lg shadow-rose-600/25 hover:bg-rose-700 dark:bg-rose-500 dark:shadow-rose-500/20 dark:hover:bg-rose-600",
                )}
                onClick={() => downloadAll(results)}
              >
                <Download aria-hidden="true" />
                Download files separately{downloadable.length > 1 ? ` (${downloadable.length})` : ""}
              </Button>
            )}
            <Button
              type="button"
              variant={zipSupported ? "outline" : "default"}
              className={cn(
                "h-11 w-full rounded-xl",
                !zipSupported &&
                  "bg-rose-600 text-white shadow-lg shadow-rose-600/25 hover:bg-rose-700 dark:bg-rose-500 dark:shadow-rose-500/20 dark:hover:bg-rose-600",
              )}
              onClick={() => {
                resetPanel();
              }}
            >
              <RotateCcw aria-hidden="true" />
              Receive More Files
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ----------------------------------------------------- cancelled | failed

  if (phase === "cancelled") {
    return (
      <Card className="rounded-2xl fade-slide-in">
        <CardContent className="flex flex-col items-center p-6 text-center sm:p-10">
          <CircleX aria-hidden="true" className="size-12 text-muted-foreground" />
          <h3 className="mt-4 text-xl font-semibold">Transfer cancelled</h3>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            {error ?? "The transfer was stopped before it finished."}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-7 h-11 w-full rounded-xl sm:w-auto sm:px-8"
            onClick={() => {
              resetPanel();
            }}
          >
            <RotateCcw aria-hidden="true" />
            Enter Another Code
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
            <AlertTitle>Couldn&apos;t receive this transfer</AlertTitle>
            <AlertDescription>
              {error ?? "Something went wrong while looking up the transfer."}
            </AlertDescription>
          </Alert>
          <Button
            type="button"
            className="mt-5 h-11 w-full rounded-xl bg-rose-600 text-white shadow-lg shadow-rose-600/25 hover:bg-rose-700 dark:bg-rose-500 dark:shadow-rose-500/20 dark:hover:bg-rose-600"
            onClick={() => resetPanel(false)}
          >
            <RotateCcw aria-hidden="true" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ------------------------------------------------------------- idle

  return (
    <Card className="gap-0 rounded-2xl py-0">
      <CardContent className="p-6 sm:p-8">
        <div className="text-center">
          <h3 className="text-lg font-semibold">Receive files</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Enter the 6-digit code the sender shared with you.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <Label htmlFor="transfer-code-input" className="sr-only">
            Transfer code
          </Label>
          <input
            id="transfer-code-input"
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value).slice(0, 6))}
            onKeyDown={handleCodeKeyDown}
            onPaste={handleCodePaste}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            placeholder="••••••"
            aria-label="Transfer code"
            className="h-16 w-full rounded-2xl border-2 bg-background text-center text-3xl font-semibold tracking-[0.5em] ps-[0.25em] tabular-nums transition-colors outline-none placeholder:text-muted-foreground/50 focus-visible:border-rose-500 focus-visible:ring-4 focus-visible:ring-rose-500/20 dark:focus-visible:border-rose-400"
          />
          <Button
            type="button"
            size="lg"
            disabled={normalizeCode(code).length !== 6}
            onClick={submitCode}
            title="Press Enter in the code field to start receiving"
            className="h-12 w-full rounded-xl bg-rose-600 text-base text-white shadow-lg shadow-rose-600/25 hover:bg-rose-700 dark:bg-rose-500 dark:shadow-rose-500/20 dark:hover:bg-rose-600"
          >
            <Download aria-hidden="true" />
            Receive Files
            <KbdHint onPrimary>Enter</KbdHint>
          </Button>
        </div>

        <div className="my-6 flex items-center gap-3" aria-hidden="true">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>

        <form onSubmit={submitLink} className="space-y-3">
          <Label
            htmlFor="transfer-link-input"
            className="flex items-center gap-1.5 text-sm font-medium"
          >
            <Link2 aria-hidden="true" className="size-4 text-muted-foreground" />
            Have a sharing link?
          </Label>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Input
              id="transfer-link-input"
              type="text"
              value={linkValue}
              placeholder="Paste the link that starts with the site address"
              className="h-11 flex-1 rounded-xl"
              onChange={(e) => setLinkValue(e.target.value)}
            />
            <Button
              type="submit"
              variant="outline"
              disabled={!linkValue.trim()}
              className="h-11 shrink-0 rounded-xl"
            >
              Open Transfer Link
              <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        </form>

        <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
          Ask the sender for a 6-digit code or a link. Files arrive straight
          from their browser, SHA-256 verified.
        </p>

        {/* Received history (this browser only, privacy-safe fields). */}
        {receivedHistory.length > 0 && (
          <div className="mt-5 rounded-xl border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <History aria-hidden="true" className="size-4" />
                Recently received
                <span className="text-xs font-normal">
                  &nbsp;&bull; this browser only
                </span>
              </p>
              <button
                type="button"
                aria-label="Clear received history"
                onClick={clearRecentReceived}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </div>
            <ul className="mt-2.5 space-y-1">
              {receivedHistory.map((entry) => (
                <li
                  key={`${entry.createdAt}-${entry.code ?? "link"}`}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/60"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <RecentStatusIcon status={entry.status} />
                    <span
                      className="min-w-0 truncate text-sm font-medium"
                      title={
                        entry.code
                          ? `Transfer code ${entry.code}`
                          : (entry.senderName ?? undefined)
                      }
                    >
                      {entry.code ? (
                        <span className="font-mono tabular-nums">
                          {formatCode(entry.code)}
                        </span>
                      ) : entry.senderName ? (
                        <>
                          <User
                            aria-hidden="true"
                            className="me-1 inline size-3.5 -mt-0.5 text-muted-foreground"
                          />
                          {entry.senderName}
                        </>
                      ) : (
                        "Transfer"
                      )}
                    </span>
                    <span className="shrink-0 truncate text-xs text-muted-foreground tabular-nums">
                      {entry.fileCount} file{entry.fileCount === 1 ? "" : "s"}{" "}
                      &bull; {formatBytes(entry.totalBytes)}
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
