"use client";

import { useState, useSyncExternalStore } from "react";
import { Toaster } from "sonner";
import {
  ArrowDownToLine,
  ExternalLink,
  LayoutDashboard,
  Loader2,
  LogOut,
  RefreshCw,
  ScrollText,
  Server,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/site/logo";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { toast } from "sonner";
import {
  adminFetch,
  usePolling,
  type OverviewResponse,
} from "@/components/admin/admin-api";
import { timeAgo } from "@/components/admin/admin-format";
import { OverviewSection } from "@/components/admin/overview-section";
import { TransfersSection } from "@/components/admin/transfers-section";
import { LogsSection } from "@/components/admin/logs-section";
import { SystemSection } from "@/components/admin/system-section";

type SectionId = "overview" | "transfers" | "logs" | "system";

const NAV: Array<{ id: SectionId; label: string; icon: React.ReactNode }> = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard aria-hidden="true" className="size-4" /> },
  { id: "transfers", label: "Transfers", icon: <ArrowDownToLine aria-hidden="true" className="size-4" /> },
  { id: "logs", label: "Error Logs", icon: <ScrollText aria-hidden="true" className="size-4" /> },
  { id: "system", label: "System", icon: <Server aria-hidden="true" className="size-4" /> },
];

// Sonner theme follows the manual `.dark` class toggle used by the ThemeToggle
// (same MutationObserver pattern as transfer-widget.tsx).
function subscribeToDarkClass(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getDarkSnapshot(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function AdminDashboard({ onSignedOut }: { onSignedOut: () => void }) {
  const [section, setSection] = useState<SectionId>("overview");
  const [signingOut, setSigningOut] = useState(false);
  const isDark = useSyncExternalStore(
    subscribeToDarkClass,
    getDarkSnapshot,
    () => false
  );

  // One overview poll powers the Overview + System sections and the header
  // badges (only the active section renders, so there's exactly one consumer).
  const overview = usePolling<OverviewResponse>(
    () => adminFetch<OverviewResponse>("/api/admin/overview"),
    15_000
  );

  const unresolved = overview.data?.errors.unresolved ?? 0;

  async function signOut() {
    setSigningOut(true);
    try {
      await adminFetch("/api/admin/logout", { method: "POST" });
      toast.success("Signed out");
      onSignedOut();
    } catch {
      toast.error("Sign-out failed");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          <a href="/" aria-label="I Love Doc — homepage" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Logo />
          </a>
          <Badge
            variant="outline"
            className="hidden border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400 sm:inline-flex"
          >
            Admin console
          </Badge>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <span className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              Live
              {overview.lastUpdated && (
                <span className="tabular-nums text-muted-foreground">
                  · {timeAgo(overview.lastUpdated)}
                </span>
              )}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void overview.refresh()}
              aria-label="Refresh data"
              className="size-10 text-muted-foreground hover:text-foreground md:size-9"
            >
              <RefreshCw aria-hidden="true" className={`size-4 ${overview.refreshing ? "animate-spin" : ""}`} />
            </Button>
            <ThemeToggle />
            <Button variant="ghost" size="sm" className="hidden h-9 gap-2 text-muted-foreground hover:text-foreground sm:inline-flex" asChild>
              <a href="/">
                <ExternalLink aria-hidden="true" className="size-4" />
                View site
              </a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void signOut()}
              disabled={signingOut}
              className="h-9 gap-2 text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
            >
              {signingOut ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <LogOut aria-hidden="true" className="size-4" />
              )}
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6">
        {/* Sidebar (desktop) */}
        <nav aria-label="Admin sections" className="hidden w-52 shrink-0 md:block">
          <ul className="sticky top-22 space-y-1">
            {NAV.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSection(item.id)}
                  aria-current={section === item.id ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    section === item.id
                      ? "bg-rose-600/10 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {item.icon}
                  {item.label}
                  {item.id === "logs" && unresolved > 0 && (
                    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold tabular-nums text-white">
                      {unresolved > 99 ? "99+" : unresolved}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-6 border-t pt-4 text-[11px] leading-relaxed text-muted-foreground">
            ilovedoc.org monitoring — transfers, error log, signaling health and system
            state. File bytes never touch this server (WebRTC P2P).
          </p>
        </nav>

        {/* Content */}
        <main className="min-w-0 flex-1">
          {/* Mobile section switcher */}
          <div className="mb-4 md:hidden" role="tablist" aria-label="Admin sections">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {NAV.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={section === item.id}
                  onClick={() => setSection(item.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors ${
                    section === item.id
                      ? "border-rose-500/40 bg-rose-600/10 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.icon}
                  {item.label}
                  {item.id === "logs" && unresolved > 0 && (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold tabular-nums text-white">
                      {unresolved > 99 ? "99+" : unresolved}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {section === "overview" && <OverviewSection state={overview} />}
          {section === "transfers" && <TransfersSection />}
          {section === "logs" && <LogsSection unresolvedCount={unresolved} />}
          {section === "system" && <SystemSection state={overview} />}
        </main>
      </div>

      <footer className="mt-auto border-t bg-muted/30">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-4 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} I Love Doc — admin console</p>
          <p>
            Data source: SQLite metadata + live service stats · polling every 15 s
          </p>
        </div>
      </footer>

      {/* Toast notifications (resolve/clear/sign-out feedback) */}
      <Toaster richColors position="top-center" theme={isDark ? "dark" : "light"} />
    </div>
  );
}
