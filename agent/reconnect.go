package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/url"
	"time"

	"github.com/gorilla/websocket"
)

const (
	initialBackoff = 1 * time.Second
	maxBackoff     = 60 * time.Second
	maxAuthBackoff = 5 * time.Minute // Auth retries back off to 5min max (288 req/day at steady state)
	backoffFactor  = 2.0
)

// ErrAuthFailure indicates a fatal authentication failure (invalid token, agent not found, etc.)
// This error should cause the agent to exit without retry.
var ErrAuthFailure = errors.New("authentication failure")

// ErrTransientAuth indicates a transient authentication failure (connection dropped during auth,
// timeout due to Worker redeployment, etc.). These are retried indefinitely with backoff up to 5 minutes.
// Only explicit server rejection (ErrAuthFailure) causes the agent to exit.
var ErrTransientAuth = errors.New("transient auth failure")

// ConnectWithRetry attempts to connect to the manager with exponential backoff
func (a *Agent) ConnectWithRetry(ctx context.Context) error {
	backoff := initialBackoff
	attempt := 0

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		attempt++
		log.Printf("Connection attempt #%d (backoff: %v)", attempt, backoff)

		// Parse manager URL
		u, err := url.Parse(a.managerURL)
		if err != nil {
			return fmt.Errorf("invalid manager URL: %w", err)
		}

		// Add agent name as query parameter for consistent Durable Object routing
		q := u.Query()
		q.Set("name", a.agentName)
		u.RawQuery = q.Encode()

		// Attempt connection
		conn, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
		if err != nil {
			log.Printf("Connection failed: %v", err)

			// Wait before retry with exponential backoff
			select {
			case <-time.After(backoff):
				backoff = time.Duration(float64(backoff) * backoffFactor)
				if backoff > maxBackoff {
					backoff = maxBackoff
				}
				continue
			case <-ctx.Done():
				return ctx.Err()
			}
		}

		// Connection successful
		a.conn = conn
		log.Println("WebSocket connection established")

		// Reset backoff on successful connection
		backoff = initialBackoff

		return nil
	}
}

// RunWithReconnect runs the agent with automatic reconnection
func (a *Agent) RunWithReconnect(ctx context.Context) error {
	transientRetries := 0
	authBackoff := initialBackoff
	var firstFailure time.Time

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Connect (with retry)
		if err := a.ConnectWithRetry(ctx); err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			log.Printf("Failed to connect: %v", err)
			continue
		}

		// Register or authenticate
		if err := a.register(); err != nil {
			a.conn.Close()

			if errors.Is(err, ErrTransientAuth) {
				// Transient failure — connection dropped during auth (likely Worker redeploy)
				transientRetries++
				if transientRetries == 1 {
					firstFailure = time.Now()
				}

				// Log every attempt for the first 10, then every 5th to reduce spam
				if transientRetries <= 10 || transientRetries%5 == 0 {
					elapsed := time.Since(firstFailure).Round(time.Second)
					log.Printf("Auth failed (transient), retrying (#%d, backoff %v, failing for %v)...",
						transientRetries, authBackoff, elapsed)
				}

				select {
				case <-time.After(authBackoff):
					authBackoff = time.Duration(float64(authBackoff) * backoffFactor)
					if authBackoff > maxAuthBackoff {
						authBackoff = maxAuthBackoff
					}
				case <-ctx.Done():
					return ctx.Err()
				}
				continue
			}

			// Permanent failure — server explicitly rejected us
			log.Println("")
			log.Println("========================================")
			log.Println("AUTHENTICATION FAILED - AGENT STOPPING")
			log.Println("========================================")
			log.Printf("Error: %v", err)
			log.Println("")
			log.Println("Possible causes:")
			log.Println("  - Agent was deleted from the manager")
			log.Println("  - Token is invalid or expired")
			log.Println("  - Agent name mismatch")
			log.Println("")
			log.Println("To fix:")
			log.Println("  1. Generate a new token in the manager UI")
			log.Println("  2. Re-run the install script with --token flag")
			log.Println("     Or manually update /root/.zedops-agent/token")
			log.Println("  3. Restart the agent: sudo systemctl start zedops-agent")
			log.Println("========================================")
			return fmt.Errorf("%w: %v", ErrAuthFailure, err)
		}

		// Auth succeeded — reset transient retry state
		transientRetries = 0
		authBackoff = initialBackoff

		// Mark as authenticated
		a.setAuthenticated(true)
		log.Println("Agent authenticated successfully")

		// Start heartbeat
		heartbeatCtx, heartbeatCancel := context.WithCancel(ctx)
		go a.sendHeartbeats(heartbeatCtx)

		// Start message receiver
		done := make(chan struct{})
		go func() {
			a.receiveMessages()
			close(done)
		}()

		// Wait for disconnect or shutdown
		select {
		case <-done:
			// Connection closed, clean up and reconnect
			heartbeatCancel()
			a.conn.Close()
			a.setAuthenticated(false) // Mark as not authenticated
			a.cleanupOnDisconnect()   // Reset log streaming state
			log.Println("Connection lost, reconnecting...")
			time.Sleep(initialBackoff)
			continue
		case <-ctx.Done():
			// Graceful shutdown
			heartbeatCancel()
			log.Println("Shutting down...")
			// Use mutex to prevent concurrent writes during shutdown
			a.connMutex.Lock()
			err := a.conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
			if err != nil {
				log.Println("Error sending close message:", err)
			}
			a.conn.Close()
			a.connMutex.Unlock()
			return ctx.Err()
		}
	}
}

// sendHeartbeats sends periodic heartbeats to the manager
func (a *Agent) sendHeartbeats(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// Collect host metrics (pass DockerClient for disk path discovery)
			metrics, err := CollectHostMetrics(a.docker)
			if err != nil {
				log.Printf("Warning: Failed to collect metrics: %v", err)
				// Send heartbeat without metrics (backward compatible)
				msg := NewMessage("agent.heartbeat", map[string]string{
					"agentId": a.agentID,
				})
				if err := a.sendMessage(msg); err != nil {
					log.Printf("Failed to send heartbeat: %v", err)
					return
				}
				log.Println("Heartbeat sent (without metrics)")
				continue
			}

			// Send heartbeat with metrics
			msg := NewMessage("agent.heartbeat", map[string]interface{}{
				"agentId": a.agentID,
				"metrics": metrics,
			})
			if err := a.sendMessage(msg); err != nil {
				log.Printf("Failed to send heartbeat: %v", err)
				return
			}
			// Log summary of metrics
			diskSummary := ""
			for i, disk := range metrics.Disks {
				if i > 0 {
					diskSummary += ", "
				}
				diskSummary += fmt.Sprintf("%s: %dGB/%dGB", disk.Label, disk.UsedGB, disk.TotalGB)
			}
			log.Printf("Heartbeat sent with metrics (CPU: %.1f%%, Mem: %dMB/%dMB, Disks: [%s])",
				metrics.CPUPercent, metrics.MemoryUsedMB, metrics.MemoryTotalMB, diskSummary)
		case <-ctx.Done():
			return
		}
	}
}
