/**
 * Agent Log Viewer
 *
 * Streams real-time logs from the ZedOps agent with filtering,
 * search, and auto-scroll capabilities. Shows cached logs when
 * agent is offline. Uses xterm.js for canvas-based terminal rendering.
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { useAgentLogStream } from '../hooks/useAgentLogStream'
import { formatAgentLogLine } from '../lib/ansi-format'
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
import { Pause, Play, ArrowDownToLine, Trash2, Search, CloudOff, ChevronUp } from 'lucide-react'

interface AgentLogViewerProps {
  agentId: string
  agentName: string
}

export function AgentLogViewer({ agentId, agentName: _agentName }: AgentLogViewerProps) {
  const { logs, isConnected, isAgentOnline, error, clearLogs } = useAgentLogStream({
    agentId,
  })

  const [autoScroll, setAutoScroll] = useState(true)
  const [levelFilter, setLevelFilter] = useState<'all' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'>('all')
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
        if (levelFilter !== 'all' && log.level !== levelFilter) return false
        if (searchTerm && !log.message.toLowerCase().includes(searchTerm.toLowerCase())) return false
        return true
      })
      .map(formatAgentLogLine)
  }, [logs, isPaused, pauseSnapshot, levelFilter, searchTerm])

  // Track scroll position to show/hide floating button
  useEffect(() => {
    const mainContent = document.getElementById('main-content')
    if (!mainContent) return

    const handleScroll = () => {
      setShowScrollTop(mainContent.scrollTop > 300)
    }

    mainContent.addEventListener('scroll', handleScroll, { passive: true })
    return () => mainContent.removeEventListener('scroll', handleScroll)
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

  // Determine status
  const getStatus = (): 'streaming' | 'paused' | 'offline' | 'disconnected' => {
    if (!isConnected) return 'disconnected'
    if (isPaused) return 'paused'
    if (isAgentOnline === false) return 'offline'
    return 'streaming'
  }

  const getStatusLabel = (): string => {
    const status = getStatus()
    if (status === 'offline') return 'Agent Offline'
    if (status === 'paused') return 'Paused'
    if (status === 'streaming') return 'Live'
    return 'Disconnected'
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Agent Logs</h2>
          <TerminalStatus status={getStatus()} label={getStatusLabel()} />
        </div>
      </div>

      {/* Offline banner */}
      {isConnected && isAgentOnline === false && logs.length > 0 && (
        <Alert className="border-warning/50 bg-warning/5">
          <CloudOff className="h-4 w-4 text-warning" />
          <AlertDescription className="text-warning">
            Agent is offline. Showing {logs.length.toLocaleString()} cached log lines.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Controls Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Level filter */}
        <Select value={levelFilter} onValueChange={(val) => setLevelFilter(val as typeof levelFilter)}>
          <SelectTrigger className="w-24 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            <SelectItem value="INFO">INFO</SelectItem>
            <SelectItem value="WARN">WARN</SelectItem>
            <SelectItem value="ERROR">ERROR</SelectItem>
            <SelectItem value="DEBUG">DEBUG</SelectItem>
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

          {/* Auto-scroll / Follow */}
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
        emptyMessage={
          logs.length === 0
            ? isAgentOnline === false
              ? 'No cached logs available'
              : 'Waiting for agent output...'
            : 'No logs match filters'
        }
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
