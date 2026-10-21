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
	initialBackoff   = 1 * time.Second
	maxBackoff       = 60 * time.Second
	maxAuthBackoff   = 1 * time.Minute // Auth retries back off to 1min max (was 5min)
	backoffFactor    = 2.0
	reconnectBackoff = 3 * time.Second // Fast fixed-interval retry after a healthy disconnect
	reconnectWindow  = 2 * time.Minute // Use fast retries for this long before escalating

	// Dead-link detection: the manager acks every heartbeat (30s) and relays other traffic.
	// If nothing at all arrives for readTimeout, the link is considered dead and we reconnect
	// instead of waiting for a TCP error that may never come (half-open connection).
	readTimeout  = 90 * time.Second
	pingInterval = 30 * time.Second
)

// ErrAuthFailure indicates a fatal authentication failure (invalid token, agent not found, etc.)
// This error should cause the agent to exit without retry.
var ErrAuthFailure = errors.New("authentication failure")

// ErrTransientAuth indicates a transient authentication failure (connection dropped during auth,
// timeout due to DO hibernation cold start, Worker redeployment, etc.).
// These are retried indefinitely with backoff up to 1 minute.
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
	alertSent := false
	const alertDelay = 10 * time.Minute

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
			a.closeConn(websocket.CloseNormalClosure, "auth failed")

			if errors.Is(err, ErrTransientAuth) {
				// Transient failure — DO hibernation cold start or Worker redeploy
				transientRetries++
				if transientRetries == 1 {
					firstFailure = time.Now()
				}

				// Determine retry interval: fast fixed retries vs exponential backoff
				var retryDelay time.Duration
				if a.inReconnectWindow() {
					// Recently authenticated — use fast retries (DO likely just needs to wake up)
					retryDelay = reconnectBackoff
					if transientRetries <= 10 || transientRetries%5 == 0 {
						elapsed := time.Since(firstFailure).Round(time.Second)
						log.Printf("Auth failed (reconnecting), fast retry in %v (#%d, failing for %v)...",
							retryDelay, transientRetries, elapsed)
					}
				} else {
					// Fresh connection or reconnect window expired — exponential backoff
					retryDelay = authBackoff
					if transientRetries <= 10 || transientRetries%5 == 0 {
						elapsed := time.Since(firstFailure).Round(time.Second)
						log.Printf("Auth failed (transient), retrying (#%d, backoff %v, failing for %v)...",
							transientRetries, retryDelay, elapsed)
					}
				}

				// Send alert email after 10 minutes of continuous failure (once per outage)
				if !alertSent && time.Since(firstFailure) >= alertDelay {
					alertSent = true
					go a.SendAlertEmail(err.Error(), firstFailure)
				}

				select {
				case <-time.After(retryDelay):
					if !a.inReconnectWindow() {
						// Only escalate backoff outside the reconnect window
						authBackoff = time.Duration(float64(authBackoff) * backoffFactor)
						if authBackoff > maxAuthBackoff {
							authBackoff = maxAuthBackoff
						}
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
			log.Printf("     Or manually update %s", GetTokenPath())
			log.Println("  3. Restart the agent: sudo systemctl start zedops-agent")
			log.Println("========================================")
			return fmt.Errorf("%w: %v", ErrAuthFailure, err)
		}

		// Auth succeeded — send recovery email if alert was sent during this outage
		if alertSent {
			go a.SendRecoveryEmail(firstFailure)
		}

		// Reset transient retry state
		transientRetries = 0
		authBackoff = initialBackoff
		alertSent = false

		// Mark as authenticated
		a.setAuthenticated(true)
		log.Println("Agent authenticated successfully")

		// Arm dead-link detection: every inbound frame (messages, pongs) extends the deadline.
		a.conn.SetReadDeadline(time.Now().Add(readTimeout))
		a.conn.SetPongHandler(func(string) error {
			return a.conn.SetReadDeadline(time.Now().Add(readTimeout))
		})

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
			a.closeConn(websocket.CloseGoingAway, "reconnecting")
			a.setAuthenticated(false) // Mark as not authenticated (also records lastDisconnect)
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
	pingTicker := time.NewTicker(pingInterval)
	defer pingTicker.Stop()

	for {
		select {
		case <-pingTicker.C:
			// Protocol-level ping; the Cloudflare edge answers with a pong even while the
			// Durable Object hibernates, so a missing pong means the link itself is dead.
			a.connMutex.Lock()
			err := a.conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(5*time.Second))
			a.connMutex.Unlock()
			if err != nil {
				log.Printf("Failed to send ping: %v", err)
				return
			}
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

// closeConn sends a WebSocket close frame (best effort) and then closes the TCP connection.
// Sending the close frame lets the manager's Durable Object reap the socket immediately
// instead of leaving it half-open until Cloudflare detects the dead TCP connection.
func (a *Agent) closeConn(code int, reason string) {
	if a.conn == nil {
		return
	}
	a.connMutex.Lock()
	defer a.connMutex.Unlock()
	_ = a.conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(code, reason), time.Now().Add(2*time.Second))
	a.conn.Close()
}
