/**
 * Client-side error reporter for the admin console error log (Task 16).
 *
 * Fire-and-forget POST to the public /api/log endpoint (rate-limited +
 * sanitized server-side). Never throws, never retries, never blocks the
 * caller — observability must not break the app it observes.
 */

export interface ClientErrorReport {
  message: string
  stack?: string
  url?: string
  context?: Record<string, unknown>
}

export function reportClientError(
  report: ClientErrorReport,
  level: 'error' | 'warn' | 'info' = 'error'
): void {
  if (typeof window === 'undefined') return
  try {
    const body = JSON.stringify({
      level,
      message: report.message.slice(0, 2000),
      stack: report.stack?.slice(0, 8000),
      url: window.location.href.slice(0, 500),
      userAgent: navigator.userAgent.slice(0, 400),
      context: report.context,
    })
    // keepalive lets the request survive page unloads/navigation.
    void fetch('/api/log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      /* swallow — best effort only */
    })
  } catch {
    /* swallow */
  }
}

/** Format an unknown thrown value the way the boundaries receive it. */
export function errorToReport(
  err: unknown,
  extra?: Record<string, unknown>
): ClientErrorReport {
  if (err instanceof Error) {
    return {
      message: `${err.name}: ${err.message}`,
      stack: err.stack,
      context: { digest: (err as Error & { digest?: string }).digest, ...extra },
    }
  }
  return { message: String(err), context: extra }
}
