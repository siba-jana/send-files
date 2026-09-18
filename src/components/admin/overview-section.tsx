"use client";

import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  Clock,
  Database,
  CircleAlert,
  FileStack,
  Info,
  Radio,
  Server,
  ShieldAlert,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type OverviewResponse,
  type PollingState,
  type SignalingSnapshot,
} from "@/components/admin/admin-api";
import {
  formatBytes,
  formatCount,
  formatUptime,
  shortToken,
  timeAgo,
} from "@/components/admin/admin-format";

const seriesConfig = {
  created: { label: "Created", color: "#e11d48" },
  completed: { label: "Completed", color: "#059669" },
} satisfies ChartConfig;

const errorSourceConfig = {
  count: { label: "Events" },
} satisfies ChartConfig;

const SOURCE_COLORS: Record<string, string> = {
  client: "#e11d48",
  api: "#d97706",
  signaling: "#059669",
  admin: "#64748b",
  page: "#9333ea",
  cleanup: "#0d9488",
};

function eventIcon(type: string) {
  switch (type) {
    case "completed":
      return <CheckCircle2 aria-hidden="true" className="size-4 text-emerald-600 dark:text-emerald-400" />;
    case "cancelled":
    case "expired":
      return <Clock aria-hidden="true" className="size-4 text-amber-600 dark:text-amber-400" />;
    case "receiver_joined":
      return <Users aria-hidden="true" className="size-4 text-rose-600 dark:text-rose-400" />;
    case "connection":
      return <Radio aria-hidden="true" className="size-4 text-emerald-600 dark:text-emerald-400" />;
    default:
      return <Activity aria-hidden="true" className="size-4 text-muted-foreground" />;
  }
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "rose" | "emerald" | "amber" | "red" | "slate";
}) {
  const tones: Record<string, string> = {
    rose: "bg-rose-600/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
    emerald: "bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
    amber: "bg-amber-600/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
    red: "bg-red-600/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
    slate: "bg-slate-600/10 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
  };
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 truncate text-2xl font-semibold tabular-nums tracking-tight">
              {value}
            </p>
            {sub && <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p>}
          </div>
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tones[tone ?? "slate"]}`}>
            {icon}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function HealthChip({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5">
      <span className="relative flex size-2.5">
        <span
          className={`absolute inline-flex h-full w-full rounded-full ${ok ? "animate-ping bg-emerald-500/60" : "bg-red-500/60"}`}
        />
        <span className={`relative inline-flex size-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium">{label}</p>
        <p className="truncate text-[11px] text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function signalingOk(s: SignalingSnapshot): s is Extract<SignalingSnapshot, { ok: true }> {
  return s.ok === true;
}

