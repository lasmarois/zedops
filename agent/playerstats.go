package main

import (
	"context"
	"fmt"
	"log"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/gorcon/rcon"
)

// PlayerStats represents player information for a server
type PlayerStats struct {
	ServerID      string   `json:"serverId"`
	ServerName    string   `json:"serverName"`
	PlayerCount   int      `json:"playerCount"`
	MaxPlayers    int      `json:"maxPlayers"`
	Players       []string `json:"players"`
	RCONConnected bool     `json:"rconConnected"` // P2: RCON health status
	LastUpdate    int64    `json:"lastUpdate"`
}

// ServerRCONConfig holds RCON connection info for a server
type ServerRCONConfig struct {
	ServerID    string
	ServerName  string
	ContainerID string
	RCONPort    int
	RCONPassword string
	MaxPlayers  int
}

// PlayerStatsCollector maintains persistent RCON connections and collects player stats
type PlayerStatsCollector struct {
	mu           sync.RWMutex
	connections  map[string]*rcon.Conn // serverID -> RCON connection
	stats        map[string]*PlayerStats // serverID -> latest stats
	docker       *DockerClient
	agent        *Agent
	stopCh       chan struct{}
	pollInterval time.Duration
}

// NewPlayerStatsCollector creates a new player stats collector
func NewPlayerStatsCollector(docker *DockerClient, agent *Agent) *PlayerStatsCollector {
	return &PlayerStatsCollector{
		connections:  make(map[string]*rcon.Conn),
		stats:        make(map[string]*PlayerStats),
		docker:       docker,
		agent:        agent,
		stopCh:       make(chan struct{}),
		pollInterval: 10 * time.Second,
	}
}

// Start begins the background polling loop
func (psc *PlayerStatsCollector) Start() {
	log.Println("[PlayerStats] Starting player stats collector (10s interval)")
	go psc.pollLoop()
}

// Stop stops the collector and closes all connections
func (psc *PlayerStatsCollector) Stop() {
	log.Println("[PlayerStats] Stopping player stats collector")
	close(psc.stopCh)

	psc.mu.Lock()
	defer psc.mu.Unlock()

	for serverID, conn := range psc.connections {
		conn.Close()
		log.Printf("[PlayerStats] Closed RCON connection for server %s", serverID)
	}
	psc.connections = make(map[string]*rcon.Conn)
}

// GetStats returns the current player stats for all servers
func (psc *PlayerStatsCollector) GetStats() map[string]*PlayerStats {
	psc.mu.RLock()
	defer psc.mu.RUnlock()

	result := make(map[string]*PlayerStats)
	for k, v := range psc.stats {
		result[k] = v
	}
	return result
}

// pollLoop runs the main polling loop
func (psc *PlayerStatsCollector) pollLoop() {
	// Initial poll immediately
	psc.collectAllStats()

	ticker := time.NewTicker(psc.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			psc.collectAllStats()
		case <-psc.stopCh:
			return
		}
	}
}

// collectAllStats discovers running servers and collects their player stats
func (psc *PlayerStatsCollector) collectAllStats() {
	// Don't collect if not authenticated
	if !psc.agent.IsAuthenticated() {
		return
	}

	// Get running ZedOps containers
	configs, err := psc.discoverServers()
	if err != nil {
		log.Printf("[PlayerStats] Failed to discover servers: %v", err)
		return
	}

	if len(configs) == 0 {
		// No running servers, clear stats and connections
		psc.mu.Lock()
		for serverID, conn := range psc.connections {
			conn.Close()
			delete(psc.connections, serverID)
		}
		psc.stats = make(map[string]*PlayerStats)
		psc.mu.Unlock()
		return
	}

	// Track which servers we found
	foundServers := make(map[string]bool)

	// Collect stats for each server
	allStats := make(map[string]*PlayerStats)
	for _, config := range configs {
		foundServers[config.ServerID] = true
		stats := psc.collectServerStats(config)
		allStats[config.ServerID] = stats // P2: Always include stats (even with RCONConnected=false)
	}

	// Close connections for servers that are no longer running
	psc.mu.Lock()
	for serverID, conn := range psc.connections {
		if !foundServers[serverID] {
			conn.Close()
			delete(psc.connections, serverID)
			delete(psc.stats, serverID)
			log.Printf("[PlayerStats] Closed connection for stopped server %s", serverID)
		}
	}
	psc.mu.Unlock()

	// Update stats and send to manager
	if len(allStats) > 0 {
		psc.mu.Lock()
		for serverID, stats := range allStats {
			psc.stats[serverID] = stats
		}
		psc.mu.Unlock()

		// Send update to manager
		psc.sendStatsUpdate(allStats)
	}
}

