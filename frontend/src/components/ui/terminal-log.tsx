/**
 * Terminal Log Component
 *
 * A sleek, theme-aware terminal-style log viewer that integrates
 * with the midnight blue theme. Replaces hardcoded Dracula colors.
 */

import { forwardRef, useRef, useImperativeHandle, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Log entry types
export interface LogLine {
  timestamp: number
  message: string
  level?: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
  stream?: 'stdout' | 'stderr'
}

interface TerminalLogProps {
  logs: LogLine[]
  emptyMessage?: string
  showTimestamp?: boolean
  showLevel?: boolean
  showStream?: boolean
  className?: string
  children?: ReactNode
}

export interface TerminalLogRef {
  scrollToBottom: () => void
}

// Level color classes using theme variables
const levelColors: Record<string, string> = {
  INFO: 'text-success',
  WARN: 'text-warning',
  ERROR: 'text-error',
  DEBUG: 'text-info',
}

// Stream color classes
const streamColors: Record<string, string> = {
  stdout: 'text-success',
  stderr: 'text-error',
}

// Format timestamp to HH:MM:SS.mmm
const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  })
}

export const TerminalLog = forwardRef<TerminalLogRef, TerminalLogProps>(
  ({ logs, emptyMessage, showTimestamp = true, showLevel = true, showStream = false, className, children }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const endRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(ref, () => ({
      scrollToBottom: () => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' })
      },
    }))

    return (
      <div
        ref={containerRef}
        className={cn(
          // Base terminal styling
          'font-mono text-sm leading-relaxed',
          // Theme-aware background - slightly darker than card for contrast
          'bg-[hsl(220_45%_8%)] rounded-lg border border-border/50',
          // Inner glow effect for depth
          'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]',
          // Scrolling
          'overflow-auto',
          // Default sizing
          'min-h-[200px]',
          className
        )}
      >
        {/* Scanline overlay for retro terminal feel */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.02)_50%)] bg-[length:100%_4px] rounded-lg" />

        {/* Log content */}
        <div className="relative p-4 space-y-0.5">
          {logs.length === 0 ? (
            <div className="text-muted-foreground/60 text-center py-8 select-none">
              <div className="inline-flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/30 animate-pulse" />
                {emptyMessage || 'Waiting for output...'}
              </div>
            </div>
          ) : (
            logs.map((log, index) => (
              <div
                key={`${log.timestamp}-${index}`}
                className={cn(
                  'group flex items-start gap-2 py-0.5 -mx-2 px-2 rounded',
                  'hover:bg-white/[0.02] transition-colors duration-75',
                  // Highlight errors
                  log.level === 'ERROR' && 'bg-error/5 hover:bg-error/10',
                  log.stream === 'stderr' && 'bg-error/5 hover:bg-error/10'
                )}
              >
                {/* Timestamp */}
                {showTimestamp && (
                  <span className="flex-shrink-0 text-muted-foreground/50 select-none tabular-nums">
                    {formatTimestamp(log.timestamp)}
                  </span>
                )}

                {/* Level badge */}
                {showLevel && log.level && (
                  <span
                    className={cn(
                      'flex-shrink-0 font-semibold w-14 select-none',
                      levelColors[log.level] || 'text-foreground'
                    )}
                  >
                    [{log.level}]
                  </span>
                )}

                {/* Stream badge */}
                {showStream && log.stream && (
                  <span
                    className={cn(
                      'flex-shrink-0 font-semibold w-16 select-none',
                      streamColors[log.stream] || 'text-foreground'
                    )}
                  >
                    [{log.stream}]
                  </span>
                )}

                {/* Message */}
                <span className="flex-1 text-foreground/90 whitespace-pre-wrap break-words">
                  {log.message}
                </span>
              </div>
            ))
          )}

          {/* Scroll anchor */}
          <div ref={endRef} />
        </div>

        {/* Optional children (e.g., toolbar overlay) */}
        {children}
      </div>
    )
  }
)

TerminalLog.displayName = 'TerminalLog'

// Toolbar component for log viewer controls
interface TerminalToolbarProps {
  children: ReactNode
  className?: string
}

export function TerminalToolbar({ children, className }: TerminalToolbarProps) {
  return (
    <div
      className={cn(
        'sticky top-0 z-10 flex items-center gap-3 p-3',
        'bg-gradient-to-b from-[hsl(220_45%_10%)] to-transparent',
        'border-b border-border/30',
        className
      )}
    >
      {children}
    </div>
  )
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
