"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileStack,
  Loader2,
  Lock,
  RefreshCw,
  Search,
} from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  adminFetch,
  usePolling,
  type TransferDetailResponse,
  type TransfersResponse,
} from "@/components/admin/admin-api";
import {
  formatBytes,
  formatDateTime,
  formatExpiry,
  formatCount,
  shortToken,
} from "@/components/admin/admin-format";

const STATUS_STYLES: Record<string, string> = {
  waiting: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  completed: "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-300",
  cancelled: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  expired: "border-amber-600/30 bg-amber-600/10 text-amber-600 dark:text-amber-500",
};

const EVENT_ICONS: Record<string, string> = {
  created: "bg-slate-500",
  receiver_joined: "bg-rose-500",
  connection: "bg-emerald-500",
  state: "bg-slate-400",
  completed: "bg-emerald-600",
  cancelled: "bg-rose-600",
  expired: "bg-amber-500",
  unlocked: "bg-amber-500",
};

export function TransfersSection() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TransferDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Debounce the search box (300 ms) so typing doesn't hammer the API.
  const [searchTick, setSearchTick] = useState(0);
  if (search !== debounced) {
    window.clearTimeout((window as unknown as { __t?: number }).__t);
    (window as unknown as { __t?: number }).__t = window.setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
  }

  const query = `/api/admin/transfers?page=${page}&status=${status === "all" ? "" : status}&q=${encodeURIComponent(debounced)}`;
  const { data, error, loading, refreshing, refresh } = usePolling<TransfersResponse>(
    () => adminFetch<TransfersResponse>(query),
    30_000
  );
  void searchTick;

  async function openDetail(id: string) {
    setDetailId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      setDetail(await adminFetch<TransferDetailResponse>(`/api/admin/transfers/${id}`));
    } catch {
      /* dialog shows its own error state */
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search token or sender name…"
            className="h-10 pl-9"
            aria-label="Search transfers"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-10 w-full sm:w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="waiting">Waiting</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          className="h-10 gap-2"
          aria-label="Refresh transfers"
        >
          <RefreshCw aria-hidden="true" className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : !data || data.rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <FileStack aria-hidden="true" className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {error ? `Couldn't load transfers: ${error}` : "No transfers match this filter."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5">Token</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Files</TableHead>
                    <TableHead className="text-right">Size</TableHead>
                    <TableHead className="text-right">Downloads</TableHead>
                    <TableHead className="hidden md:table-cell">Created</TableHead>
                    <TableHead className="hidden lg:table-cell">Expires</TableHead>
                    <TableHead className="w-10 pr-5" aria-label="Actions" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row) => (
                    <TableRow
                      key={row.id}
                      onClick={() => void openDetail(row.id)}
                      className="cursor-pointer"
                    >
                      <TableCell className="pl-5 font-mono text-xs">
                        <span className="inline-flex items-center gap-1.5">
                          {row.passwordProtected && (
                            <Lock aria-label="Password protected" className="size-3 text-amber-600 dark:text-amber-400" />
                          )}
                          {shortToken(row.publicToken, 10)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${STATUS_STYLES[row.status] ?? ""} capitalize`}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCount(row.fileCount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatBytes(row.totalBytes)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {row.downloads}/{row.maxDownloads}
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                        {formatDateTime(row.createdAt)}
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                        {formatExpiry(row.expiresAt)}
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        <Eye aria-hidden="true" className="size-4 text-muted-foreground/60" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {data && data.total > 0 && (
            <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
              <p className="text-xs text-muted-foreground">
                {formatCount(data.total)} transfer{data.total === 1 ? "" : "s"} · page {data.page} of{" "}
                {data.totalPages}
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
      <Dialog open={detailId !== null} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent
          aria-label="Transfer details"
          className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"
        >
          {detailLoading || !detail ? (
            <>
              {/* Radix a11y: the content must always register a title + description,
                  even in the loading state (aria-label alone doesn't count). */}
              <DialogHeader className="sr-only">
                <DialogTitle>Loading transfer…</DialogTitle>
                <DialogDescription>Fetching transfer details from the server.</DialogDescription>
              </DialogHeader>
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                Loading transfer…
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2.5 font-mono text-base">
                  {detail.transfer.publicToken}
                  <Badge
                    variant="outline"
                    className={`${STATUS_STYLES[detail.transfer.status] ?? ""} capitalize`}
                  >
                    {detail.transfer.status}
                  </Badge>
                  {detail.transfer.passwordProtected && (
                    <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                      <Lock aria-hidden="true" className="mr-1 size-3" /> password
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {detail.transfer.senderName ? `Sender: ${detail.transfer.senderName} · ` : ""}
                  {formatCount(detail.files.length)} file
                  {detail.files.length === 1 ? "" : "s"} ·{" "}
                  {formatBytes(detail.files.reduce((sum, f) => sum + Number(f.size), 0))} ·{" "}
                  {detail.transfer.downloads}/{detail.transfer.maxDownloads} downloads
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border bg-muted/30 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
                  <p className="mt-1">{formatDateTime(detail.transfer.createdAt)}</p>
                </div>
                <div className="rounded-xl border bg-muted/30 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Expires</p>
                  <p className="mt-1">{formatDateTime(detail.transfer.expiresAt)}</p>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold">Files</h3>
                <ul className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                  {detail.files.map((file) => (
                    <li
                      key={file.id}
                      className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate" title={file.fileName}>
                        {file.position + 1}. {file.fileName}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {formatBytes(file.size)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold">Event timeline</h3>
                <ol className="relative max-h-64 space-y-3 overflow-y-auto border-l-2 border-border pl-5 pr-1">
                  {detail.events.map((event) => (
                    <li key={event.id} className="relative">
                      <span
                        aria-hidden="true"
                        className={`absolute -left-[27px] top-1 size-3 rounded-full border-2 border-background ${
                          EVENT_ICONS[event.eventType] ?? "bg-slate-400"
                        }`}
                      />
                      <p className="text-sm capitalize">{event.eventType.replace(/_/g, " ")}</p>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock aria-hidden="true" className="size-3" />
                        {formatDateTime(event.createdAt)}
                        {event.metadata && (
                          <span className="truncate font-mono text-[11px] text-muted-foreground/70">
                            {event.metadata.slice(0, 60)}
                          </span>
                        )}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
