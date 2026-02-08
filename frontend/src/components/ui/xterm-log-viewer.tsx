/**
 * LazyLog-based Log Viewer
 *
 * Virtualized DOM-based log viewer using @melloware/react-logviewer.
 * Supports ANSI colors, Lucide icon injection via formatPart,
 * follow mode, and search.
 */

import { useMemo, useCallback, forwardRef, useImperativeHandle, useRef, useState, useEffect, createElement } from 'react'
import { LazyLog } from '@melloware/react-logviewer'
import { cn } from '@/lib/utils'
import { Info, AlertTriangle, XCircle, Bug, AlertOctagon } from 'lucide-react'

export interface XTermLogViewerProps {
  /** Pre-formatted ANSI strings to display */
  lines: string[]
  /** Auto-scroll to bottom on new lines (default true) */
  follow?: boolean
  /** Callback when follow mode changes */
  onFollowChange?: (following: boolean) => void
  /** Search term for highlighting */
  searchTerm?: string
  /** Additional CSS classes */
  className?: string
  /** Message to show when no lines */
  emptyMessage?: string
}

export interface XTermLogViewerRef {
  clear: () => void
  scrollToBottom: () => void
  scrollToTop: () => void
  findNext: () => void
  findPrevious: () => void
}

// Lucide icon configs for log levels
const LEVEL_ICONS: Record<string, { icon: typeof Info; className: string }> = {
  INFO:  { icon: Info,          className: 'text-emerald-400/80' },
  WARN:  { icon: AlertTriangle, className: 'text-amber-400/90' },
  ERROR: { icon: XCircle,       className: 'text-red-400' },
  DEBUG: { icon: Bug,           className: 'text-slate-400/60' },
}

const STREAM_ICONS: Record<string, { icon: typeof AlertOctagon; className: string }> = {
  stderr: { icon: AlertOctagon, className: 'text-red-400/80' },
}

/**
 * formatPart callback for LazyLog — intercepts marker tokens
 * like @@LEVEL:INFO@@ and replaces them with inline Lucide icons + text.
 */
function formatPart(text: string): React.ReactNode {
  // Check for level marker: @@LEVEL:INFO@@
  const levelMatch = text.match(/@@LEVEL:(\w+)@@/)
  if (levelMatch) {
    const level = levelMatch[1]
    const config = LEVEL_ICONS[level]
    if (config) {
      return createElement('span', {
        style: { display: 'inline-flex', alignItems: 'center', gap: '3px', verticalAlign: 'middle' },
      },
        createElement(config.icon, {
          className: config.className,
          style: { width: 13, height: 13, display: 'inline-block', verticalAlign: 'middle' },
          strokeWidth: 2.5,
        }),
        createElement('span', null, level),
      )
    }
  }

  // Check for stream marker: @@STREAM:stderr@@
  const streamMatch = text.match(/@@STREAM:(\w+)@@/)
  if (streamMatch) {
    const stream = streamMatch[1]
    const config = STREAM_ICONS[stream]
    if (config) {
      return createElement('span', {
        style: { display: 'inline-flex', alignItems: 'center', gap: '3px', verticalAlign: 'middle' },
      },
        createElement(config.icon, {
          className: config.className,
          style: { width: 13, height: 13, display: 'inline-block', verticalAlign: 'middle' },
          strokeWidth: 2.5,
        }),
        createElement('span', null, stream),
      )
    }
  }

  return text
}

export const XTermLogViewer = forwardRef<XTermLogViewerRef, XTermLogViewerProps>(
  (
    {
      lines,
      follow = true,
      onFollowChange,
      searchTerm,
      className,
      emptyMessage,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const [containerHeight, setContainerHeight] = useState(0)

    // Measure container height with ResizeObserver
    useEffect(() => {
      const el = containerRef.current
      if (!el) return

      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerHeight(entry.contentRect.height)
        }
      })
      observer.observe(el)
      // Initial measurement
      setContainerHeight(el.clientHeight)
      return () => observer.disconnect()
    }, [])

    // Join lines into single text blob for LazyLog
    const text = useMemo(() => {
      if (lines.length === 0) return ''
      return lines.join('\n')
    }, [lines])

    const handleScroll = useCallback(({ scrollTop, scrollHeight, clientHeight }: {
      scrollTop: number
      scrollHeight: number
      clientHeight: number
    }) => {
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
      if (!isAtBottom && follow) {
        onFollowChange?.(false)
      }
    }, [follow, onFollowChange])

    useImperativeHandle(ref, () => ({
      clear: () => { /* parent handles by clearing lines array */ },
      scrollToBottom: () => { /* handled by follow prop */ },
      scrollToTop: () => {
        containerRef.current?.querySelector('.react-lazylog')?.scrollTo(0, 0)
      },
      findNext: () => { /* handled by LazyLog search */ },
      findPrevious: () => { /* handled by LazyLog search */ },
    }), [])

    const showEmpty = lines.length === 0

    return (
      <div
        ref={containerRef}
        className={cn('rounded-lg overflow-hidden', className)}
        style={{ backgroundColor: '#1e1e1e' }}
      >
        {showEmpty ? (
          <div className="flex items-center justify-center h-full min-h-[200px]">
            <div className="text-muted-foreground/60 text-sm font-mono flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/30 animate-pulse" />
              {emptyMessage || 'Waiting for output...'}
            </div>
          </div>
        ) : containerHeight > 0 ? (
          <LazyLog
            text={text}
            follow={follow}
            extraLines={1}
            enableSearch={!!searchTerm}
            searchKeywords={searchTerm}
            caseInsensitive
            enableLineNumbers={false}
            selectableLines
            formatPart={formatPart}
            onScroll={handleScroll}
            height={containerHeight}
            rowHeight={22}
            overscanRowCount={50}
            style={{
              backgroundColor: '#1e1e1e',
              fontFamily: '"Cascadia Code", "Courier New", monospace',
              fontSize: '13px',
            }}
          />
        ) : null}
      </div>
    )
  }
)

XTermLogViewer.displayName = 'XTermLogViewer'
