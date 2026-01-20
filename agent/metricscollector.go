package main

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
)

// ServerMetricsPoint represents a single metrics snapshot for a server
type ServerMetricsPoint struct {
	ServerID      string  `json:"serverId"`
	Timestamp     int64   `json:"timestamp"`
	CPUPercent    float64 `json:"cpuPercent"`
	MemoryPercent float64 `json:"memoryPercent"`
	MemoryUsedMB  int64   `json:"memoryUsedMB"`
	MemoryLimitMB int64   `json:"memoryLimitMB"`
	PlayerCount   *int    `json:"playerCount,omitempty"` // nil if not available
}

// MetricsBatch represents a batch of metrics to send to manager
type MetricsBatch struct {
	AgentID string               `json:"agentId"`
	Points  []ServerMetricsPoint `json:"points"`
}

// MetricsCollector collects container metrics periodically and sends to manager
type MetricsCollector struct {
	mu           sync.RWMutex
	docker       *DockerClient
	agent        *Agent
	stopCh       chan struct{}
	pollInterval time.Duration
}

// NewMetricsCollector creates a new metrics collector
func NewMetricsCollector(docker *DockerClient, agent *Agent) *MetricsCollector {
	return &MetricsCollector{
		docker:       docker,
		agent:        agent,
		stopCh:       make(chan struct{}),
		pollInterval: 10 * time.Second,
	}
}

// Start begins the background collection loop
func (mc *MetricsCollector) Start() {
	log.Println("[MetricsCollector] Starting metrics collector (10s interval)")
	go mc.collectLoop()
}

// Stop stops the collector
func (mc *MetricsCollector) Stop() {
	log.Println("[MetricsCollector] Stopping metrics collector")
	close(mc.stopCh)
}

// collectLoop runs the main collection loop
func (mc *MetricsCollector) collectLoop() {
	// Wait a bit before first collection to let things initialize
	time.Sleep(5 * time.Second)

	// Initial collection
	mc.collectAndSend()

	ticker := time.NewTicker(mc.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-mc.stopCh:
			return
		case <-ticker.C:
			mc.collectAndSend()
		}
	}
}

// collectAndSend collects metrics from all running containers and sends to manager
func (mc *MetricsCollector) collectAndSend() {
	// Don't send metrics if not authenticated
	if !mc.agent.IsAuthenticated() {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	// Get all running ZedOps-managed containers
	filterArgs := filters.NewArgs()
	filterArgs.Add("label", "zedops.managed=true")
	filterArgs.Add("status", "running")

	containers, err := mc.docker.cli.ContainerList(ctx, container.ListOptions{
		Filters: filterArgs,
	})
	if err != nil {
		log.Printf("[MetricsCollector] Failed to list containers: %v", err)
		return
	}

	if len(containers) == 0 {
		// No running containers, nothing to collect
		log.Printf("[MetricsCollector] No running ZedOps-managed containers found")
		return
	}
	log.Printf("[MetricsCollector] Found %d running containers", len(containers))

	// Collect metrics for each container
	var points []ServerMetricsPoint
	now := time.Now().Unix()

	// Get player stats for cross-reference
	var playerStats map[string]*PlayerStats
	if mc.agent.playerStats != nil {
		playerStats = mc.agent.playerStats.GetStats()
	}

	for _, c := range containers {
		// Get server ID from label
		serverID, ok := c.Labels["zedops.server.id"]
		if !ok {
			continue // Skip containers without server ID
		}

		// Collect container metrics
		metrics, err := mc.docker.CollectContainerMetrics(ctx, c.ID)
		if err != nil {
			log.Printf("[MetricsCollector] Failed to collect metrics for %s: %v", c.ID[:12], err)
			continue
		}

		// Calculate memory percentage
		memoryPercent := 0.0
		if metrics.MemoryLimitMB > 0 {
			memoryPercent = float64(metrics.MemoryUsedMB) / float64(metrics.MemoryLimitMB) * 100
		}

		point := ServerMetricsPoint{
			ServerID:      serverID,
			Timestamp:     now,
			CPUPercent:    metrics.CPUPercent,
			MemoryPercent: memoryPercent,
			MemoryUsedMB:  metrics.MemoryUsedMB,
			MemoryLimitMB: metrics.MemoryLimitMB,
		}

		// Add player count if available
		if ps, ok := playerStats[serverID]; ok {
			point.PlayerCount = &ps.PlayerCount
		}

		points = append(points, point)
	}

	if len(points) == 0 {
		return // No metrics collected
	}

	// Send batch to manager
	batch := MetricsBatch{
		AgentID: mc.agent.agentID,
		Points:  points,
	}

	if err := mc.sendMetricsBatch(batch); err != nil {
		log.Printf("[MetricsCollector] Failed to send metrics batch: %v", err)
	} else {
		log.Printf("[MetricsCollector] Sent batch: %d servers", len(points))
	}
}

// sendMetricsBatch sends the metrics batch to the manager
func (mc *MetricsCollector) sendMetricsBatch(batch MetricsBatch) error {
	msg := Message{
		Subject: "server.metrics.batch",
		Data:    batch, // Pass struct directly, not marshaled bytes
	}

	return mc.agent.sendMessage(msg)
}
