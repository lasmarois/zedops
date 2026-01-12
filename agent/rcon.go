package main

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/docker/docker/client"
	"github.com/google/uuid"
	"github.com/gorcon/rcon"
)

// RCONSession represents an active RCON connection
type RCONSession struct {
	conn      *rcon.Conn
	serverId  string
	sessionId string
	createdAt time.Time
	lastUsed  time.Time
}

// RCONManager manages RCON sessions
type RCONManager struct {
	sessions      map[string]*RCONSession
	mu            sync.RWMutex
	cleanupTicker *time.Ticker
	stopCleanup   chan struct{}
	dockerClient  *client.Client
}

// NewRCONManager creates a new RCON manager
func NewRCONManager(dockerClient *client.Client) *RCONManager {
	manager := &RCONManager{
		sessions:     make(map[string]*RCONSession),
		stopCleanup:  make(chan struct{}),
		dockerClient: dockerClient,
	}

	// Start cleanup goroutine (5-minute timeout)
	manager.cleanupTicker = time.NewTicker(1 * time.Minute)
	go manager.cleanupIdleSessions()

	return manager
}

// Connect establishes a new RCON connection using Docker network
func (rm *RCONManager) Connect(serverId, containerID string, port int, password string) (string, error) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	// Inspect container to get network IP
	ctx := context.Background()
	inspect, err := rm.dockerClient.ContainerInspect(ctx, containerID)
	if err != nil {
		return "", fmt.Errorf("failed to inspect container: %w", err)
	}

	// Extract IP from zomboid-backend network
	network := inspect.NetworkSettings.Networks["zomboid-backend"]
	if network == nil {
		return "", fmt.Errorf("container not connected to zomboid-backend network")
	}

	containerIP := network.IPAddress
	if containerIP == "" {
		return "", fmt.Errorf("container has no IP address in zomboid-backend network")
	}

	// Create connection address using internal container IP
	addr := fmt.Sprintf("%s:%d", containerIP, port)

	log.Printf("[RCON] Connecting to container %s (IP: %s, Port: %d)", containerID[:12], containerIP, port)

	// Dial RCON connection with timeout
	conn, err := rcon.Dial(addr, password, rcon.SetDialTimeout(30*time.Second))
	if err != nil {
		return "", fmt.Errorf("RCON connection failed to %s: %w", addr, err)
	}

	// Generate session ID
	sessionId := uuid.New().String()

	// Store session
	session := &RCONSession{
		conn:      conn,
		serverId:  serverId,
		sessionId: sessionId,
		createdAt: time.Now(),
		lastUsed:  time.Now(),
	}

	rm.sessions[sessionId] = session

	log.Printf("[RCON] Connected to %s (container: %s, session: %s)", addr, containerID[:12], sessionId)

	return sessionId, nil
}

// Execute sends a command to an existing RCON session
func (rm *RCONManager) Execute(sessionId, command string) (string, error) {
	rm.mu.RLock()
	session, exists := rm.sessions[sessionId]
	rm.mu.RUnlock()

	if !exists {
		return "", fmt.Errorf("session not found: %s", sessionId)
	}

	// Update last used time
	rm.mu.Lock()
	session.lastUsed = time.Now()
	rm.mu.Unlock()

	// Execute command
	response, err := session.conn.Execute(command)
	if err != nil {
		return "", fmt.Errorf("RCON command failed: %w", err)
	}

	log.Printf("[RCON] Executed command '%s' on session %s", command, sessionId)

	return response, nil
}

// Disconnect closes an RCON session
func (rm *RCONManager) Disconnect(sessionId string) error {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	session, exists := rm.sessions[sessionId]
	if !exists {
		return fmt.Errorf("session not found: %s", sessionId)
	}

	// Close connection
	if err := session.conn.Close(); err != nil {
		log.Printf("[RCON] Warning: error closing session %s: %v", sessionId, err)
	}

	// Remove from sessions map
	delete(rm.sessions, sessionId)

	log.Printf("[RCON] Disconnected session %s", sessionId)

	return nil
}

// cleanupIdleSessions removes sessions idle for more than 5 minutes
func (rm *RCONManager) cleanupIdleSessions() {
	for {
		select {
		case <-rm.cleanupTicker.C:
			rm.mu.Lock()
			now := time.Now()
			for sessionId, session := range rm.sessions {
				if now.Sub(session.lastUsed) > 5*time.Minute {
					log.Printf("[RCON] Auto-disconnect idle session %s (server: %s)", sessionId, session.serverId)
					session.conn.Close()
					delete(rm.sessions, sessionId)
				}
			}
			rm.mu.Unlock()
		case <-rm.stopCleanup:
			rm.cleanupTicker.Stop()
			return
		}
	}
}

// Close shuts down the RCON manager and all sessions
func (rm *RCONManager) Close() {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	// Stop cleanup goroutine
	close(rm.stopCleanup)

	// Close all sessions
	for sessionId, session := range rm.sessions {
		session.conn.Close()
		log.Printf("[RCON] Closed session %s", sessionId)
	}

	rm.sessions = make(map[string]*RCONSession)
}
