/**
 * Log viewer component for streaming container logs
 */

import { useState, useEffect, useRef } from 'react';
import { useLogStream } from '../hooks/useLogStream';

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
    <div style={{ padding: '2rem', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <button
          onClick={onBack}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginBottom: '1rem',
          }}
        >
          ← Back to Containers
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Logs: {containerName}</h2>
          <div
            style={{
              display: 'inline-block',
              padding: '0.25rem 0.75rem',
              borderRadius: '4px',
              fontSize: '0.875rem',
              fontWeight: 'bold',
              backgroundColor: isConnected ? '#28a745' : '#dc3545',
              color: 'white',
            }}
          >
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: '#f8d7da',
              color: '#721c24',
              borderRadius: '4px',
              marginBottom: '1rem',
            }}
          >
            Error: {error}
          </div>
        )}
      </div>

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {/* Stream filter */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>Stream:</label>
          <select
            value={streamFilter}
            onChange={(e) => setStreamFilter(e.target.value as 'all' | 'stdout' | 'stderr')}
            style={{
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              border: '1px solid #dee2e6',
              fontSize: '0.875rem',
            }}
          >
            <option value="all">All</option>
            <option value="stdout">stdout</option>
            <option value="stderr">stderr</option>
          </select>
        </div>

        {/* Search */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1 }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>Search:</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter logs..."
            style={{
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              border: '1px solid #dee2e6',
              fontSize: '0.875rem',
              flex: 1,
              maxWidth: '300px',
            }}
          />
        </div>

        {/* Action buttons */}
        <button
          onClick={togglePause}
          style={{
            padding: '0.25rem 0.75rem',
            backgroundColor: isPaused ? '#28a745' : '#ffc107',
            color: isPaused ? 'white' : '#000',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 'bold',
          }}
        >
          {isPaused ? 'Resume' : 'Pause'}
        </button>

        <button
          onClick={() => setAutoScroll(true)}
          disabled={autoScroll}
          style={{
            padding: '0.25rem 0.75rem',
            backgroundColor: autoScroll ? '#6c757d' : '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: autoScroll ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            opacity: autoScroll ? 0.6 : 1,
          }}
        >
          Auto-scroll
        </button>

        <button
          onClick={handleClear}
          style={{
            padding: '0.25rem 0.75rem',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          Clear
        </button>

        <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>
          {filteredLogs.length} / {logs.length} lines
        </div>
      </div>

      {/* Log display */}
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
