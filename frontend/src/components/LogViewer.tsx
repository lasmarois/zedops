/**
 * Log viewer component for streaming container logs
 */

import { useState, useEffect, useRef } from 'react';
import { useLogStream } from '../hooks/useLogStream';
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

interface LogViewerProps {
  agentId: string;
  containerId: string;
  containerName: string;
  onBack: () => void;
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
  });

  const [autoScroll, setAutoScroll] = useState(true);
  const [streamFilter, setStreamFilter] = useState<'all' | 'stdout' | 'stderr'>('all');
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
    // Stream filter
    if (streamFilter !== 'all' && log.stream !== streamFilter) {
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

  const getStreamColor = (stream: string): string => {
    switch (stream) {
      case 'stdout':
        return '#50fa7b'; // Green
      case 'stderr':
        return '#ff5555'; // Red
      default:
        return '#f1fa8c'; // Yellow
    }
  };

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
    <div className="p-8 h-screen flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <Button variant="secondary" onClick={onBack} className="mb-4">
          ← Back to Containers
        </Button>

        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-2xl font-bold m-0">Logs: {containerName}</h2>
          <Badge variant={isConnected ? 'success' : 'destructive'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>Error: {error}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-4 mb-4 items-center flex-wrap">
        {/* Stream filter */}
        <div className="flex gap-2 items-center">
          <Label className="text-sm font-bold">Stream:</Label>
          <Select value={streamFilter} onValueChange={(val) => setStreamFilter(val as 'all' | 'stdout' | 'stderr')}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="stdout">stdout</SelectItem>
              <SelectItem value="stderr">stderr</SelectItem>
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

      {/* Log display - PRESERVE DRACULA THEME */}
      <div
        ref={logContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
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
            {logs.length === 0 ? 'No logs yet. Waiting for container output...' : 'No logs match current filters.'}
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
                  color: getStreamColor(log.stream),
                  marginRight: '0.5rem',
                  fontWeight: 'bold',
                }}
              >
                [{log.stream}]
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
