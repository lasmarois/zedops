/**
 * Agent log viewer component for streaming agent logs
 * M9.8.33: Real-time agent logs
 */

import { useState, useEffect, useRef } from 'react';
import { useAgentLogStream } from '../hooks/useAgentLogStream';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AgentLogViewerProps {
  agentId: string;
  agentName: string;
}

export function AgentLogViewer({
  agentId,
  agentName,
}: AgentLogViewerProps) {
  const { logs, isConnected, isAgentOnline, error, clearLogs } = useAgentLogStream({
    agentId,
  });

  const [autoScroll, setAutoScroll] = useState(true);
  const [levelFilter, setLevelFilter] = useState<'all' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isPaused, setIsPaused] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && !isPaused && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll, isPaused]);

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    // Level filter
    if (levelFilter !== 'all' && log.level !== levelFilter) {
      return false;
    }

    // Search filter
    if (searchTerm && !log.message.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    return true;
  });

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  const getLevelColor = (level: string): string => {
    switch (level.toUpperCase()) {
      case 'INFO':
        return '#50fa7b'; // Green
      case 'WARN':
        return '#f1fa8c'; // Yellow
      case 'ERROR':
        return '#ff5555'; // Red
      case 'DEBUG':
        return '#8be9fd'; // Cyan
      default:
        return '#f8f8f2'; // Default white
    }
  };

  // Badge color styling for better contrast
  const getStatusBadgeStyle = (): { className: string; text: string } => {
    if (isConnected && isAgentOnline) {
      return { className: 'bg-green-600 text-white border-green-700', text: 'Streaming' };
    }
    if (isConnected && isAgentOnline === false) {
      return { className: 'bg-amber-600 text-white border-amber-700', text: 'Agent Offline' };
    }
    return { className: 'bg-red-700 text-white border-red-800', text: 'Disconnected' };
  };

  const statusBadge = getStatusBadgeStyle();

  const handleScroll = () => {
    if (logContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isAtBottom);
    }
  };

  const handleClear = () => {
    clearLogs();
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-xl font-bold m-0">Agent Logs: {agentName}</h2>
          <Badge className={statusBadge.className}>
            {statusBadge.text}
          </Badge>
        </div>

        {/* Agent offline info banner - show cached logs */}
        {isConnected && isAgentOnline === false && logs.length > 0 && (
          <Alert className="mb-4 border-amber-500 bg-amber-500/10">
            <AlertDescription>
              Agent is offline. Showing {logs.length} cached log lines from before disconnect.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>Error: {error}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-4 mb-4 items-center flex-wrap">
        {/* Level filter */}
        <div className="flex gap-2 items-center">
          <Label className="text-sm font-bold">Level:</Label>
          <Select value={levelFilter} onValueChange={(val) => setLevelFilter(val as typeof levelFilter)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="INFO">INFO</SelectItem>
              <SelectItem value="WARN">WARN</SelectItem>
              <SelectItem value="ERROR">ERROR</SelectItem>
              <SelectItem value="DEBUG">DEBUG</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Search */}
        <div className="flex gap-2 items-center flex-1">
          <Label className="text-sm font-bold">Search:</Label>
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter logs..."
            className="flex-1 max-w-[300px]"
          />
        </div>

        {/* Action buttons */}
        <Button
          size="sm"
          variant={isPaused ? 'success' : 'warning'}
          onClick={togglePause}
        >
          {isPaused ? 'Resume' : 'Pause'}
        </Button>

        <Button
          size="sm"
          variant={autoScroll ? 'secondary' : 'info'}
          onClick={() => setAutoScroll(true)}
          disabled={autoScroll}
        >
          Auto-scroll
        </Button>

        <Button
          size="sm"
          variant="destructive"
          onClick={handleClear}
        >
          Clear
        </Button>

        <span className="text-sm text-muted-foreground">
          {filteredLogs.length} / {logs.length} lines
        </span>
      </div>

      {/* Log display - DRACULA THEME */}
      <div
        ref={logContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          minHeight: '400px',
          backgroundColor: '#282a36',
          color: '#f8f8f2',
          fontFamily: 'Monaco, Menlo, Consolas, "Courier New", monospace',
          fontSize: '0.875rem',
          padding: '1rem',
          borderRadius: '4px',
          overflow: 'auto',
          lineHeight: '1.5',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        {filteredLogs.length === 0 ? (
          <div style={{ color: '#6c757d', textAlign: 'center', marginTop: '2rem' }}>
            {logs.length === 0
              ? (isAgentOnline === false
                  ? 'No cached logs available. Agent was offline with no recent activity.'
                  : 'No logs yet. Waiting for agent output...')
              : 'No logs match current filters.'}
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div
              key={`${log.timestamp}-${index}`}
              style={{
                marginBottom: '0.25rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              <span style={{ color: '#6272a4', marginRight: '0.5rem' }}>
                {formatTimestamp(log.timestamp)}
              </span>
              <span
                style={{
                  color: getLevelColor(log.level),
                  marginRight: '0.5rem',
                  fontWeight: 'bold',
                  minWidth: '50px',
                  display: 'inline-block',
                }}
              >
                [{log.level}]
              </span>
              <span>{log.message}</span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