// discoverServers finds running ZedOps containers and gets their RCON config from container env
func (psc *PlayerStatsCollector) discoverServers() ([]ServerRCONConfig, error) {
	ctx := context.Background()

	// List running ZedOps containers
	containerFilters := filters.NewArgs()
	containerFilters.Add("label", "zedops.managed=true")
	containerFilters.Add("status", "running")

	containers, err := psc.docker.cli.ContainerList(ctx, container.ListOptions{
		Filters: containerFilters,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list containers: %w", err)
	}

	var configs []ServerRCONConfig

	for _, c := range containers {
		// Get server info from labels
		serverID := c.Labels["zedops.server.id"]
		serverName := c.Labels["zedops.server.name"]

		if serverID == "" {
			continue
		}

		// Inspect container to get environment variables
		inspect, err := psc.docker.cli.ContainerInspect(ctx, c.ID)
		if err != nil {
			log.Printf("[PlayerStats] Failed to inspect container %s: %v", c.ID[:12], err)
			continue
		}

		// Parse environment variables
		envMap := make(map[string]string)
		for _, env := range inspect.Config.Env {
			parts := strings.SplitN(env, "=", 2)
			if len(parts) == 2 {
				envMap[parts[0]] = parts[1]
			}
		}

		// Get RCON password from env
		rconPassword := envMap["RCON_PASSWORD"]
		if rconPassword == "" {
			rconPassword = envMap["ADMIN_PASSWORD"]
		}
		if rconPassword == "" {
			// RCON not configured, skip this server
			continue
		}

		// Get RCON port from env (default 27015)
		rconPort := 27015
		if portStr := envMap["RCON_PORT"]; portStr != "" {
			if p, err := strconv.Atoi(portStr); err == nil {
				rconPort = p
			}
		}

		// Get max players from env (default 32)
		maxPlayers := 32
		if maxPlayersStr := envMap["MAX_PLAYERS"]; maxPlayersStr != "" {
			if mp, err := strconv.Atoi(maxPlayersStr); err == nil {
				maxPlayers = mp
			}
		}

		configs = append(configs, ServerRCONConfig{
			ServerID:     serverID,
			ServerName:   serverName,
			ContainerID:  c.ID,
			RCONPort:     rconPort,
			RCONPassword: rconPassword,
			MaxPlayers:   maxPlayers,
		})
	}

	return configs, nil
}

// collectServerStats collects player stats for a single server
func (psc *PlayerStatsCollector) collectServerStats(config ServerRCONConfig) *PlayerStats {
	conn := psc.getOrCreateConnection(config)
	if conn == nil {
		// P2: Return stats with RCONConnected=false so frontend shows "Error"
		return &PlayerStats{
			ServerID:      config.ServerID,
			ServerName:    config.ServerName,
			PlayerCount:   0,
			MaxPlayers:    config.MaxPlayers,
			Players:       nil,
			RCONConnected: false,
			LastUpdate:    time.Now().Unix(),
		}
	}

	// Execute "players" command
	response, err := conn.Execute("players")
	if err != nil {
		log.Printf("[PlayerStats] RCON command failed for %s: %v", config.ServerName, err)
		// Connection might be broken, remove it so we reconnect next time
		psc.mu.Lock()
		if c, exists := psc.connections[config.ServerID]; exists {
			c.Close()
			delete(psc.connections, config.ServerID)
		}
		psc.mu.Unlock()
		// P2: Return stats with RCONConnected=false so frontend shows "Error"
		return &PlayerStats{
			ServerID:      config.ServerID,
			ServerName:    config.ServerName,
			PlayerCount:   0,
			MaxPlayers:    config.MaxPlayers,
			Players:       nil,
			RCONConnected: false,
			LastUpdate:    time.Now().Unix(),
		}
	}

	// Parse player list from response
	count, players := parsePlayersResponse(response)

	stats := &PlayerStats{
		ServerID:      config.ServerID,
		ServerName:    config.ServerName,
		PlayerCount:   count,
		MaxPlayers:    config.MaxPlayers,
		Players:       players,
		RCONConnected: true, // P2: RCON connection is healthy if we got here
		LastUpdate:    time.Now().Unix(),
	}

	return stats
}

// getOrCreateConnection gets an existing RCON connection or creates a new one
func (psc *PlayerStatsCollector) getOrCreateConnection(config ServerRCONConfig) *rcon.Conn {
	psc.mu.RLock()
	conn, exists := psc.connections[config.ServerID]
	psc.mu.RUnlock()

	if exists {
		return conn
	}

	// Need to create new connection
	ctx := context.Background()

	// Get container IP
	inspect, err := psc.docker.cli.ContainerInspect(ctx, config.ContainerID)
	if err != nil {
		log.Printf("[PlayerStats] Failed to inspect container %s: %v", config.ContainerID[:12], err)
		return nil
	}

	network := inspect.NetworkSettings.Networks["zomboid-backend"]
	if network == nil {
		log.Printf("[PlayerStats] Container %s not on zomboid-backend network", config.ContainerID[:12])
		return nil
	}

	containerIP := network.IPAddress
	if containerIP == "" {
		log.Printf("[PlayerStats] Container %s has no IP", config.ContainerID[:12])
		return nil
	}

	addr := fmt.Sprintf("%s:%d", containerIP, config.RCONPort)
	log.Printf("[PlayerStats] Connecting to %s RCON at %s", config.ServerName, addr)

	conn, err = rcon.Dial(addr, config.RCONPassword, rcon.SetDialTimeout(10*time.Second))
	if err != nil {
		log.Printf("[PlayerStats] RCON connection failed for %s: %v", config.ServerName, err)
		return nil
	}

	psc.mu.Lock()
	psc.connections[config.ServerID] = conn
	psc.mu.Unlock()

	log.Printf("[PlayerStats] Connected to %s RCON", config.ServerName)
	return conn
}

// parsePlayersResponse parses the RCON "players" command response
// Handles formats like:
// - "Players connected (3): player1, player2, player3"
// - "Players connected: 0"
// - Line-by-line player names
func parsePlayersResponse(response string) (int, []string) {
	response = strings.TrimSpace(response)
	if response == "" {
		return 0, nil
	}

	var players []string

	// Try "Players connected (N):" format
	re := regexp.MustCompile(`Players connected\s*\((\d+)\)\s*:?\s*(.*)`)
	if matches := re.FindStringSubmatch(response); len(matches) >= 2 {
		count, _ := strconv.Atoi(matches[1])
		if len(matches) >= 3 && matches[2] != "" {
			// Parse comma-separated player names
			names := strings.Split(matches[2], ",")
			for _, name := range names {
				name = strings.TrimSpace(name)
				if name != "" {
					players = append(players, name)
				}
			}
		}
		return count, players
	}

	// Try "Players connected: N" format (no player list)
	re2 := regexp.MustCompile(`Players connected:\s*(\d+)`)
	if matches := re2.FindStringSubmatch(response); len(matches) >= 2 {
		count, _ := strconv.Atoi(matches[1])
		return count, nil
	}

	// Fallback: count non-empty lines as players
	lines := strings.Split(response, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" && !strings.HasPrefix(strings.ToLower(line), "players") {
			players = append(players, line)
		}
	}

	return len(players), players
}

// sendStatsUpdate sends player stats to the manager via WebSocket
func (psc *PlayerStatsCollector) sendStatsUpdate(stats map[string]*PlayerStats) {
	// Convert to slice for JSON
	var statsList []*PlayerStats
	for _, s := range stats {
		statsList = append(statsList, s)
	}

	msg := NewMessage("players.update", map[string]interface{}{
		"servers": statsList,
	})

	if err := psc.agent.sendMessage(msg); err != nil {
		log.Printf("[PlayerStats] Failed to send stats update: %v", err)
	} else {
		// Log summary
		total := 0
		for _, s := range statsList {
			total += s.PlayerCount
		}
		log.Printf("[PlayerStats] Sent update: %d servers, %d total players", len(statsList), total)
	}
}
