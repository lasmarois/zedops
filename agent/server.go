package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/go-connections/nat"
)

// ServerConfig represents the configuration for creating a server
type ServerConfig struct {
	ServerID   string            `json:"serverId"`
	Name       string            `json:"name"`
	Registry   string            `json:"registry"`
	ImageTag   string            `json:"imageTag"`
	Config     map[string]string `json:"config"` // ENV variables
	GamePort   int               `json:"gamePort"`
	UDPPort    int               `json:"udpPort"`
	RCONPort   int               `json:"rconPort"`
}

// CreateServer creates a new Project Zomboid server container
func (dc *DockerClient) CreateServer(ctx context.Context, config ServerConfig) (string, error) {
	log.Printf("Creating server: %s (image: %s:%s)", config.Name, config.Registry, config.ImageTag)

	// Construct full image path
	fullImage := fmt.Sprintf("%s:%s", config.Registry, config.ImageTag)

	// Convert config map to ENV array
	env := make([]string, 0, len(config.Config))
	for key, value := range config.Config {
		env = append(env, fmt.Sprintf("%s=%s", key, value))
	}

	// Create volume directories
	basePath := fmt.Sprintf("/var/lib/zedops/servers/%s", config.Name)
	binPath := filepath.Join(basePath, "bin")
	dataPath := filepath.Join(basePath, "data")

	if err := os.MkdirAll(binPath, 0755); err != nil {
		return "", fmt.Errorf("failed to create bin directory: %w", err)
	}
	if err := os.MkdirAll(dataPath, 0755); err != nil {
		return "", fmt.Errorf("failed to create data directory: %w", err)
	}

	log.Printf("Created volume directories: %s", basePath)

	// Configure port bindings
	portBindings := nat.PortMap{
		nat.Port(fmt.Sprintf("%d/udp", config.GamePort)): []nat.PortBinding{
			{HostPort: fmt.Sprintf("%d", config.GamePort)},
		},
		nat.Port(fmt.Sprintf("%d/udp", config.UDPPort)): []nat.PortBinding{
			{HostPort: fmt.Sprintf("%d", config.UDPPort)},
		},
	}

	// Expose ports in container config
	exposedPorts := nat.PortSet{
		nat.Port(fmt.Sprintf("%d/udp", config.GamePort)): struct{}{},
		nat.Port(fmt.Sprintf("%d/udp", config.UDPPort)):  struct{}{},
	}

	// Container configuration
	containerConfig := &container.Config{
		Image: fullImage,
		Env:   env,
		Labels: map[string]string{
			"zedops.managed":    "true",
			"zedops.server.id":  config.ServerID,
			"zedops.server.name": config.Name,
			"zedops.type":       "project-zomboid",
			"pz.rcon.enabled":   "true",
		},
		ExposedPorts: exposedPorts,
	}

	// Host configuration
	hostConfig := &container.HostConfig{
		Mounts: []mount.Mount{
			{
				Type:   mount.TypeBind,
				Source: binPath,
				Target: "/home/steam/zomboid-dedicated",
			},
			{
				Type:   mount.TypeBind,
				Source: dataPath,
				Target: "/home/steam/Zomboid",
			},
		},
		PortBindings: portBindings,
		RestartPolicy: container.RestartPolicy{
			Name: "unless-stopped",
		},
	}

	// Network configuration
	networkConfig := &network.NetworkingConfig{
		EndpointsConfig: map[string]*network.EndpointSettings{
			"zomboid-servers": {},
			"zomboid-backend": {},
		},
	}

	// Create container
	containerName := fmt.Sprintf("steam-zomboid-%s", config.Name)
	resp, err := dc.cli.ContainerCreate(ctx, containerConfig, hostConfig, networkConfig, nil, containerName)
	if err != nil {
		return "", fmt.Errorf("failed to create container: %w", err)
	}

	log.Printf("Container created: %s (ID: %s)", containerName, resp.ID)

	// Start container
	if err := dc.cli.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		// Clean up container if start fails
		dc.cli.ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true})
		return "", fmt.Errorf("failed to start container: %w", err)
	}

	log.Printf("Container started successfully: %s", resp.ID)

	return resp.ID, nil
}

// DeleteServer removes a server container and optionally its volumes
func (dc *DockerClient) DeleteServer(ctx context.Context, containerID string, removeVolumes bool) error {
	log.Printf("Deleting server container: %s (removeVolumes: %v)", containerID, removeVolumes)

	// Inspect container to get server name from labels
	inspect, err := dc.cli.ContainerInspect(ctx, containerID)
	if err != nil {
		return fmt.Errorf("failed to inspect container: %w", err)
	}

	serverName := inspect.Config.Labels["zedops.server.name"]
	if serverName == "" {
		return fmt.Errorf("container missing zedops.server.name label")
	}

	// Stop container if running
	log.Printf("Stopping container: %s", containerID)
	timeout := 10
	if err := dc.cli.ContainerStop(ctx, containerID, container.StopOptions{Timeout: &timeout}); err != nil {
		log.Printf("Warning: failed to stop container (may already be stopped): %v", err)
	}

	// Remove container
	log.Printf("Removing container: %s", containerID)
	if err := dc.cli.ContainerRemove(ctx, containerID, container.RemoveOptions{
		Force:         true,
		RemoveVolumes: false, // We manage volumes manually
	}); err != nil {
		return fmt.Errorf("failed to remove container: %w", err)
	}

	log.Printf("Container removed successfully: %s", containerID)

	// Remove volume directories if requested
	if removeVolumes {
		basePath := fmt.Sprintf("/var/lib/zedops/servers/%s", serverName)
		log.Printf("Removing volume directories: %s", basePath)
		if err := os.RemoveAll(basePath); err != nil {
			return fmt.Errorf("failed to remove volumes: %w", err)
		}
		log.Printf("Volumes removed successfully")
	} else {
		log.Printf("Volumes preserved at: /var/lib/zedops/servers/%s", serverName)
	}

	return nil
}

// ServerCreateRequest represents a server.create message payload
type ServerCreateRequest struct {
	ServerID string            `json:"serverId"`
	Name     string            `json:"name"`
	Registry string            `json:"registry"`
	ImageTag string            `json:"imageTag"`
	Config   map[string]string `json:"config"`
	GamePort int               `json:"gamePort"`
	UDPPort  int               `json:"udpPort"`
	RCONPort int               `json:"rconPort"`
}

// ServerDeleteRequest represents a server.delete message payload
type ServerDeleteRequest struct {
	ContainerID   string `json:"containerId"`
	RemoveVolumes bool   `json:"removeVolumes"`
}

// ServerOperationResponse represents the result of a server operation
type ServerOperationResponse struct {
	Success     bool   `json:"success"`
	ServerID    string `json:"serverId,omitempty"`
	ContainerID string `json:"containerId,omitempty"`
	Operation   string `json:"operation"`
	Error       string `json:"error,omitempty"`
	ErrorCode   string `json:"errorCode,omitempty"`
}
