import { appendFileSync } from 'node:fs'

/**
 * Timestamped lifecycle logging (SPEC §5: "Log to stdout (lifecycle + errors only)").
 * Tokens, secrets and file contents are NEVER logged — only roles, counts and outcomes.
 * Set SIGNALING_LOG to mirror log lines into a file as well.
 */
const logFilePath = process.env.SIGNALING_LOG

function mirror(line: string): void {
  if (!logFilePath) return
  try {
    appendFileSync(logFilePath, line + '\n')
  } catch {
    /* best effort — never let logging break the service */
  }
}

/** In-memory ring of recent errors, surfaced via the internal stats endpoint
 *  (Task 16 admin console). Survives `bun --hot` reloads via globalThis. */
export interface RecentError {
  ts: number
  scope: string
  message: string
}

const globalForLog = globalThis as unknown as {
  __ilovedocSigErrors?: RecentError[]
}
const recentErrors: RecentError[] = globalForLog.__ilovedocSigErrors ?? []
globalForLog.__ilovedocSigErrors = recentErrors

const MAX_RECENT_ERRORS = 50

function rememberError(scope: string, detail: string): void {
  recentErrors.push({ ts: Date.now(), scope, message: detail })
  if (recentErrors.length > MAX_RECENT_ERRORS) {
    recentErrors.splice(0, recentErrors.length - MAX_RECENT_ERRORS)
  }
}

/** Newest-first copy of the recent error ring (max 30). */
export function takeRecentErrors(): RecentError[] {
  return recentErrors.slice(-30).reverse()
}

export function log(scope: string, message: string): void {
  const line = `[${new Date().toISOString()}] [${scope}] ${message}`
  console.log(line)
  mirror(line)
}

export function logError(scope: string, message: string, err?: unknown): void {
  const detail =
    err instanceof Error ? `${err.name}: ${err.message}` : err === undefined ? '' : String(err)
  const line = `[${new Date().toISOString()}] [${scope}] ${message}${detail ? ` — ${detail}` : ''}`
  console.error(line)
  mirror(line)
  rememberError(scope, `${message}${detail ? ` — ${detail}` : ''}`)
}
