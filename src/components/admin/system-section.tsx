"use client";

import {
  Cpu,
  Gauge,
  HardDrive,
  MemoryStick,
  Radio,
  Server,
  ShieldCheck,
  Terminal,
  Timer,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type OverviewResponse,
  type PollingState,
  type SignalingSnapshot,
} from "@/components/admin/admin-api";
import {
  formatBytes,
  formatCount,
  formatDateTime,
  formatUptime,
  timeAgo,
} from "@/components/admin/admin-format";

type SignalingUp = Extract<SignalingSnapshot, { ok: true }>;

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-2 last:border-b-0">
      <dt className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm font-medium">{value}</dd>
    </div>
  );
}

function LogLine({ line }: { line: string }) {
  const isError = /\berror\b|✗|failed|Error:/i.test(line);
  const isWarn = /\bwarn|warning\b/i.test(line);
  return (
    <div
      className={`whitespace-pre-wrap break-all px-3 py-1 font-mono text-[11px] leading-relaxed ${
        isError
          ? "text-red-600 dark:text-red-400"
          : isWarn
            ? "text-amber-600 dark:text-amber-400"
            : "text-muted-foreground"
      }`}
    >
      {line}
    </div>
  );
}

export function SystemSection({ state }: { state: PollingState<OverviewResponse> }) {
  const { data, loading } = state;

  if (loading && !data) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl lg:col-span-2" />
      </div>
    );
  }
  if (!data) return null;

  const sig: SignalingUp | null = data.signaling.ok ? data.signaling : null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Next.js process */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Server aria-hidden="true" className="size-4 text-rose-600 dark:text-rose-400" />
            Next.js app server
          </CardTitle>
          <CardDescription>The process serving pages + REST APIs on :3000.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl>
            <InfoRow label="Uptime" value={formatUptime(data.system.uptimeSec)} />
            <InfoRow label="Node" value={data.system.nodeVersion} />
            <InfoRow label="Env" value={<code className="font-mono text-xs">{data.system.nodeEnv}</code>} />
            <InfoRow label="PID" value={data.system.pid} />
            <InfoRow
              label="Memory (RSS)"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <MemoryStick aria-hidden="true" className="size-3.5 text-muted-foreground" />
                  {formatBytes(data.system.rssBytes)}
                </span>
              }
            />
            <InfoRow label="Heap used" value={formatBytes(data.system.heapUsedBytes)} />
            <InfoRow label="Platform" value={data.system.platform} />
          </dl>
        </CardContent>
      </Card>

      {/* Signaling service */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Radio aria-hidden="true" className="size-4 text-emerald-600 dark:text-emerald-400" />
            Signaling service :3003
            {sig ? (
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                online
              </Badge>
            ) : (
              <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400">
                unreachable
              </Badge>
            )}
          </CardTitle>
          <CardDescription>socket.io relay for WebRTC coordination (files never pass through).</CardDescription>
        </CardHeader>
        <CardContent>
          {sig ? (
            <dl>
              <InfoRow label="Uptime" value={formatUptime(sig.uptimeSec)} />
              <InfoRow label="Sockets connected" value={formatCount(sig.sockets)} />
              <InfoRow label="Active rooms" value={formatCount(sig.rooms)} />
              <InfoRow label="Connections (lifetime)" value={formatCount(sig.counters.connections)} />
              <InfoRow label="Refused (per-IP limits)" value={formatCount(sig.counters.refused)} />
              <InfoRow label="Joins relayed" value={formatCount(sig.counters.joins)} />
              <InfoRow label="Signals relayed" value={formatCount(sig.counters.signals)} />
              <InfoRow label="Transfers done / cancelled" value={`${formatCount(sig.counters.transfersDone)} / ${formatCount(sig.counters.transfersCancelled)}`} />
              <InfoRow label="Memory (RSS)" value={formatBytes(sig.memory.rss)} />
              <InfoRow
                label="Recent errors"
                value={
                  sig.recentErrors.length === 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400">none</span>
                  ) : (
                    `${sig.recentErrors.length} (see log below)`
                  )
                }
              />
            </dl>
          ) : (
            <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-400">
              The internal stats endpoint on 127.0.0.1:3004 did not answer. Check whether the
              signaling service is running (<code className="font-mono text-xs">mini-services/signaling</code>).
            </p>
          )}
        </CardContent>
      </Card>

      {/* Database + security config */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive aria-hidden="true" className="size-4 text-amber-600 dark:text-amber-400" />
            Database &amp; configuration
          </CardTitle>
          <CardDescription>SQLite metadata store + deployment config flags.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl>
            <InfoRow label="DB file" value={<code className="font-mono text-xs">db/custom.db</code>} />
            <InfoRow label="DB size" value={formatBytes(data.system.dbBytes)} />
            <InfoRow label="Live transfer rows" value={formatCount(data.transfers.total)} />
            <InfoRow label="Live file rows" value={formatCount(data.transfers.files)} />
            <InfoRow label="Error log entries" value={formatCount(data.errors.total)} />
            <InfoRow
              label="TURN relay"
              value={
                data.system.turnConfigured ? (
                  <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">configured</Badge>
                ) : (
                  <span className="text-muted-foreground">not set (STUN only)</span>
                )
              }
            />
            <InfoRow
              label="CODE_PEPPER"
              value={
                data.system.pepperSet ? (
                  <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">set</Badge>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">dev default</span>
                )
              }
            />
            <InfoRow
              label="Rate-limit buckets"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Gauge aria-hidden="true" className="size-3.5 text-muted-foreground" />
                  {formatCount(data.rateLimits.activeBuckets)} active
                </span>
              }
            />
            <InfoRow
              label="Admin session expires"
              value={formatDateTime(data.session.expiresAt)}
            />
          </dl>
        </CardContent>
      </Card>

      {/* All-time public stats + limits */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck aria-hidden="true" className="size-4 text-emerald-600 dark:text-emerald-400" />
            Public stats (monotonic) &amp; limits
          </CardTitle>
          <CardDescription>
            Counters shown on the homepage — they survive retention purges.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl>
            <InfoRow label="Transfers created" value={formatCount(data.transfers.allTime.transfersCreated)} />
            <InfoRow label="Deliveries completed" value={formatCount(data.transfers.allTime.deliveriesCompleted)} />
            <InfoRow label="Files delivered" value={formatCount(data.transfers.allTime.filesDelivered)} />
            <InfoRow label="Bytes delivered" value={formatBytes(data.transfers.allTime.bytesDelivered)} />
            {sig && (
              <>
                <InfoRow label="Rooms cap" value={formatCount(sig.limits.maxRooms)} />
                <InfoRow label="Per-IP sockets" value={formatCount(sig.limits.maxConcurrentSocketsPerIp)} />
                <InfoRow label="Per-socket msgs / 10 s" value={formatCount(sig.limits.maxMessagesPerSocketPerWindow)} />
              </>
            )}
            {data.rateLimits.top.length > 0 && (
              <div className="mt-3 rounded-xl border bg-muted/30 p-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                  Busiest rate-limit buckets
                </p>
                <ul className="space-y-1">
                  {data.rateLimits.top.slice(0, 5).map((bucket, i) => (
                    <li key={`${bucket.type}-${i}`} className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono">{bucket.type}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {bucket.count} hits · resets in {bucket.resetInSec}s
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Server log tail */}
      <Card className="rounded-2xl lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal aria-hidden="true" className="size-4 text-slate-500" />
            Server log — dev.log tail
          </CardTitle>
          <CardDescription>
            <span className="inline-flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <Timer aria-hidden="true" className="size-3.5" />
                {formatCount(data.serverLog.lines.length)} lines · {formatBytes(data.serverLog.bytes)} file
              </span>
              {data.generatedAt && <span>refreshed {timeAgo(data.generatedAt)}</span>}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.serverLog.lines.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No server log output captured yet.
            </p>
          ) : (
            <ScrollArea className="h-80 rounded-xl border bg-muted/20">
              <div className="divide-y divide-border/40">
                {[...data.serverLog.lines].reverse().map((line, i) => (
                  <LogLine key={i} line={line} />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
