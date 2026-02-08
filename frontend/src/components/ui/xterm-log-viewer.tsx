/**
 * XTermLogViewer — Read-only xterm.js terminal for log viewing
 *
 * Renders pre-formatted ANSI strings in a canvas-based terminal.
 * Supports incremental rendering, follow mode, and search highlighting.
 * Uses the same VS Code dark theme as the RCON terminal.
 */

import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { cn } from '@/lib/utils'
import '@xterm/xterm/css/xterm.css'

export interface XTermLogViewerProps {
  /** Pre-formatted ANSI strings to display */
  lines: string[]
  /** Auto-scroll to bottom on new lines (default true) */
  follow?: boolean
  /** Callback when follow mode changes (user scrolls away) */
  onFollowChange?: (following: boolean) => void
  /** Search term for highlighting via SearchAddon */
  searchTerm?: string
  /** Max scrollback lines (default 5000) */
  scrollback?: number
  /** Additional CSS classes for the container */
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

// VS Code dark theme — matches RconTerminal.tsx
const VS_CODE_THEME = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#1e1e1e', // invisible cursor for read-only
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e5e5e5',
}

export const XTermLogViewer = forwardRef<XTermLogViewerRef, XTermLogViewerProps>(
  (
    {
      lines,
      follow = true,
      onFollowChange,
      searchTerm,
      scrollback = 5000,
      className,
      emptyMessage,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const terminalRef = useRef<Terminal | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)
    const searchAddonRef = useRef<SearchAddon | null>(null)
    const renderedCountRef = useRef(0)
    const prevLinesRef = useRef<string[]>([])
    const followRef = useRef(follow)
    const isAtBottomRef = useRef(true)

    // Keep followRef in sync
    useEffect(() => {
      followRef.current = follow
    }, [follow])

    // Initialize terminal
    useEffect(() => {
      if (!containerRef.current) return

      const terminal = new Terminal({
        disableStdin: true,
        cursorBlink: false,
        cursorStyle: 'bar',
        cursorInactiveStyle: 'none',
        fontSize: 14,
        fontFamily: '"Cascadia Code", "Courier New", monospace',
        scrollback,
        convertEol: true,
        theme: VS_CODE_THEME,
      })

      const fitAddon = new FitAddon()
      const searchAddon = new SearchAddon()
      terminal.loadAddon(fitAddon)
      terminal.loadAddon(searchAddon)

      terminal.open(containerRef.current)
      fitAddon.fit()

      terminalRef.current = terminal
      fitAddonRef.current = fitAddon
      searchAddonRef.current = searchAddon
      renderedCountRef.current = 0
      prevLinesRef.current = []

      // Detect user scrolling away from bottom to disable follow
      terminal.onScroll(() => {
        const buffer = terminal.buffer.active
        const isBottom = buffer.viewportY >= buffer.baseY || buffer.length <= terminal.rows
        isAtBottomRef.current = isBottom

        if (!isBottom && followRef.current) {
          onFollowChange?.(false)
        }
      })

      // ResizeObserver for responsive sizing
      const observer = new ResizeObserver(() => {
        if (fitAddonRef.current && terminalRef.current) {
          try {
            fitAddonRef.current.fit()
          } catch {
            // Ignore fit errors during rapid resizing
          }
        }
      })
      observer.observe(containerRef.current)

      return () => {
        observer.disconnect()
        terminal.dispose()
        terminalRef.current = null
        fitAddonRef.current = null
        searchAddonRef.current = null
      }
    }, [scrollback, onFollowChange])

    // Write lines to terminal — incremental or full replay
    useEffect(() => {
      const terminal = terminalRef.current
      if (!terminal) return

      // Detect if this is an incremental update (same array growing) or a full change
      const prevLines = prevLinesRef.current
      const isIncremental =
        lines.length >= prevLines.length &&
        lines.length > 0 &&
        prevLines.length > 0 &&
        lines[0] === prevLines[0] &&
        (prevLines.length < 2 || lines[prevLines.length - 1] === prevLines[prevLines.length - 1])

      if (isIncremental && renderedCountRef.current > 0) {
        // Only write new lines
        const newLines = lines.slice(renderedCountRef.current)
        if (newLines.length > 0) {
          terminal.write(newLines.join('\r\n') + '\r\n')
        }
      } else {
        // Full replay — clear and rewrite
        terminal.clear()
        terminal.reset()
        if (lines.length > 0) {
          // Write all lines in a single batch for performance
          terminal.write(lines.join('\r\n') + '\r\n')
        }
      }

      renderedCountRef.current = lines.length
      prevLinesRef.current = lines

      // Auto-scroll if following
      if (followRef.current) {
        terminal.scrollToBottom()
      }
    }, [lines])

    // Handle search term changes
    useEffect(() => {
      const searchAddon = searchAddonRef.current
      if (!searchAddon) return

      if (searchTerm) {
        searchAddon.findNext(searchTerm, { caseSensitive: false, decorations: {
          matchOverviewRuler: '#888888',
          activeMatchColorOverviewRuler: '#ffff00',
        }})
      } else {
        searchAddon.clearDecorations()
      }
    }, [searchTerm])

    // Handle follow prop changes — scroll to bottom when re-enabled
    useEffect(() => {
      if (follow && terminalRef.current) {
        terminalRef.current.scrollToBottom()
      }
    }, [follow])

    const clear = useCallback(() => {
      if (terminalRef.current) {
        terminalRef.current.clear()
        terminalRef.current.reset()
        renderedCountRef.current = 0
        prevLinesRef.current = []
      }
    }, [])

    useImperativeHandle(ref, () => ({
      clear,
      scrollToBottom: () => terminalRef.current?.scrollToBottom(),
      scrollToTop: () => terminalRef.current?.scrollToTop(),
      findNext: () => {
        if (searchAddonRef.current && searchTerm) {
          searchAddonRef.current.findNext(searchTerm)
        }
      },
      findPrevious: () => {
        if (searchAddonRef.current && searchTerm) {
          searchAddonRef.current.findPrevious(searchTerm)
        }
      },
    }), [clear, searchTerm])

    // Show empty message when no lines
    const showEmpty = lines.length === 0

    return (
      <div className={cn('relative rounded-lg overflow-hidden min-h-[200px]', className)}>
        {/* Terminal container */}
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{ backgroundColor: '#1e1e1e' }}
        />
        {/* Empty state overlay */}
        {showEmpty && emptyMessage && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="text-muted-foreground/60 text-sm font-mono flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/30 animate-pulse" />
              {emptyMessage}
            </div>
          </div>
        )}
      </div>
    )
  }
)

XTermLogViewer.displayName = 'XTermLogViewer'
