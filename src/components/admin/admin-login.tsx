"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, ShieldCheck, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminFetch } from "@/components/admin/admin-api";

/**
 * Admin console sign-in. Single operator credentials (ADMIN_USERNAME &
 * ADMIN_PASSWORD env on the server, dev defaults with an on-screen hint while unset).
 */
export function AdminLogin({
  onAuthenticated,
  usingDefaultPassword,
}: {
  onAuthenticated: (username?: string) => void;
  usingDefaultPassword?: boolean | null;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingDefault, setUsingDefault] = useState<boolean | null>(
    usingDefaultPassword ?? null
  );

  useEffect(() => {
    if (usingDefaultPassword !== undefined && usingDefaultPassword !== null) {
      setUsingDefault(usingDefaultPassword);
    }
  }, [usingDefaultPassword]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !username.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const res = await adminFetch<{ ok: boolean; usingDefaultPassword: boolean }>(
        "/api/admin/login",
        { method: "POST", body: JSON.stringify({ username: username.trim(), password }) }
      );
      setUsingDefault(res.usingDefaultPassword);
      if (res.ok) {
        onAuthenticated(username.trim());
        return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === "invalid_credentials") {
        setError("Incorrect username or password. Try again.");
      } else if (message === "rate_limited") {
        setError("Too many attempts — wait a few minutes before retrying.");
      } else {
        setError(message === "unauthorized" ? "Session expired." : `Sign-in failed: ${message}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-gradient-to-b from-background to-muted/40 px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-rose-600/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
              <ShieldCheck aria-hidden="true" className="size-7" />
            </span>
            <h1 className="mt-5 text-xl font-semibold tracking-tight">
              I Love Doc — Admin
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Sign in to open the monitoring console.
            </p>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-username">Username</Label>
              <div className="relative">
                <User
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="admin-username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-11 pl-9 pr-3"
                  placeholder="admin"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <div className="relative">
                <KeyRound
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="admin-password"
                  type={reveal ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pl-9 pr-11"
                  placeholder="••••••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setReveal((v) => !v)}
                  aria-label={reveal ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {reveal ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={busy || !username.trim() || !password}
              className="h-11 w-full rounded-xl bg-rose-600 shadow-lg shadow-rose-600/25 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600"
            >
              {busy ? (
                <>
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          {usingDefault === true && (
            <p className="mt-5 rounded-xl bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
              Default credentials: username{" "}
              <code className="rounded bg-amber-500/15 px-1 py-0.5 font-mono">admin</code>, password{" "}
              <code className="rounded bg-amber-500/15 px-1 py-0.5 font-mono">ilovedoc-admin</code>.
              Set <code className="font-mono">ADMIN_USERNAME</code> and <code className="font-mono">ADMIN_PASSWORD</code> in production to remove this hint.
            </p>
          )}
        </div>

        <p className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to ilovedoc.org
          </Link>
        </p>
      </div>
    </main>
  );
}
