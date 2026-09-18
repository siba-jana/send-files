"use client";

import { useCallback, useEffect, useState } from "react";

import { adminFetch, type SessionResponse } from "@/components/admin/admin-api";
import { AdminLogin } from "@/components/admin/admin-login";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

/**
 * Admin console root (rendered by `/` when ?admin=1 is present).
 *
 * Client-side session gate: checks /api/admin/session on mount, shows the
 * login screen or the dashboard, and flips back to login whenever an admin
 * API answers 401 (session expired) — adminFetch dispatches the
 * "ilovedoc:admin-unauthorized" window event.
 */
export function AdminApp() {
  const [phase, setPhase] = useState<"checking" | "anon" | "authed">("checking");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const session = await adminFetch<SessionResponse>("/api/admin/session");
        if (!cancelled) setPhase(session.authenticated ? "authed" : "anon");
      } catch {
        if (!cancelled) setPhase("anon");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setPhase("anon");
    window.addEventListener("ilovedoc:admin-unauthorized", onUnauthorized);
    return () => window.removeEventListener("ilovedoc:admin-unauthorized", onUnauthorized);
  }, []);

  const handleAuthenticated = useCallback(() => setPhase("authed"), []);
  const handleSignedOut = useCallback(() => setPhase("anon"), []);

  if (phase === "checking") {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <span className="relative flex size-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500/60" />
            <span className="relative inline-flex size-3 rounded-full bg-rose-500" />
          </span>
          <p className="text-sm">Checking admin session…</p>
        </div>
      </div>
    );
  }

  if (phase === "anon") {
    return <AdminLogin onAuthenticated={handleAuthenticated} />;
  }

  return <AdminDashboard onSignedOut={handleSignedOut} />;
}
