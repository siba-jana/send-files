"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Eraser,
  CircleAlert,
  Info,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  adminFetch,
  usePolling,
  type ErrorLogEntry,
  type LogsResponse,
} from "@/components/admin/admin-api";
import { formatCount, formatDateTime, timeAgo } from "@/components/admin/admin-format";

const LEVEL_STYLES: Record<string, { badge: string; icon: React.ReactNode }> = {
  error: {
    badge: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400",
    icon: <CircleAlert aria-hidden="true" className="size-3.5" />,
  },
  warn: {
    badge: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    icon: <AlertTriangle aria-hidden="true" className="size-3.5" />,
  },
  info: {
    badge: "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-300",
    icon: <Info aria-hidden="true" className="size-3.5" />,
  },
};

function parseContext(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function LogsSection({ unresolvedCount }: { unresolvedCount: number }) {
  const [page, setPage] = useState(1);
  const [level, setLevel] = useState("all");
  const [resolvedFilter, setResolvedFilter] = useState("unresolved");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [detail, setDetail] = useState<ErrorLogEntry | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Debounced search (300 ms).
  const [searchTick, setSearchTick] = useState(0);
  if (search !== debounced) {
    window.clearTimeout((window as unknown as { __t?: number }).__t);
    (window as unknown as { __t?: number }).__t = window.setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
  }
  void searchTick;

  const query =
    `/api/admin/logs?page=${page}&limit=20` +
    `&level=${level === "all" ? "" : level}` +
    `&resolved=${resolvedFilter === "all" ? "" : resolvedFilter}` +
    `&q=${encodeURIComponent(debounced)}`;

  const { data, error, loading, refreshing, refresh } = usePolling<LogsResponse>(
    () => adminFetch<LogsResponse>(query),
    autoRefresh ? 8_000 : 0
  );

  async function toggleResolved(entry: ErrorLogEntry) {
    setBusyId(entry.id);
    try {
      await adminFetch("/api/admin/logs", {
        method: "PATCH",
        body: JSON.stringify({ id: entry.id, resolved: !entry.resolved }),
      });
      toast.success(entry.resolved ? "Marked unresolved" : "Marked resolved");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function resolveAll() {
    try {
      const res = await adminFetch<{ updated: number }>("/api/admin/logs", {
        method: "PATCH",
        body: JSON.stringify({ id: "all-unresolved", resolved: true }),
      });
      toast.success(`Resolved ${res.updated} entr${res.updated === 1 ? "y" : "ies"}`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function clearScope(scope: "resolved" | "all") {
    try {
      const res = await adminFetch<{ deleted: number }>(`/api/admin/logs?scope=${scope}`, {
        method: "DELETE",
      });
      toast.success(`Deleted ${res.deleted} entr${res.deleted === 1 ? "y" : "ies"}`);
      setPage(1);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 lg:max-w-xs">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages and stacks…"
            className="h-10 pl-9"
            aria-label="Search error log"
          />
        </div>
        <Select
          value={level}
          onValueChange={(v) => {
            setLevel(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-10 w-full lg:w-36" aria-label="Filter by level">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warn">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={resolvedFilter}
          onValueChange={(v) => {
            setResolvedFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-10 w-full lg:w-40" aria-label="Filter by resolved state">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unresolved">Unresolved</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="all">All entries</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 items-center gap-2 rounded-xl border px-3 text-sm text-muted-foreground">
            <Switch
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
              aria-label="Toggle auto refresh"
            />
            Live
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            className="h-10 gap-2"
            aria-label="Refresh logs"
          >
            <RefreshCw aria-hidden="true" className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void resolveAll()}
            disabled={unresolvedCount === 0}
            className="h-10 gap-2"
          >
            <CheckCheck aria-hidden="true" className="size-4" />
            Resolve all
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 gap-2 text-red-600 hover:text-red-700 dark:text-red-400">
                <Eraser aria-hidden="true" className="size-4" />
                Clear…
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear the error log?</AlertDialogTitle>
                <AlertDialogDescription>
                  Delete resolved entries, or wipe everything. The raw entries live in the
                  database — this cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void clearScope("resolved")}
                  className="border border-input bg-background text-foreground hover:bg-muted"
                >
                  Delete resolved only
                </AlertDialogAction>
                <AlertDialogAction
                  onClick={() => void clearScope("all")}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  Delete everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : !data || data.rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <Check aria-hidden="true" className="size-8 text-emerald-500/70" />
              <p className="text-sm text-muted-foreground">
                {error
                  ? `Couldn't load the error log: ${error}`
                  : resolvedFilter === "unresolved"
                    ? "Nothing unresolved — the log is clean."
                    : "No log entries match this filter."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5">Time</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="min-w-64">Message</TableHead>
                    <TableHead className="hidden md:table-cell">Context</TableHead>
                    <TableHead className="w-24 pr-5 text-right">Resolved</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((entry) => {
                    const style = LEVEL_STYLES[entry.level] ?? LEVEL_STYLES.info;
                    const context = parseContext(entry.context);
                    const contextKeys = context ? Object.keys(context).slice(0, 3) : [];
                    return (
                      <TableRow
                        key={entry.id}
                        onClick={() => setDetail(entry)}
                        className="cursor-pointer"
                      >
                        <TableCell className="whitespace-nowrap pl-5 text-xs text-muted-foreground">
                          <span className="block" title={formatDateTime(entry.createdAt)}>
                            {timeAgo(entry.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${style.badge} gap-1`}>
                            {style.icon}
                            {entry.level}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                            {entry.source}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-96">
                          <span className="line-clamp-2 text-sm" title={entry.message}>
                            {entry.message}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {contextKeys.length > 0 ? (
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {contextKeys.join(", ")}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="pr-5 text-right">
                          <Button
                            variant={entry.resolved ? "secondary" : "outline"}
                            size="icon"
                            className="size-8"
                            disabled={busyId === entry.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              void toggleResolved(entry);
                            }}
                            aria-label={entry.resolved ? "Mark unresolved" : "Mark resolved"}
                          >
                            {busyId === entry.id ? (
                              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                            ) : (
                              <Check
                                aria-hidden="true"
                                className={`size-4 ${entry.resolved ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/50"}`}
                              />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {data && data.total > 0 && (
            <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
              <p className="text-xs text-muted-foreground">
                {formatCount(data.total)} entr{data.total === 1 ? "y" : "ies"} · page {data.page} of{" "}
                {data.totalPages}
                {autoRefresh && <span className="ml-2 text-emerald-600 dark:text-emerald-400">● live</span>}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                  className="size-8"
                >
                  <ChevronLeft aria-hidden="true" className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page >= (data?.totalPages ?? 1)}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Next page"
                  className="size-8"
                >
                  <ChevronRight aria-hidden="true" className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2.5">
                  <Badge variant="outline" className={`${(LEVEL_STYLES[detail.level] ?? LEVEL_STYLES.info).badge} gap-1`}>
                    {(LEVEL_STYLES[detail.level] ?? LEVEL_STYLES.info).icon}
                    {detail.level}
                  </Badge>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                    {detail.source}
                  </span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {formatDateTime(detail.createdAt)}
                  </span>
                </DialogTitle>
                <DialogDescription className="pt-1 text-left font-mono text-xs leading-relaxed">
                  {detail.message}
                </DialogDescription>
              </DialogHeader>

              {detail.stack && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Stack trace
                  </h3>
                  <ScrollArea className="h-56 rounded-xl border bg-muted/40">
                    <pre className="whitespace-pre-wrap break-all p-3 font-mono text-[11px] leading-relaxed">
                      {detail.stack}
                    </pre>
                  </ScrollArea>
                </div>
              )}

              <div className="grid gap-3 text-sm sm:grid-cols-2">
                {detail.url && (
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">URL</p>
                    <p className="mt-1 break-all font-mono text-xs">{detail.url}</p>
                  </div>
                )}
                {detail.ip && (
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Client IP</p>
                    <p className="mt-1 font-mono text-xs">{detail.ip}</p>
                  </div>
                )}
                {detail.userAgent && (
                  <div className="rounded-xl border bg-muted/30 p-3 sm:col-span-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">User agent</p>
                    <p className="mt-1 break-all font-mono text-xs">{detail.userAgent}</p>
                  </div>
                )}
                {parseContext(detail.context) && (
                  <div className="rounded-xl border bg-muted/30 p-3 sm:col-span-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Context</p>
                    <pre className="mt-1 overflow-x-auto font-mono text-[11px] leading-relaxed">
                      {JSON.stringify(parseContext(detail.context), null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    void toggleResolved(detail);
                    setDetail(null);
                  }}
                >
                  {detail.resolved ? "Mark unresolved" : "Mark resolved"}
                </Button>
                <Button onClick={() => setDetail(null)}>Close</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
