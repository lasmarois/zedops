package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
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
	DataPath   string            `json:"dataPath"` // Base path for server data storage
}

// CreateServer creates a new Project Zomboid server container
func (dc *DockerClient) CreateServer(ctx context.Context, config ServerConfig) (string, error) {
	log.Printf("Creating server: %s (image: %s:%s)", config.Name, config.Registry, config.ImageTag)

	// Construct full image path
	fullImage := fmt.Sprintf("%s:%s", config.Registry, config.ImageTag)

	// Pull latest image (always check registry for updates)
	log.Printf("Pulling image: %s (checking registry for updates...)", fullImage)
	reader, err := dc.cli.ImagePull(ctx, fullImage, image.PullOptions{
		// Note: Docker will check registry and pull if digest differs from local cache
	})
	if err != nil {
		return "", fmt.Errorf("failed to pull image: %w", err)
	}
	defer reader.Close()

	// Read pull output to ensure it completes (shows download progress in logs)
	// Format: JSON lines with status updates
	pullOutput, err := io.ReadAll(reader)
	if err != nil {
		return "", fmt.Errorf("failed to read pull output: %w", err)
	}

	// Log summary (check if image was updated)
	if len(pullOutput) > 0 {
		// Check if we actually downloaded new layers
		outputStr := string(pullOutput)
		if strings.Contains(outputStr, "Already exists") || strings.Contains(outputStr, "Layer already exists") {
			log.Printf("Image up to date (using cached): %s", fullImage)
		} else if strings.Contains(outputStr, "Pull complete") || strings.Contains(outputStr, "Download complete") {
			log.Printf("Image updated from registry: %s", fullImage)
		} else {
			log.Printf("Image pulled: %s", fullImage)
		}
	}

	// Convert config map to ENV array
	env := make([]string, 0, len(config.Config))
	for key, value := range config.Config {
		env = append(env, fmt.Sprintf("%s=%s", key, value))
	}

	// Create volume directories using configured data path
	basePath := filepath.Join(config.DataPath, config.Name)
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
// If containerID is empty, only removes data directories (for purging soft-deleted servers)
func (dc *DockerClient) DeleteServer(ctx context.Context, containerID string, serverName string, removeVolumes bool) error {
	log.Printf("Deleting server: containerID=%s, serverName=%s, removeVolumes=%v", containerID, serverName, removeVolumes)

	// If containerID is provided, try to remove container
	if containerID != "" {
		// Inspect container to get server name from labels (if not provided)
		if serverName == "" {
			inspect, err := dc.cli.ContainerInspect(ctx, containerID)
			if err != nil {
				log.Printf("Warning: failed to inspect container (may not exist): %v", err)
			} else {
				serverName = inspect.Config.Labels["zedops.server.name"]
			}
		}

		if serverName != "" {
			log.Printf("Removing container for server: %s", serverName)
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
			log.Printf("Warning: failed to remove container (may not exist): %v", err)
		} else {
			log.Printf("Container removed successfully: %s", containerID)
		}
	}

	// Remove volume directories if requested
	// IMPORTANT: This works even if container doesn't exist (for purging soft-deleted servers)
	if removeVolumes && serverName != "" {
		basePath := fmt.Sprintf("/var/lib/zedops/servers/%s", serverName)
		log.Printf("Removing volume directories: %s", basePath)
		if err := os.RemoveAll(basePath); err != nil {
			return fmt.Errorf("failed to remove volumes: %w", err)
		}
		log.Printf("Volumes removed successfully")
	} else if serverName != "" {
		log.Printf("Volumes preserved at: /var/lib/zedops/servers/%s", serverName)
	} else {
		log.Printf("Warning: Cannot determine server name, skipping volume removal")
	}

	return nil
}

// RebuildServer rebuilds a server container with the latest image while preserving volumes
func (dc *DockerClient) RebuildServer(ctx context.Context, containerID string) (string, error) {
	log.Printf("Rebuilding server container: %s", containerID)

	// 1. Inspect existing container to extract config
	inspect, err := dc.cli.ContainerInspect(ctx, containerID)
	if err != nil {
		return "", fmt.Errorf("failed to inspect container: %w", err)
	}

	// Extract necessary config from existing container
	oldImage := inspect.Config.Image
	containerName := strings.TrimPrefix(inspect.Name, "/")
	env := inspect.Config.Env
	labels := inspect.Config.Labels

	// Get port bindings
	portBindings := inspect.HostConfig.PortBindings

	// Get mounts
	mounts := inspect.HostConfig.Mounts

	// Get networks
	networks := inspect.NetworkSettings.Networks
	networkNames := make([]string, 0, len(networks))
	for networkName := range networks {
		networkNames = append(networkNames, networkName)
	}

	log.Printf("Container config extracted: image=%s, name=%s, networks=%v", oldImage, containerName, networkNames)

	// 2. Pull latest image
	log.Printf("Pulling latest image: %s (checking registry for updates...)", oldImage)
	reader, err := dc.cli.ImagePull(ctx, oldImage, image.PullOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to pull image: %w", err)
	}
	defer reader.Close()

	pullOutput, err := io.ReadAll(reader)
	if err != nil {
		return "", fmt.Errorf("failed to read pull output: %w", err)
	}

	// Log pull result
	if len(pullOutput) > 0 {
		outputStr := string(pullOutput)
		if strings.Contains(outputStr, "Already exists") || strings.Contains(outputStr, "Layer already exists") {
			log.Printf("Image up to date (using cached): %s", oldImage)
		} else if strings.Contains(outputStr, "Pull complete") || strings.Contains(outputStr, "Download complete") {
			log.Printf("Image updated from registry: %s", oldImage)
		} else {
			log.Printf("Image pulled: %s", oldImage)
		}
	}

	// 3. Stop and remove old container
	log.Printf("Stopping old container: %s", containerID)
	timeout := 10
	if err := dc.cli.ContainerStop(ctx, containerID, container.StopOptions{Timeout: &timeout}); err != nil {
		log.Printf("Warning: failed to stop container (may already be stopped): %v", err)
	}

	log.Printf("Removing old container: %s", containerID)
	if err := dc.cli.ContainerRemove(ctx, containerID, container.RemoveOptions{
		Force:         true,
		RemoveVolumes: false, // Preserve volumes
	}); err != nil {
		return "", fmt.Errorf("failed to remove old container: %w", err)
	}

	// 4. Create new container with same config
	containerConfig := &container.Config{
		Image:  oldImage,
		Env:    env,
		Labels: labels,
	}

	hostConfig := &container.HostConfig{
		Mounts:       mounts,
		PortBindings: portBindings,
		RestartPolicy: container.RestartPolicy{
			Name: "unless-stopped",
		},
	}

	// Rebuild network config
	networkConfig := &network.NetworkingConfig{
		EndpointsConfig: make(map[string]*network.EndpointSettings),
	}
	for _, networkName := range networkNames {
		networkConfig.EndpointsConfig[networkName] = &network.EndpointSettings{}
	}

	log.Printf("Creating new container: %s", containerName)
	resp, err := dc.cli.ContainerCreate(ctx, containerConfig, hostConfig, networkConfig, nil, containerName)
	if err != nil {
		return "", fmt.Errorf("failed to create new container: %w", err)
	}

	newContainerID := resp.ID
	log.Printf("New container created: %s (ID: %s)", containerName, newContainerID)

	// 5. Start new container
	if err := dc.cli.ContainerStart(ctx, newContainerID, container.StartOptions{}); err != nil {
		// Clean up on failure
		dc.cli.ContainerRemove(ctx, newContainerID, container.RemoveOptions{Force: true})
		return "", fmt.Errorf("failed to start new container: %w", err)
	}

	log.Printf("New container started successfully: %s", newContainerID)
	log.Printf("Server rebuild complete: %s -> %s", containerID, newContainerID)

	return newContainerID, nil
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
	DataPath string            `json:"dataPath"`
}

// ServerDeleteRequest represents a server.delete message payload
type ServerDeleteRequest struct {
	ContainerID   string `json:"containerId"`
	ServerName    string `json:"serverName"`    // NEW: Server name for data removal without container
	RemoveVolumes bool   `json:"removeVolumes"`
}

// ServerRebuildRequest represents a server.rebuild message payload
type ServerRebuildRequest struct {
	ContainerID string `json:"containerId"`
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

// ServerDataStatus represents the data existence status for a server
type ServerDataStatus struct {
	ServerName string `json:"serverName"`
	DataExists bool   `json:"dataExists"`
	BinPath    string `json:"binPath"`
	DataPath   string `json:"dataPath"`
	BinExists  bool   `json:"binExists"`
	DataFolderExists bool `json:"dataFolderExists"`
}

// ServerCheckDataRequest represents a server.checkdata message payload
type ServerCheckDataRequest struct {
	Servers  []string `json:"servers"`  // Array of server names to check
	DataPath string   `json:"dataPath"` // Base path for server data storage
}

// ServerCheckDataResponse represents the response to a server.checkdata message
type ServerCheckDataResponse struct {
	Success  bool               `json:"success"`
	Statuses []ServerDataStatus `json:"statuses"`
	Error    string             `json:"error,omitempty"`
}

// CheckServerData checks if server data directories exist on the host
func (dc *DockerClient) CheckServerData(serverName, dataPath string) ServerDataStatus {
	binPath := filepath.Join(dataPath, serverName, "bin")
	dataFolderPath := filepath.Join(dataPath, serverName, "data")

	// Check if directories exist
	binExists := dirExists(binPath)
	dataFolderExists := dirExists(dataFolderPath)

	return ServerDataStatus{
		ServerName:       serverName,
		DataExists:       binExists || dataFolderExists,
		BinPath:          binPath,
		DataPath:         dataFolderPath,
		BinExists:        binExists,
		DataFolderExists: dataFolderExists,
	}
}

// dirExists checks if a directory exists
func dirExists(path string) bool {
	info, err := os.Stat(path)
	if os.IsNotExist(err) {
		return false
	}
	return err == nil && info.IsDir()
}
