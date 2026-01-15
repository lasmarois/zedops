/**
 * Terminal Log Component
 *
 * A sleek, theme-aware terminal-style log viewer that integrates
 * with the midnight blue theme. Professional, dark aesthetic.
 */

import { forwardRef, useRef, useImperativeHandle, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Info, AlertTriangle, XCircle, Bug, Terminal, AlertOctagon } from 'lucide-react'

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

// Level styling - muted, professional colors
const levelConfig: Record<string, { icon: typeof Info; color: string; bg: string }> = {
  INFO: {
    icon: Info,
    color: 'text-emerald-400/70',
    bg: 'bg-emerald-500/5',
  },
  WARN: {
    icon: AlertTriangle,
    color: 'text-amber-400/80',
    bg: 'bg-amber-500/8',
  },
  ERROR: {
    icon: XCircle,
    color: 'text-red-400/90',
    bg: 'bg-red-500/10',
  },
  DEBUG: {
    icon: Bug,
    color: 'text-slate-400/60',
    bg: 'bg-slate-500/5',
  },
}

// Stream styling - subtle differentiation
const streamConfig: Record<string, { icon: typeof Terminal; color: string; bg: string }> = {
  stdout: {
    icon: Terminal,
    color: 'text-emerald-400/60',
    bg: 'bg-transparent',
  },
  stderr: {
    icon: AlertOctagon,
    color: 'text-red-400/70',
    bg: 'bg-red-500/5',
  },
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
          'font-mono text-[13px] leading-relaxed',
          // Very dark background for serious terminal look
          'bg-[hsl(220_50%_4%)] rounded-lg border border-slate-800/50',
          // Subtle inner shadow for depth
          'shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]',
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
            logs.map((log, index) => {
              const level = log.level ? levelConfig[log.level] : null
              const stream = log.stream ? streamConfig[log.stream] : null
              const LevelIcon = level?.icon
              const StreamIcon = stream?.icon

              return (
                <div
                  key={`${log.timestamp}-${index}`}
                  className={cn(
                    'group flex items-start gap-2.5 py-1 -mx-2 px-2 rounded',
                    'hover:bg-white/[0.015] transition-colors duration-75',
                    // Subtle background for different levels/streams
                    level?.bg,
                    stream?.bg
                  )}
                >
                  {/* Timestamp */}
                  {showTimestamp && (
                    <span className="flex-shrink-0 text-slate-500/70 select-none tabular-nums text-xs pt-0.5">
                      {formatTimestamp(log.timestamp)}
                    </span>
                  )}

                  {/* Level icon */}
                  {showLevel && LevelIcon && (
                    <span className={cn('flex-shrink-0 pt-0.5', level?.color)}>
                      <LevelIcon className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                  )}

                  {/* Stream icon */}
                  {showStream && StreamIcon && (
                    <span className={cn('flex-shrink-0 pt-0.5', stream?.color)}>
                      <StreamIcon className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                  )}

                  {/* Message */}
                  <span className="flex-1 text-slate-300/90 whitespace-pre-wrap break-words">
                    {log.message}
                  </span>
                </div>
              )
            })
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
