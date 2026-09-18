"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { errorToReport, reportClientError } from "@/lib/client-error";

/**
 * Route-segment error boundary for `/` (Next.js convention file — not a
 * separate route). Renders inside the root layout, so chrome stays intact.
 * Kept deliberately dependency-light: plain elements + Tailwind only, so a
 * broken component import doesn't take the fallback down with it.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface for observability (server logs / error reporting hookup point).
    console.error("Unhandled application error:", error);
    reportClientError(errorToReport(error, { boundary: "route-segment" }), "error");
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-24">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-rose-600/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
          <AlertTriangle aria-hidden="true" className="size-6" />
        </span>
        <h1 className="mt-5 text-xl font-semibold tracking-tight">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The page hit an unexpected error. If you were mid-transfer, the other
          party will see the connection drop — you can start again in a few
          seconds.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-muted-foreground/70">
            Reference: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          autoFocus
          className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 text-sm font-medium text-white shadow-lg shadow-rose-600/25 transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-rose-500 dark:hover:bg-rose-600"
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
