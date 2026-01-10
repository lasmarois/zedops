package main

import (
	"context"
	"encoding/binary"
	"fmt"
	"io"
	"log"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/client"
)

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
		result[i] = ContainerInfo{
			ID:      c.ID,
			Names:   c.Names,
			Image:   c.Image,
			State:   c.State,
			Status:  c.Status,
			Created: c.Created,
			Ports:   convertPorts(c.Ports),
		}
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

// StopContainer stops a container by ID
func (dc *DockerClient) StopContainer(ctx context.Context, containerID string) error {
	log.Printf("Stopping container: %s", containerID)

	timeout := 10
	err := dc.cli.ContainerStop(ctx, containerID, container.StopOptions{Timeout: &timeout})
	if err != nil {
		return fmt.Errorf("failed to stop container %s: %w", containerID, err)
	}

	log.Printf("Container stopped successfully: %s", containerID)
	return nil
}

// RestartContainer restarts a container by ID
func (dc *DockerClient) RestartContainer(ctx context.Context, containerID string) error {
	log.Printf("Restarting container: %s", containerID)

	timeout := 10
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

	return &ContainerInfo{
		ID:      inspect.ID,
		Names:   []string{inspect.Name},
		Image:   inspect.Config.Image,
		State:   inspect.State.Status,
		Status:  fmt.Sprintf("%s (%s)", inspect.State.Status, inspect.State.StartedAt),
		Created: 0, // inspect.Created is a string in newer Docker API
		Ports:   []PortMapping{}, // Would need to parse from inspect
	}, nil
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
	ID      string        `json:"id"`
	Names   []string      `json:"names"`
	Image   string        `json:"image"`
	State   string        `json:"state"`
	Status  string        `json:"status"`
	Created int64         `json:"created"`
	Ports   []PortMapping `json:"ports"`
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
