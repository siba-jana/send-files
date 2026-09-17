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
}
