/**
 * Terminal Log Utilities
 *
 * Shared types and components used by log viewers.
 * The main terminal rendering is now handled by XTermLogViewer (xterm.js).
 */

import { cn } from '@/lib/utils'

// Log entry type — used by viewer components for filtering
export interface LogLine {
  timestamp: number
  message: string
  level?: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
  stream?: 'stdout' | 'stderr'
}

// Status indicator component
interface TerminalStatusProps {
  status: 'connected' | 'disconnected' | 'streaming' | 'paused' | 'offline'
  label?: string
}

export function TerminalStatus({ status, label }: TerminalStatusProps) {
  const statusConfig = {
    connected: { color: 'bg-success', pulse: false, text: 'Connected' },
    disconnected: { color: 'bg-error', pulse: false, text: 'Disconnected' },
    streaming: { color: 'bg-success', pulse: true, text: 'Streaming' },
    paused: { color: 'bg-warning', pulse: false, text: 'Paused' },
    offline: { color: 'bg-warning', pulse: false, text: 'Offline' },
  }

  const config = statusConfig[status]

  return (
    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <span className="relative flex h-2 w-2">
        {config.pulse && (
          <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping', config.color)} />
        )}
        <span className={cn('relative inline-flex rounded-full h-2 w-2', config.color)} />
      </span>
      <span>{label || config.text}</span>
    </div>
  )
}

// Line count display
interface TerminalLineCountProps {
  filtered: number
  total: number
}

export function TerminalLineCount({ filtered, total }: TerminalLineCountProps) {
  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      {filtered === total ? (
        <>{total.toLocaleString()} lines</>
      ) : (
        <>{filtered.toLocaleString()} / {total.toLocaleString()} lines</>
      )}
    </span>
  )
}
