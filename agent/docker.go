package main

import (
	"context"
	"fmt"
	"log"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
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

// ListContainers returns a list of all containers (running and stopped)
func (dc *DockerClient) ListContainers(ctx context.Context) ([]ContainerInfo, error) {
	containers, err := dc.cli.ContainerList(ctx, container.ListOptions{All: true})
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
