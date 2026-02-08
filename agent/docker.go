package main

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"sort"
	"strings"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	"github.com/google/go-containerregistry/pkg/crane"
	"github.com/gorcon/rcon"
)

// GracefulStopTimeout is the Docker stop timeout after RCON save (seconds)
const GracefulStopTimeout = 30

// RequiredNetworks lists Docker networks the agent needs for server communication
var RequiredNetworks = []string{"zomboid-backend", "zomboid-servers"}

// DockerClient wraps the Docker client and provides container operations
type DockerClient struct {
	cli *client.Client
}

// NewDockerClient creates a new Docker client
func NewDockerClient() (*DockerClient, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, fmt.Errorf("failed to create Docker client: %w", err)
	}

	return &DockerClient{cli: cli}, nil
}

// Close closes the Docker client
func (dc *DockerClient) Close() error {
	if dc.cli != nil {
		return dc.cli.Close()
	}
	return nil
}

// GracefulSave inspects a running container's ENV for RCON_PORT and RCON_PASSWORD,
// connects to RCON via the zomboid-backend network, and sends a "save" command.
// Returns true if save succeeded. Failures are non-fatal (logged but don't block the operation).
func (dc *DockerClient) GracefulSave(ctx context.Context, containerID string) bool {
	if containerID == "" {
		return false
	}

	inspect, err := dc.cli.ContainerInspect(ctx, containerID)
	if err != nil {
		log.Printf("[GracefulSave] Failed to inspect container %s: %v", containerID, err)
		return false
	}

	// Only attempt save on running containers
	if !inspect.State.Running {
		log.Printf("[GracefulSave] Container %s is not running, skipping save", containerID)
		return false
	}

	// Extract RCON_PORT and RCON_PASSWORD from container ENV
	var rconPort string
	var rconPassword string
	for _, env := range inspect.Config.Env {
		if strings.HasPrefix(env, "RCON_PORT=") {
			rconPort = strings.TrimPrefix(env, "RCON_PORT=")
		} else if strings.HasPrefix(env, "RCON_PASSWORD=") {
			rconPassword = strings.TrimPrefix(env, "RCON_PASSWORD=")
		}
	}

	if rconPort == "" || rconPassword == "" {
		log.Printf("[GracefulSave] Container %s missing RCON_PORT or RCON_PASSWORD ENV, skipping save", containerID)
		return false
	}

	// Get container IP on zomboid-backend network
	net := inspect.NetworkSettings.Networks["zomboid-backend"]
	if net == nil || net.IPAddress == "" {
		log.Printf("[GracefulSave] Container %s not on zomboid-backend network, skipping save", containerID)
		return false
	}

	addr := fmt.Sprintf("%s:%s", net.IPAddress, rconPort)
	log.Printf("[GracefulSave] Connecting to RCON at %s for pre-stop save", addr)

	conn, err := rcon.Dial(addr, rconPassword, rcon.SetDialTimeout(5*time.Second))
	if err != nil {
		log.Printf("[GracefulSave] RCON connection failed: %v", err)
		return false
	}
	defer conn.Close()

	_, err = conn.Execute("save")
	if err != nil {
		log.Printf("[GracefulSave] RCON save command failed: %v", err)
		return false
	}

	log.Printf("[GracefulSave] Save command sent, waiting 3s for disk flush")
	time.Sleep(3 * time.Second)
	return true
}

// EnsureNetworks creates required Docker networks if they don't exist
// This is called on agent startup to ensure server containers can be created
func (dc *DockerClient) EnsureNetworks(ctx context.Context) error {
	// List existing networks
	networks, err := dc.cli.NetworkList(ctx, network.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list networks: %w", err)
	}

	// Build set of existing network names
	existing := make(map[string]bool)
	for _, n := range networks {
		existing[n.Name] = true
	}

	// Create missing networks
	for _, netName := range RequiredNetworks {
		if existing[netName] {
			log.Printf("Docker network '%s' already exists", netName)
			continue
		}

		log.Printf("Creating Docker network: %s", netName)
		_, err := dc.cli.NetworkCreate(ctx, netName, network.CreateOptions{
			Driver: "bridge",
			Labels: map[string]string{
				"zedops.managed": "true",
			},
		})
		if err != nil {
			return fmt.Errorf("failed to create network %s: %w", netName, err)
		}
		log.Printf("Created Docker network: %s", netName)
	}

	return nil
}

