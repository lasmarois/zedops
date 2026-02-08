/**
 * ANSI formatting utilities for log lines
 *
 * Converts structured log data into ANSI-colored strings
 * for rendering in xterm.js terminals.
 */

import type { AgentLogLine } from '../hooks/useAgentLogStream'
import type { LogLine as ContainerLogLine } from '../hooks/useLogStream'

// ANSI escape codes
const RESET = '\x1b[0m'
const DIM_GRAY = '\x1b[90m'       // timestamps
const GREEN = '\x1b[32m'          // INFO
const YELLOW = '\x1b[33m'         // WARN
const BOLD_RED = '\x1b[1;31m'     // ERROR
const DIM = '\x1b[2;90m'          // DEBUG
const RED = '\x1b[31m'            // stderr

// Level badge: Unicode icon + color (matches original Lucide icons)
const LEVEL_BADGES: Record<string, { icon: string; color: string }> = {
  INFO:  { icon: 'ℹ', color: GREEN },      // Lucide: Info
  WARN:  { icon: '⚠', color: YELLOW },     // Lucide: AlertTriangle
  ERROR: { icon: '✖', color: BOLD_RED },   // Lucide: XCircle
  DEBUG: { icon: '⚙', color: DIM },        // Lucide: Bug
}

/** Format timestamp (ms) to HH:MM:SS.mmm */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  const ms = String(date.getMilliseconds()).padStart(3, '0')
  return `${h}:${m}:${s}.${ms}`
}

/** Format an agent log line with ANSI colors */
export function formatAgentLogLine(log: AgentLogLine): string {
  const ts = `${DIM_GRAY}${formatTimestamp(log.timestamp)}${RESET}`
  const badge = LEVEL_BADGES[log.level]
  const level = badge
    ? `${badge.color}${badge.icon} ${log.level}${RESET}`
    : `${DIM_GRAY}${log.level}${RESET}`
  const msgColor = log.level === 'ERROR' ? BOLD_RED : log.level === 'DEBUG' ? DIM : ''
  const msgReset = msgColor ? RESET : ''
  return `${ts} ${level} ${msgColor}${log.message}${msgReset}`
}

/** Format a container log line with ANSI colors */
export function formatContainerLogLine(log: ContainerLogLine): string {
  const ts = `${DIM_GRAY}${formatTimestamp(log.timestamp)}${RESET}`
  if (log.stream === 'stderr') {
    return `${ts} ${RED}⚠ stderr${RESET} ${RED}${log.message}${RESET}`
  }
  return `${ts} ${log.message}`
}
