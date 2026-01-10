package main

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"time"

	"github.com/gorilla/websocket"
)

const (
	initialBackoff = 1 * time.Second
	maxBackoff     = 60 * time.Second
	backoffFactor  = 2.0
)

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
			log.Printf("Registration/authentication failed: %v", err)
			a.conn.Close()
			time.Sleep(initialBackoff)
			continue
		}

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
			log.Println("Connection lost, reconnecting...")
			time.Sleep(initialBackoff)
			continue
		case <-ctx.Done():
			// Graceful shutdown
			heartbeatCancel()
			log.Println("Shutting down...")
			err := a.conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
			if err != nil {
				log.Println("Error sending close message:", err)
			}
			a.conn.Close()
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
			msg := NewMessage("agent.heartbeat", map[string]string{
				"agentId": a.agentID,
			})
			if err := a.sendMessage(msg); err != nil {
				log.Printf("Failed to send heartbeat: %v", err)
				return
			}
			log.Println("Heartbeat sent")
		case <-ctx.Done():
			return
		}
	}
}
