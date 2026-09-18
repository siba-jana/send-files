"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  CircleCheckBig,
  CircleX,
  Clock,
  Hourglass,
  KeyRound,
  LoaderCircle,
  LogIn,
  PackagePlus,
  ShieldCheck,
  Wifi,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export interface SessionLogEvent {
  eventType: string;
  createdAt: string;
  kind: string | null;
  role: string | null;
  state: string | null;
}

interface EventMeta {
  icon: LucideIcon;
  label: string;
  tone: "neutral" | "rose" | "emerald" | "amber";
}

/** Map a raw event row to a human label (safe fields only, server-whitelisted). */
function describeEvent(event: SessionLogEvent): EventMeta {
  switch (event.eventType) {
    case "created":
      return { icon: PackagePlus, label: "Transfer created", tone: "neutral" };
    case "receiver_joined":
      return {
        icon: LogIn,
        label:
          event.role === "receiver"
            ? "Recipient opened the transfer"
            : "Recipient session started",
        tone: "rose",
      };
    case "unlocked":
      return {
        icon: KeyRound,
        label: "Password entered — transfer unlocked",
        tone: "rose",
      };
    case "connection":
      return event.kind === "relay"
        ? {
            icon: ShieldCheck,
            label: "Secure relay connection established",
            tone: "amber",
          }
        : {
            icon: ArrowLeftRight,
            label: "Direct P2P connection established",
            tone: "emerald",
          };
    case "completed":
      return {
        icon: CircleCheckBig,
        label: "Recipient confirmed the download",
        tone: "emerald",
      };
    case "cancelled":
      return { icon: CircleX, label: "Transfer cancelled", tone: "neutral" };
    case "expired":
      return { icon: Hourglass, label: "Transfer expired", tone: "neutral" };
    case "state":
      return { icon: Wifi, label: `State: ${event.state ?? "updated"}`, tone: "neutral" };
    default:
      return { icon: Clock, label: event.eventType, tone: "neutral" };
  }
}

function formatEventTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const TONE_DOT: Record<EventMeta["tone"], string> = {
  neutral: "bg-muted-foreground/40",
  rose: "bg-rose-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
};

export interface SessionLogProps {
  token: string;
  /** Secret auth token for the viewing party (senderToken or receiverToken). */
  authToken: string;
  /** Which party is viewing — picks the matching query parameter. */
  role: "sender" | "receiver";
  /** Poll while true (e.g. the transfer is waiting); otherwise fetch once. */
  live: boolean;
  className?: string;
}

/**
 * Party observability: a compact timeline of everything the server recorded
 * about this transfer. Polls every 10 s while `live`, otherwise fetches once
 * on mount. Degrades silently when the API is unreachable (the log is a
 * nicety, never critical UI).
 */
export function SessionLog({ token, authToken, role, live, className }: SessionLogProps) {
  const [events, setEvents] = useState<SessionLogEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!token || !authToken) return;

    const fetchEvents = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const param = role === "sender" ? "senderToken" : "receiverToken";
        const res = await fetch(
          `/api/transfers/${encodeURIComponent(token)}/events?${param}=${encodeURIComponent(authToken)}`,
          { headers: { Accept: "application/json" } },
        );
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as { events: SessionLogEvent[] };
        setEvents(data.events);
      } catch {
        setFailed(true);
      } finally {
        inFlight.current = false;
      }
    };

    void fetchEvents();
    if (!live) return;
    const id = window.setInterval(() => void fetchEvents(), 10_000);
    return () => window.clearInterval(id);
  }, [token, authToken, role, live]);

  if (failed) return null;

  const rows = events ?? [];

  // Both peers may log the same connection event (each reports its view of
  // the ICE state). Collapse consecutive identical labels within the same
  // second into a single row so the timeline reads clean.
  const deduped: SessionLogEvent[] = [];
  for (const event of rows) {
    const prev = deduped[deduped.length - 1];
    if (
      prev &&
      prev.eventType === event.eventType &&
      (prev.kind ?? null) === (event.kind ?? null) &&
      Math.abs(new Date(prev.createdAt).getTime() - new Date(event.createdAt).getTime()) < 1500
    ) {
      continue;
    }
    deduped.push(event);
  }

  return (
    <div className={cn("rounded-xl border bg-muted/20 p-4", className)}>
      <p className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Clock aria-hidden="true" className="size-4" />
        Session log
        {live && events === null && (
          <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
        )}
      </p>
      {events === null ? (
        <p className="mt-2 text-xs text-muted-foreground">
          <LoaderCircle aria-hidden="true" className="mr-1 inline size-3 animate-spin" />
          Loading transfer history…
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          No events recorded yet.
        </p>
      ) : (
        <ol className="mt-2.5 space-y-0.5">
          {deduped.map((event, i) => {
            const { icon: Icon, label, tone } = describeEvent(event);
            return (
              <li
                key={`${event.createdAt}-${i}`}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/60"
              >
                <span
                  aria-hidden="true"
                  className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[tone])}
                />
                <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-xs text-foreground/90" title={label}>
                  {label}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatEventTime(event.createdAt)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