export function OverviewSection({ state }: { state: PollingState<OverviewResponse> }) {
  const { data, error, loading, refreshing, refresh, lastUpdated } = state;

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <CircleAlert aria-hidden="true" className="size-8 text-red-500" />
          <p className="text-sm text-muted-foreground">
            {error ?? "Overview unavailable."}
          </p>
          <Button variant="outline" onClick={() => void refresh()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const completed = data.transfers.byStatus.completed ?? 0;
  const cancelled = (data.transfers.byStatus.cancelled ?? 0) + (data.transfers.byStatus.expired ?? 0);
  const finished = completed + cancelled;
  const successRate = finished > 0 ? Math.round((completed / finished) * 100) : null;
  const sig = signalingOk(data.signaling) ? data.signaling : null;

  const errorSources = Object.entries(data.errors.bySource)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const chartData = data.series24h.map((p) => ({
    ...p,
    label: new Date(p.t).toLocaleTimeString(undefined, { hour: "2-digit" }),
  }));

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          icon={<ArrowDownToLine aria-hidden="true" className="size-5" />}
          label="Transfers"
          value={formatCount(data.transfers.total)}
          sub={`${formatCount(data.transfers.created24h)} created · 24 h`}
          tone="rose"
        />
        <StatCard
          icon={<CheckCircle2 aria-hidden="true" className="size-5" />}
          label="Completed"
          value={formatCount(data.transfers.allTime.deliveriesCompleted)}
          sub={successRate !== null ? `${successRate}% success rate` : "no finished transfers yet"}
          tone="emerald"
        />
        <StatCard
          icon={<FileStack aria-hidden="true" className="size-5" />}
          label="Files delivered"
          value={formatCount(data.transfers.allTime.filesDelivered)}
          sub={`${formatCount(data.transfers.files)} live rows`}
          tone="emerald"
        />
        <StatCard
          icon={<Database aria-hidden="true" className="size-5" />}
          label="Data delivered"
          value={formatBytes(data.transfers.allTime.bytesDelivered)}
          sub="P2P — never via this server"
          tone="slate"
        />
        <StatCard
          icon={<Radio aria-hidden="true" className="size-5" />}
          label="Live signaling"
          value={sig ? `${sig.sockets}` : "—"}
          sub={sig ? `${sig.rooms} rooms · up ${formatUptime(sig.uptimeSec)}` : "service unreachable"}
          tone={sig ? "emerald" : "red"}
        />
        <StatCard
          icon={data.errors.unresolved > 0 ? <ShieldAlert aria-hidden="true" className="size-5" /> : <CheckCircle2 aria-hidden="true" className="size-5" />}
          label="Unresolved errors"
          value={formatCount(data.errors.unresolved)}
          sub={`${formatCount(data.errors.last24h)} log events · 24 h`}
          tone={data.errors.unresolved > 0 ? "red" : "slate"}
        />
      </div>

      {/* Health strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <HealthChip ok label="Next.js API" detail={`up ${formatUptime(data.system.uptimeSec)}`} />
        <HealthChip
          ok={Boolean(sig)}
          label="Signaling :3003"
          detail={sig ? `pid ${sig.pid} · ${sig.counters.joins} joins` : "no response on :3004"}
        />
        <HealthChip ok label="SQLite" detail={`${formatBytes(data.system.dbBytes)} · ${formatCount(data.transfers.files)} file rows`} />
        <HealthChip
          ok={data.errors.unresolved === 0}
          label="Error log"
          detail={
            data.errors.unresolved === 0
              ? "all clear"
              : `${formatCount(data.errors.unresolved)} unresolved`
          }
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="rounded-2xl lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Activity — last 24 hours</CardTitle>
            <CardDescription>Transfers created vs. downloads completed, hourly.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={seriesConfig} className="aspect-auto h-64 w-full">
              <AreaChart data={chartData} margin={{ left: -18, right: 8, top: 6 }}>
                <defs>
                  <linearGradient id="fillCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e11d48" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#e11d48" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="fillCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={28} />
                <YAxis allowDecimals={false} width={36} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area dataKey="completed" type="monotone" stroke="#059669" fill="url(#fillCompleted)" strokeWidth={2} />
                <Area dataKey="created" type="monotone" stroke="#e11d48" fill="url(#fillCreated)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Log events by source</CardTitle>
            <CardDescription>All-time error/warn/info entries per origin.</CardDescription>
          </CardHeader>
          <CardContent>
            {errorSources.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
                <CheckCircle2 aria-hidden="true" className="size-8 text-emerald-500/70" />
                <p className="text-sm text-muted-foreground">No log events recorded yet.</p>
              </div>
            ) : (
              <ChartContainer config={errorSourceConfig} className="aspect-auto h-64 w-full">
                <BarChart data={errorSources} margin={{ left: -18, right: 8, top: 6 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="source" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} width={36} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={44}>
                    {errorSources.map((entry) => (
                      <Cell
                        key={entry.source}
                        fill={SOURCE_COLORS[entry.source] ?? "#94a3b8"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent transfer activity</CardTitle>
          <CardDescription>
            Latest lifecycle events across all transfers{" "}
            {lastUpdated && (
              <span className="text-muted-foreground/70">· updated {timeAgo(lastUpdated)}</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentEvents.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No transfer events yet — activity will appear here as visitors transfer files.
            </p>
          ) : (
            <ul className="divide-y">
              {data.recentEvents.map((event) => (
                <li key={event.id} className="flex items-center gap-3 py-2.5">
                  {eventIcon(event.eventType)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <span className="font-medium">{event.eventType.replace(/_/g, " ")}</span>
                      {" on "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                        {shortToken(event.token, 10)}
                      </code>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      transfer {event.transferStatus}
                      {event.metadata ? ` · ${event.metadata.slice(0, 80)}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {timeAgo(event.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {error && (
        <p className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle aria-hidden="true" className="size-3.5" />
          Last refresh failed ({error}) — showing cached data.{" "}
          <button onClick={() => void refresh()} className="underline underline-offset-2">
            {refreshing ? "Retrying…" : "Retry"}
          </button>
        </p>
      )}
    </div>
  );
}