// ListContainers returns a list of all ZedOps-managed containers (running and stopped)
// Only returns containers with the label: zedops.managed=true
func (dc *DockerClient) ListContainers(ctx context.Context) ([]ContainerInfo, error) {
	// Create filter for ZedOps-managed containers
	filterArgs := filters.NewArgs()
	filterArgs.Add("label", "zedops.managed=true")

	containers, err := dc.cli.ContainerList(ctx, container.ListOptions{
		All:     true,
		Filters: filterArgs,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list containers: %w", err)
	}

	result := make([]ContainerInfo, len(containers))
	for i, c := range containers {
		info := ContainerInfo{
			ID:      c.ID,
			Names:   c.Names,
			Image:   c.Image,
			State:   c.State,
			Status:  c.Status,
			Created: c.Created,
			Ports:   convertPorts(c.Ports),
			Labels:  c.Labels, // Include container labels for sync matching
		}

		// Extract OCI version label from container labels
		if version, ok := c.Labels["org.opencontainers.image.version"]; ok {
			info.ImageVersion = version
		}

		// For running containers, get health status via ContainerInspect
		// The ContainerList API doesn't include health info directly
		if c.State == "running" {
			inspect, err := dc.cli.ContainerInspect(ctx, c.ID)
			if err == nil && inspect.State != nil && inspect.State.Health != nil {
				// Health check configured - get status: "starting", "healthy", "unhealthy"
				info.Health = inspect.State.Health.Status
			}
			// If no health check configured, info.Health remains "" (empty)
		}

		result[i] = info
	}

	return result, nil
}

// StartContainer starts a container by ID
func (dc *DockerClient) StartContainer(ctx context.Context, containerID string) error {
	log.Printf("Starting container: %s", containerID)

	err := dc.cli.ContainerStart(ctx, containerID, container.StartOptions{})
	if err != nil {
		return fmt.Errorf("failed to start container %s: %w", containerID, err)
	}

	log.Printf("Container started successfully: %s", containerID)
	return nil
}

// StopContainer stops a container by ID with graceful RCON save
func (dc *DockerClient) StopContainer(ctx context.Context, containerID string) error {
	log.Printf("Stopping container: %s", containerID)

	// Attempt graceful save before stopping
	dc.GracefulSave(ctx, containerID)

	timeout := GracefulStopTimeout
	err := dc.cli.ContainerStop(ctx, containerID, container.StopOptions{Timeout: &timeout})
	if err != nil {
		return fmt.Errorf("failed to stop container %s: %w", containerID, err)
	}

	log.Printf("Container stopped successfully: %s", containerID)
	return nil
}

// RestartContainer restarts a container by ID with graceful RCON save
func (dc *DockerClient) RestartContainer(ctx context.Context, containerID string) error {
	log.Printf("Restarting container: %s", containerID)

	// Attempt graceful save before restarting
	dc.GracefulSave(ctx, containerID)

	timeout := GracefulStopTimeout
	err := dc.cli.ContainerRestart(ctx, containerID, container.StopOptions{Timeout: &timeout})
	if err != nil {
		return fmt.Errorf("failed to restart container %s: %w", containerID, err)
	}

	log.Printf("Container restarted successfully: %s", containerID)
	return nil
}

// GetContainerStatus gets the current status of a container
func (dc *DockerClient) GetContainerStatus(ctx context.Context, containerID string) (*ContainerInfo, error) {
	inspect, err := dc.cli.ContainerInspect(ctx, containerID)
	if err != nil {
		return nil, fmt.Errorf("failed to inspect container %s: %w", containerID, err)
	}

	info := &ContainerInfo{
		ID:      inspect.ID,
		Names:   []string{inspect.Name},
		Image:   inspect.Config.Image,
		State:   inspect.State.Status,
		Status:  fmt.Sprintf("%s (%s)", inspect.State.Status, inspect.State.StartedAt),
		Created: 0, // inspect.Created is a string in newer Docker API
		Ports:   []PortMapping{}, // Would need to parse from inspect
	}

	// Include health status if available
	if inspect.State != nil && inspect.State.Health != nil {
		info.Health = inspect.State.Health.Status
	}

	return info, nil
}

// Ping tests the connection to Docker daemon
func (dc *DockerClient) Ping(ctx context.Context) error {
	_, err := dc.cli.Ping(ctx)
	if err != nil {
		return fmt.Errorf("failed to ping Docker daemon: %w", err)
	}
	return nil
}

// convertPorts converts Docker API port format to our PortMapping format
func convertPorts(ports []types.Port) []PortMapping {
	result := make([]PortMapping, len(ports))
	for i, p := range ports {
		result[i] = PortMapping{
			PrivatePort: int(p.PrivatePort),
			PublicPort:  int(p.PublicPort),
			Type:        p.Type,
		}
	}
	return result
}

// ContainerInfo represents container metadata
type ContainerInfo struct {
	ID           string            `json:"id"`
	Names        []string          `json:"names"`
	Image        string            `json:"image"`
	ImageVersion string            `json:"image_version,omitempty"` // OCI version label from image (e.g., "2.1.4")
	State        string            `json:"state"`
	Status       string            `json:"status"`
	Health       string            `json:"health,omitempty"` // Health check status: "starting", "healthy", "unhealthy", or "" (no healthcheck)
	Created      int64             `json:"created"`
	Ports        []PortMapping     `json:"ports"`
	Labels       map[string]string `json:"labels"` // Container labels (for sync matching)
}

// PortMapping represents a port mapping
type PortMapping struct {
	PrivatePort int    `json:"privatePort"`
	PublicPort  int    `json:"publicPort"`
	Type        string `json:"type"` // tcp, udp
}

// ContainerOperation represents a container operation request
type ContainerOperation struct {
	ContainerID string `json:"containerId"`
	Operation   string `json:"operation"` // start, stop, restart
}

// ContainerOperationResponse represents the result of a container operation
type ContainerOperationResponse struct {
	Success     bool   `json:"success"`
	ContainerID string `json:"containerId"`
	Operation   string `json:"operation"`
	Error       string `json:"error,omitempty"`
	ErrorCode   string `json:"errorCode,omitempty"`
}

// LogLine represents a single line from container logs
type LogLine struct {
	ContainerID string `json:"containerId"`
	Timestamp   int64  `json:"timestamp"` // Unix timestamp in milliseconds
	Stream      string `json:"stream"`    // stdout or stderr
	Message     string `json:"message"`
}

// StreamContainerLogs streams logs from a container
// Returns a channel that receives log lines and an error channel
func (dc *DockerClient) StreamContainerLogs(ctx context.Context, containerID string, tail int) (<-chan LogLine, <-chan error) {
	logChan := make(chan LogLine, 100) // Buffer for log lines
	errChan := make(chan error, 1)

	go func() {
		defer close(logChan)
		defer close(errChan)

		// Configure log options
		options := container.LogsOptions{
			ShowStdout: true,
			ShowStderr: true,
			Follow:     true,
			Timestamps: true,
			Tail:       fmt.Sprintf("%d", tail),
		}

		// Get log stream
		reader, err := dc.cli.ContainerLogs(ctx, containerID, options)
		if err != nil {
			errChan <- fmt.Errorf("failed to get container logs: %w", err)
			return
		}
		defer reader.Close()

		log.Printf("Started streaming logs for container: %s", containerID)

		// Docker uses multiplexed stream format
		// Read 8-byte header + payload
		header := make([]byte, 8)
		for {
			select {
			case <-ctx.Done():
				log.Printf("Stopped streaming logs for container: %s", containerID)
				return
			default:
			}

			// Read header
			_, err := io.ReadFull(reader, header)
			if err != nil {
				if err == io.EOF {
					log.Printf("Log stream ended for container: %s", containerID)
					return
				}
				errChan <- fmt.Errorf("failed to read log header: %w", err)
				return
			}

			// Parse header
			// Byte 0: Stream type (0=stdin, 1=stdout, 2=stderr)
			// Bytes 4-7: Frame size (big-endian uint32)
			streamType := header[0]
			frameSize := binary.BigEndian.Uint32(header[4:8])

			// Read payload
			payload := make([]byte, frameSize)
			_, err = io.ReadFull(reader, payload)
			if err != nil {
				errChan <- fmt.Errorf("failed to read log payload: %w", err)
				return
			}

			// Parse log line
			// Docker format with timestamps: "2024-01-10T12:34:56.789Z message here"
			line := string(payload)

			// Determine stream name
			var stream string
			switch streamType {
			case 1:
				stream = "stdout"
			case 2:
				stream = "stderr"
			default:
				stream = "unknown"
			}

			// Parse timestamp and message
			timestamp, message := parseLogLine(line)

			// Send log line to channel
			logLine := LogLine{
				ContainerID: containerID,
				Timestamp:   timestamp,
				Stream:      stream,
				Message:     message,
			}

			select {
			case logChan <- logLine:
				// Successfully sent
			case <-ctx.Done():
				return
			}
		}
	}()

	return logChan, errChan
}

// parseLogLine parses a Docker log line with timestamp
// Format: "2024-01-10T12:34:56.789123456Z message here"
// Returns timestamp in milliseconds and the message
func parseLogLine(line string) (int64, string) {
	// Find the space after timestamp
	spaceIndex := -1
	for i := 0; i < len(line) && i < 40; i++ {
		if line[i] == ' ' {
			spaceIndex = i
			break
		}
	}

	if spaceIndex == -1 {
		// No timestamp found, use current time
		return time.Now().UnixMilli(), line
	}

	timestampStr := line[:spaceIndex]
	message := line[spaceIndex+1:]

	// Parse timestamp
	t, err := time.Parse(time.RFC3339Nano, timestampStr)
	if err != nil {
		// Failed to parse, use current time
		return time.Now().UnixMilli(), line
	}

	return t.UnixMilli(), message
}

// ContainerMetrics represents container resource usage metrics
type ContainerMetrics struct {
	ContainerID   string  `json:"containerId"`
	CPUPercent    float64 `json:"cpuPercent"`
	MemoryUsedMB  int64   `json:"memoryUsedMB"`
	MemoryLimitMB int64   `json:"memoryLimitMB"`
	DiskReadMB    int64   `json:"diskReadMB"`
	DiskWriteMB   int64   `json:"diskWriteMB"`
	Uptime        string  `json:"uptime"`        // Human-readable: "2h 34m"
	UptimeSeconds int64   `json:"uptimeSeconds"` // Raw seconds for calculations
}

// StatsData represents Docker container stats JSON structure
type StatsData struct {
	CPUStats struct {
		CPUUsage struct {
			TotalUsage  uint64   `json:"total_usage"`
			PercpuUsage []uint64 `json:"percpu_usage"`
		} `json:"cpu_usage"`
		SystemUsage uint64 `json:"system_cpu_usage"`
		OnlineCPUs  uint64 `json:"online_cpus"`
	} `json:"cpu_stats"`
	PreCPUStats struct {
		CPUUsage struct {
			TotalUsage uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemUsage uint64 `json:"system_cpu_usage"`
	} `json:"precpu_stats"`
	MemoryStats struct {
		Usage uint64 `json:"usage"`
		Limit uint64 `json:"limit"`
	} `json:"memory_stats"`
	BlkioStats struct {
		IoServiceBytesRecursive []struct {
			Op    string `json:"op"`
			Value uint64 `json:"value"`
		} `json:"io_service_bytes_recursive"`
	} `json:"blkio_stats"`
}

// CollectContainerMetrics collects resource usage metrics for a specific container
func (dc *DockerClient) CollectContainerMetrics(ctx context.Context, containerID string) (*ContainerMetrics, error) {
	// Get container stats (one-time snapshot, not streaming)
	stats, err := dc.cli.ContainerStats(ctx, containerID, false)
	if err != nil {
		return nil, fmt.Errorf("failed to get container stats: %w", err)
	}
	defer stats.Body.Close()

	// Decode stats JSON
	var statsJSON StatsData
	decoder := json.NewDecoder(stats.Body)
	if err := decoder.Decode(&statsJSON); err != nil {
		return nil, fmt.Errorf("failed to decode stats JSON: %w", err)
	}

	// Calculate CPU percentage
	cpuPercent := calculateCPUPercent(&statsJSON)

	// Get memory stats (convert bytes to MB)
	memoryUsedMB := int64(statsJSON.MemoryStats.Usage / 1024 / 1024)
	memoryLimitMB := int64(statsJSON.MemoryStats.Limit / 1024 / 1024)

	// Get disk I/O stats (convert bytes to MB)
	var diskReadMB, diskWriteMB int64
	for _, bioEntry := range statsJSON.BlkioStats.IoServiceBytesRecursive {
		if bioEntry.Op == "read" || bioEntry.Op == "Read" {
			diskReadMB += int64(bioEntry.Value / 1024 / 1024)
		} else if bioEntry.Op == "write" || bioEntry.Op == "Write" {
			diskWriteMB += int64(bioEntry.Value / 1024 / 1024)
		}
	}

	// Get uptime
	uptime, uptimeSeconds, err := dc.GetContainerUptime(ctx, containerID)
	if err != nil {
		log.Printf("Warning: failed to get container uptime: %v", err)
		uptime = "N/A"
		uptimeSeconds = 0
	}

	return &ContainerMetrics{
		ContainerID:   containerID,
		CPUPercent:    cpuPercent,
		MemoryUsedMB:  memoryUsedMB,
		MemoryLimitMB: memoryLimitMB,
		DiskReadMB:    diskReadMB,
		DiskWriteMB:   diskWriteMB,
		Uptime:        uptime,
		UptimeSeconds: uptimeSeconds,
	}, nil
}

// calculateCPUPercent calculates CPU usage percentage from Docker stats
func calculateCPUPercent(stats *StatsData) float64 {
	// Calculate the change in CPU usage
	cpuDelta := float64(stats.CPUStats.CPUUsage.TotalUsage - stats.PreCPUStats.CPUUsage.TotalUsage)

	// Calculate the change in system CPU usage
	systemDelta := float64(stats.CPUStats.SystemUsage - stats.PreCPUStats.SystemUsage)

	// Get number of CPUs
	onlineCPUs := float64(stats.CPUStats.OnlineCPUs)
	if onlineCPUs == 0 {
		// Fallback to number of CPU stats
		onlineCPUs = float64(len(stats.CPUStats.CPUUsage.PercpuUsage))
		if onlineCPUs == 0 {
			onlineCPUs = 1 // Minimum 1 CPU
		}
	}

	// Calculate CPU percentage
	cpuPercent := 0.0
	if systemDelta > 0 && cpuDelta > 0 {
		cpuPercent = (cpuDelta / systemDelta) * onlineCPUs * 100.0
	}

	return cpuPercent
}

// GetContainerUptime gets the uptime for a specific container
// Returns human-readable uptime string and raw seconds
func (dc *DockerClient) GetContainerUptime(ctx context.Context, containerID string) (string, int64, error) {
	// Inspect container to get start time
	inspect, err := dc.cli.ContainerInspect(ctx, containerID)
	if err != nil {
		return "", 0, fmt.Errorf("failed to inspect container: %w", err)
	}

	// Check if container is running
	if !inspect.State.Running {
		return "Not running", 0, nil
	}

	// Parse start time
	startedAt, err := time.Parse(time.RFC3339Nano, inspect.State.StartedAt)
	if err != nil {
		return "", 0, fmt.Errorf("failed to parse StartedAt: %w", err)
	}

	// Calculate uptime
	uptime := time.Since(startedAt)
	uptimeSeconds := int64(uptime.Seconds())

	// Format uptime as human-readable string
	uptimeStr := formatUptime(uptime)

	return uptimeStr, uptimeSeconds, nil
}

// formatUptime formats a duration as a human-readable uptime string
// Examples: "5m", "2h 34m", "3d 12h"
func formatUptime(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%ds", int(d.Seconds()))
	}

	days := int(d.Hours()) / 24
	hours := int(d.Hours()) % 24
	minutes := int(d.Minutes()) % 60

	if days > 0 {
		if hours > 0 {
			return fmt.Sprintf("%dd %dh", days, hours)
		}
		return fmt.Sprintf("%dd", days)
	}

	if hours > 0 {
		if minutes > 0 {
			return fmt.Sprintf("%dh %dm", hours, minutes)
		}
		return fmt.Sprintf("%dh", hours)
	}

	return fmt.Sprintf("%dm", minutes)
}

// GetImageDefaults inspects a local Docker image and returns default ENV variables
// The image must already be pulled locally (returns error if not found)
// If the exact image tag is not found, tries to find an image with a matching tag
func (dc *DockerClient) GetImageDefaults(ctx context.Context, imageTag string) (map[string]string, error) {
	// Try direct inspection first
	inspect, err := dc.cli.ImageInspect(ctx, imageTag)
	if err != nil {
		// If direct inspection fails, try to find an image with matching tag
		log.Printf("Direct inspection of '%s' failed, searching for images with matching tag...", imageTag)

		images, listErr := dc.cli.ImageList(ctx, image.ListOptions{})
		if listErr != nil {
			return nil, fmt.Errorf("failed to list images: %w", listErr)
		}

		// Look for an image where one of its RepoTags matches the pattern
		var matchedImage string
		for _, img := range images {
			for _, tag := range img.RepoTags {
				// Check if this tag ends with the provided imageTag
				// e.g., "registry.gitlab.../steam-zomboid:latest" matches ":latest"
				if strings.HasSuffix(tag, ":"+imageTag) || tag == imageTag {
					matchedImage = tag
					log.Printf("Found matching image: %s", matchedImage)
					break
				}
			}
			if matchedImage != "" {
				break
			}
		}

		if matchedImage == "" {
			return nil, fmt.Errorf("no image found matching tag '%s': %w", imageTag, err)
		}

		// Try inspecting with the matched image name
		inspect, err = dc.cli.ImageInspect(ctx, matchedImage)
		if err != nil {
			return nil, fmt.Errorf("failed to inspect matched image %s: %w", matchedImage, err)
		}
	}

	// Parse ENV array (format: "KEY=VALUE") into map
	defaults := make(map[string]string)
	for _, env := range inspect.Config.Env {
		parts := strings.SplitN(env, "=", 2)
		if len(parts) == 2 {
			defaults[parts[0]] = parts[1]
		}
	}

	log.Printf("Extracted %d ENV defaults from image %s", len(defaults), imageTag)
	return defaults, nil
}

// ListRegistryTags queries a container registry for available tags
// Uses go-containerregistry/crane which auto-reads Docker credentials
func ListRegistryTags(registry string) ([]string, error) {
	if registry == "" {
		return nil, fmt.Errorf("registry is required")
	}

	log.Printf("Fetching tags from registry: %s", registry)

	rawTags, err := crane.ListTags(registry)
	if err != nil {
		return nil, fmt.Errorf("failed to list tags from %s: %w", registry, err)
	}

	// Filter out non-image tags (e.g., BuildKit cache manifests)
	tags := make([]string, 0, len(rawTags))
	for _, tag := range rawTags {
		if tag == "buildcache" || strings.HasPrefix(tag, "buildcache-") {
			continue
		}
		tags = append(tags, tag)
	}

	// Sort: "latest" first, then semver descending
	sort.Slice(tags, func(i, j int) bool {
		if tags[i] == "latest" {
			return true
		}
		if tags[j] == "latest" {
			return false
		}
		// Reverse alphabetical (works for semver with same prefix)
		return tags[i] > tags[j]
	})

	log.Printf("Found %d tags from registry %s", len(tags), registry)
	return tags, nil
}
