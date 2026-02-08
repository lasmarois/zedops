/**
 * Container Log Viewer
 *
 * Streams real-time logs from Docker containers with filtering,
 * search, and auto-scroll capabilities. Uses xterm.js for
 * canvas-based terminal rendering.
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { useLogStream } from '../hooks/useLogStream'
import { formatContainerLogLine } from '../lib/ansi-format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  TerminalStatus,
  TerminalLineCount,
} from '@/components/ui/terminal-log'
import { XTermLogViewer, type XTermLogViewerRef } from '@/components/ui/xterm-log-viewer'
import { ArrowLeft, Pause, Play, ArrowDownToLine, Trash2, Search, ChevronUp } from 'lucide-react'

interface LogViewerProps {
  agentId: string
  containerId: string
  containerName: string
  onBack: () => void
}

export function LogViewer({
  agentId,
  containerId,
  containerName,
  onBack,
}: LogViewerProps) {
  const { logs, isConnected, error, clearLogs } = useLogStream({
    agentId,
    containerId,
  })

  const [autoScroll, setAutoScroll] = useState(true)
  const [streamFilter, setStreamFilter] = useState<'all' | 'stdout' | 'stderr'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [isPaused, setIsPaused] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [pauseSnapshot, setPauseSnapshot] = useState(0)

  const xtermRef = useRef<XTermLogViewerRef>(null)

  // Capture log count when pausing
  useEffect(() => {
    if (isPaused) {
      setPauseSnapshot(logs.length)
    }
  }, [isPaused]) // eslint-disable-line react-hooks/exhaustive-deps

  // Compute filtered + formatted lines
  const formattedLines = useMemo(() => {
    const source = isPaused ? logs.slice(0, pauseSnapshot) : logs
    return source
      .filter((log) => {
        if (streamFilter !== 'all' && log.stream !== streamFilter) return false
        if (searchTerm && !log.message.toLowerCase().includes(searchTerm.toLowerCase())) return false
        return true
      })
      .map(formatContainerLogLine)
  }, [logs, isPaused, pauseSnapshot, streamFilter, searchTerm])

  // Track scroll position to show/hide floating button
  useEffect(() => {
    const mainContent = document.getElementById('main-content')
    if (!mainContent) return

    const handleMainScroll = () => {
      setShowScrollTop(mainContent.scrollTop > 300)
    }

    mainContent.addEventListener('scroll', handleMainScroll, { passive: true })
    return () => mainContent.removeEventListener('scroll', handleMainScroll)
  }, [])

  const handleScrollToTop = () => {
    const mainContent = document.getElementById('main-content')
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior: 'smooth' })
    }
    setAutoScroll(false)
  }

  const handleClear = () => {
    clearLogs()
    xtermRef.current?.clear()
  }

  return (
    <div className="h-full flex flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="h-6 w-px bg-border" />
          <h2 className="text-lg font-semibold truncate max-w-md" title={containerName}>
            {containerName}
          </h2>
          <TerminalStatus status={isConnected ? 'streaming' : 'disconnected'} />
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Controls Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Stream filter */}
        <Select value={streamFilter} onValueChange={(val) => setStreamFilter(val as typeof streamFilter)}>
          <SelectTrigger className="w-28 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All streams</SelectItem>
            <SelectItem value="stdout">stdout</SelectItem>
            <SelectItem value="stderr">stderr</SelectItem>
          </SelectContent>
        </Select>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search logs..."
            className="h-8 text-xs pl-8"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Pause/Resume */}
          <Button
            size="sm"
            variant={isPaused ? 'default' : 'secondary'}
            onClick={() => setIsPaused(!isPaused)}
            className="h-8 gap-1.5"
          >
            {isPaused ? (
              <>
                <Play className="h-3.5 w-3.5" />
                Resume
              </>
            ) : (
              <>
                <Pause className="h-3.5 w-3.5" />
                Pause
              </>
            )}
          </Button>

          {/* Auto-scroll */}
          <Button
            size="sm"
            variant={autoScroll ? 'secondary' : 'outline'}
            onClick={() => {
              setAutoScroll(true)
              xtermRef.current?.scrollToBottom()
            }}
            className="h-8 gap-1.5"
            disabled={autoScroll}
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
            Follow
          </Button>

          {/* Clear */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClear}
            className="h-8 gap-1.5 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </Button>

          {/* Line count */}
          <TerminalLineCount filtered={formattedLines.length} total={logs.length} />
        </div>
      </div>

      {/* Terminal */}
      <XTermLogViewer
        ref={xtermRef}
        lines={formattedLines}
        follow={autoScroll}
        onFollowChange={setAutoScroll}
        searchTerm={searchTerm}
        emptyMessage={logs.length === 0 ? 'Waiting for container output...' : 'No logs match filters'}
        className="flex-1 min-h-0"
      />

      {/* Floating scroll-to-top button */}
      {showScrollTop && (
        <button
          onClick={handleScrollToTop}
          className="fixed bottom-6 right-6 z-[99999] w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-110 hover:-translate-y-1 active:scale-95 bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-500/50 shadow-[0_0_20px_rgba(59,130,246,0.3),0_4px_12px_rgba(0,0,0,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5),0_6px_20px_rgba(0,0,0,0.5)] backdrop-blur-sm"
          aria-label="Scroll to top and disable auto-scroll"
        >
          <ChevronUp className="w-6 h-6 text-blue-400" />
        </button>
      )}
    </div>
  )
}
