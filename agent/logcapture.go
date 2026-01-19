package main

import (
	"fmt"
	"io"
	"os"
	"sync"
	"time"
)

// AgentLogLine represents a single agent log entry
type AgentLogLine struct {
	Timestamp int64  `json:"timestamp"`
	Level     string `json:"level"`
	Message   string `json:"message"`
}

// LogCapture captures log output and broadcasts to subscribers
type LogCapture struct {
	mu           sync.RWMutex
	buffer       []AgentLogLine
	bufferSize   int
	subscribers  map[chan AgentLogLine]bool
	originalOut  io.Writer
	isSubscribed bool // Whether manager is currently subscribed
}

// NewLogCapture creates a new log capture with specified buffer size
func NewLogCapture(bufferSize int) *LogCapture {
	return &LogCapture{
		buffer:      make([]AgentLogLine, 0, bufferSize),
		bufferSize:  bufferSize,
		subscribers: make(map[chan AgentLogLine]bool),
		originalOut: os.Stderr,
	}
}

// Write implements io.Writer interface
// This is called by the log package when logging
func (lc *LogCapture) Write(p []byte) (n int, err error) {
	// Write to original output first
	n, err = lc.originalOut.Write(p)

	// Parse and store the log line
	message := string(p)
	if len(message) > 0 && message[len(message)-1] == '\n' {
		message = message[:len(message)-1]
	}

	// Detect log level from message prefix
	level := "INFO"
	if len(message) > 0 {
		// Standard log package uses date/time prefix, look for keywords
		if containsAny(message, []string{
			"ERROR", "error:", "Error:",
			"FATAL", "fatal:",
			"Failed to", "failed to",
			"Failed:", "failed:",
		}) {
			level = "ERROR"
		} else if containsAny(message, []string{"WARN", "Warning:", "warning:"}) {
			level = "WARN"
		} else if containsAny(message, []string{"DEBUG", "debug:"}) {
			level = "DEBUG"
		}
	}

	logLine := AgentLogLine{
		Timestamp: time.Now().UnixMilli(),
		Level:     level,
		Message:   message,
	}

	lc.addLine(logLine)

	return n, err
}

// addLine adds a log line to the buffer and broadcasts to subscribers
func (lc *LogCapture) addLine(line AgentLogLine) {
	lc.mu.Lock()
	defer lc.mu.Unlock()

	// Add to ring buffer
	if len(lc.buffer) >= lc.bufferSize {
		// Remove oldest entry
		lc.buffer = lc.buffer[1:]
	}
	lc.buffer = append(lc.buffer, line)

	// Broadcast to all subscribers
	for ch := range lc.subscribers {
		select {
		case ch <- line:
		default:
			// Channel full, skip this line for this subscriber
		}
	}
}

// GetHistory returns the buffered log history
func (lc *LogCapture) GetHistory(tail int) []AgentLogLine {
	lc.mu.RLock()
	defer lc.mu.RUnlock()

	if tail <= 0 || tail > len(lc.buffer) {
		tail = len(lc.buffer)
	}

	start := len(lc.buffer) - tail
	if start < 0 {
		start = 0
	}

	// Return a copy to avoid race conditions
	result := make([]AgentLogLine, len(lc.buffer[start:]))
	copy(result, lc.buffer[start:])
	return result
}

// Subscribe creates a new subscription channel
func (lc *LogCapture) Subscribe() chan AgentLogLine {
	lc.mu.Lock()
	defer lc.mu.Unlock()

	ch := make(chan AgentLogLine, 100) // Buffer to prevent blocking
	lc.subscribers[ch] = true
	lc.isSubscribed = true
	return ch
}

// Unsubscribe removes a subscription channel
func (lc *LogCapture) Unsubscribe(ch chan AgentLogLine) {
	lc.mu.Lock()
	defer lc.mu.Unlock()

	delete(lc.subscribers, ch)
	close(ch)
	lc.isSubscribed = len(lc.subscribers) > 0
}

// HasSubscribers returns true if there are active subscribers
func (lc *LogCapture) HasSubscribers() bool {
	lc.mu.RLock()
	defer lc.mu.RUnlock()
	return lc.isSubscribed
}

// Helper function to check if string contains any of the substrings
func containsAny(s string, substrs []string) bool {
	for _, substr := range substrs {
		if len(s) >= len(substr) {
			for i := 0; i <= len(s)-len(substr); i++ {
				if s[i:i+len(substr)] == substr {
					return true
				}
			}
		}
	}
	return false
}

// LogCaptureWriter wraps LogCapture to work with log.SetOutput
type LogCaptureWriter struct {
	capture *LogCapture
}

// Write implements io.Writer for LogCaptureWriter
func (w *LogCaptureWriter) Write(p []byte) (n int, err error) {
	return w.capture.Write(p)
}

// SetupLogCapture configures the standard log package to use LogCapture
func SetupLogCapture(bufferSize int) *LogCapture {
	capture := NewLogCapture(bufferSize)

	// Create a multi-writer that writes to both stderr and our capture
	multiWriter := io.MultiWriter(os.Stderr, capture)

	// Note: We can't easily redirect log.Printf to capture structured logs
	// Instead, we'll set up the log package output
	// The LogCapture.Write method will parse the log format

	// For now, return the capture for the agent to use
	// The agent will need to configure its own logging
	fmt.Fprintf(os.Stderr, "Log capture initialized with buffer size %d\n", bufferSize)
	_ = multiWriter // Will be used when we set up proper logging

	return capture
}
