"use client";

import { useEffect } from "react";

/**
 * Last-resort error boundary (Next.js convention file): catches errors in
 * the ROOT layout itself, where `error.tsx` can no longer help. Must render
 * its own <html>/<body>. Styles are inlined — assume nothing else loads.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled root error:", error);
    // Inline best-effort report (keep this boundary dependency-light —
    // assume nothing else loads). See src/lib/client-error.ts.
    try {
      void fetch("/api/log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          level: "error",
          message: `RootError: ${error.message}`.slice(0, 2000),
          stack: error.stack?.slice(0, 8000),
          context: { boundary: "root", digest: error.digest },
        }),
      }).catch(() => {});
    } catch {
      /* swallow */
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          backgroundColor: "#ffffff",
          color: "#0f172a",
        }}
      >
        <div style={{ maxWidth: 420, padding: 32, textAlign: "center" }}>
          <div
            style={{
              width: 48,
              height: 48,
              margin: "0 auto 20px",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(225,29,72,0.1)",
              color: "#e11d48",
              fontSize: 22,
            }}
          >
            ✕
          </div>
          <h1 style={{ fontSize: 20, margin: "0 0 8px", fontWeight: 600 }}>
            I Love Doc couldn&apos;t load
          </h1>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              margin: "0 0 24px",
              color: "#64748b",
            }}
          >
            A critical error occurred while starting the app. Trying again
            usually fixes it.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              height: 40,
              padding: "0 24px",
              border: "none",
              borderRadius: 12,
              backgroundColor: "#e11d48",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
