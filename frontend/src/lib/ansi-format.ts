/**
 * ANSI formatting utilities for log lines
 *
 * Converts structured log data into ANSI-colored strings
 * for rendering in react-logviewer's LazyLog component.
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

// Level ANSI colors
const LEVEL_COLORS: Record<string, string> = {
  INFO: GREEN,
  WARN: YELLOW,
  ERROR: BOLD_RED,
  DEBUG: DIM,
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
  const levelColor = LEVEL_COLORS[log.level] || DIM_GRAY
  // Use a marker token that formatPart will detect and replace with a Lucide icon
  const level = `${levelColor}@@LEVEL:${log.level}@@${RESET}`
  const msgColor = log.level === 'ERROR' ? BOLD_RED : log.level === 'DEBUG' ? DIM : ''
  const msgReset = msgColor ? RESET : ''
  return `${ts} ${level} ${msgColor}${log.message}${msgReset}`
}

/** Format a container log line with ANSI colors */
export function formatContainerLogLine(log: ContainerLogLine): string {
  const ts = `${DIM_GRAY}${formatTimestamp(log.timestamp)}${RESET}`
  if (log.stream === 'stderr') {
    return `${ts} ${RED}@@STREAM:stderr@@ ${log.message}${RESET}`
  }
  return `${ts} @@STREAM:stdout@@ ${log.message}`
}
