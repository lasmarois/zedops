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

	// Inspect container to get the resolved full image name
	// This is important because user might provide just "latest" but Docker
	// resolves it to full name like "registry.gitlab.com/user/image:latest"
	inspect, err := dc.cli.ContainerInspect(ctx, resp.ID)
	if err != nil {
		log.Printf("Warning: failed to inspect container for image name: %v", err)
		// Don't fail the creation, just return container ID
		return resp.ID, nil
	}

	log.Printf("Resolved image name: %s (from tag: %s)", inspect.Config.Image, fullImage)

	return resp.ID, nil
}

// DeleteServer removes a server container and optionally its volumes
// If containerID is empty, only removes data directories (for purging soft-deleted servers)
func (dc *DockerClient) DeleteServer(ctx context.Context, containerID string, serverName string, removeVolumes bool, dataPath string) error {
	log.Printf("Deleting server: containerID=%s, serverName=%s, removeVolumes=%v, dataPath=%s", containerID, serverName, removeVolumes, dataPath)

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
	if removeVolumes && serverName != "" && dataPath != "" {
		basePath := filepath.Join(dataPath, serverName)
		log.Printf("Removing volume directories: %s", basePath)
		if err := os.RemoveAll(basePath); err != nil {
			return fmt.Errorf("failed to remove volumes: %w", err)
		}
		log.Printf("Volumes removed successfully")
	} else if serverName != "" && dataPath != "" {
		log.Printf("Volumes preserved at: %s", filepath.Join(dataPath, serverName))
	} else {
		log.Printf("Warning: Cannot determine server name or data path, skipping volume removal")
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

// RebuildServerWithConfig rebuilds a server container, optionally with new configuration
func (dc *DockerClient) RebuildServerWithConfig(ctx context.Context, req ServerRebuildRequest) (string, error) {
	log.Printf("Rebuilding server container: %s", req.ContainerID)

	// If new config provided, use it; otherwise use existing container config
	if req.Name != "" && req.Registry != "" && req.Config != nil {
		log.Printf("Rebuilding with new configuration (config update mode)")
		return dc.rebuildWithNewConfig(ctx, req)
	}

	// Default: simple rebuild with existing config
	log.Printf("Rebuilding with existing configuration (simple rebuild mode)")
	return dc.RebuildServer(ctx, req.ContainerID)
}

// rebuildWithNewConfig rebuilds a server with new configuration
func (dc *DockerClient) rebuildWithNewConfig(ctx context.Context, req ServerRebuildRequest) (string, error) {
	// 1. Inspect existing container to get name and labels
	inspect, err := dc.cli.ContainerInspect(ctx, req.ContainerID)
	if err != nil {
		return "", fmt.Errorf("failed to inspect container: %w", err)
	}

	containerName := strings.TrimPrefix(inspect.Name, "/")
	labels := inspect.Config.Labels

	// Get networks
	networks := inspect.NetworkSettings.Networks
	networkNames := make([]string, 0, len(networks))
	for networkName := range networks {
		networkNames = append(networkNames, networkName)
	}

	log.Printf("Container config extracted: name=%s, networks=%v", containerName, networkNames)

	// 2. Construct full image path
	// Check if ImageTag already contains a colon (full image reference like "registry.com/repo/image:tag")
	// This handles both old format (Registry="repo/image", ImageTag="latest")
	// and new format (Registry="repo/image", ImageTag="repo/image:latest")
	var fullImage string
	if strings.Contains(req.ImageTag, ":") {
		// ImageTag is already a full image reference
		fullImage = req.ImageTag
	} else {
		// ImageTag is just a tag, construct from Registry:Tag
		fullImage = fmt.Sprintf("%s:%s", req.Registry, req.ImageTag)
	}

	// 3. Pull latest image
	log.Printf("Pulling image: %s (checking registry for updates...)", fullImage)
	reader, err := dc.cli.ImagePull(ctx, fullImage, image.PullOptions{})
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
			log.Printf("Image up to date (using cached): %s", fullImage)
		} else if strings.Contains(outputStr, "Pull complete") || strings.Contains(outputStr, "Download complete") {
			log.Printf("Image updated from registry: %s", fullImage)
		} else {
			log.Printf("Image pulled: %s", fullImage)
		}
	}

	// 4. Convert config map to ENV array
	env := make([]string, 0, len(req.Config))
	for key, value := range req.Config {
		env = append(env, fmt.Sprintf("%s=%s", key, value))
	}

	// 5. Setup volume directories with new data path
	basePath := filepath.Join(req.DataPath, req.Name)
	binPath := filepath.Join(basePath, "bin")
	dataPath := filepath.Join(basePath, "data")

	// Note: directories should already exist from initial creation
	log.Printf("Using volume directories: %s", basePath)

	// 6. Configure port bindings
	portBindings := nat.PortMap{
		nat.Port(fmt.Sprintf("%d/udp", req.GamePort)): []nat.PortBinding{
			{HostPort: fmt.Sprintf("%d", req.GamePort)},
		},
		nat.Port(fmt.Sprintf("%d/udp", req.UDPPort)): []nat.PortBinding{
			{HostPort: fmt.Sprintf("%d", req.UDPPort)},
		},
	}

	exposedPorts := nat.PortSet{
		nat.Port(fmt.Sprintf("%d/udp", req.GamePort)): struct{}{},
		nat.Port(fmt.Sprintf("%d/udp", req.UDPPort)):  struct{}{},
	}

	// 7. Stop and remove old container
	log.Printf("Stopping old container: %s", req.ContainerID)
	timeout := 10
	if err := dc.cli.ContainerStop(ctx, req.ContainerID, container.StopOptions{Timeout: &timeout}); err != nil {
		log.Printf("Warning: failed to stop container (may already be stopped): %v", err)
	}

	log.Printf("Removing old container: %s", req.ContainerID)
	if err := dc.cli.ContainerRemove(ctx, req.ContainerID, container.RemoveOptions{
		Force:         true,
		RemoveVolumes: false, // Preserve volumes
	}); err != nil {
		return "", fmt.Errorf("failed to remove old container: %w", err)
	}

	// 8. Create new container with new config
	containerConfig := &container.Config{
		Image:        fullImage,
		Env:          env,
		Labels:       labels,
		ExposedPorts: exposedPorts,
	}

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

	// Rebuild network config
	networkConfig := &network.NetworkingConfig{
		EndpointsConfig: make(map[string]*network.EndpointSettings),
	}
	for _, networkName := range networkNames {
		networkConfig.EndpointsConfig[networkName] = &network.EndpointSettings{}
	}

	log.Printf("Creating new container with updated config: %s", containerName)
	resp, err := dc.cli.ContainerCreate(ctx, containerConfig, hostConfig, networkConfig, nil, containerName)
	if err != nil {
		return "", fmt.Errorf("failed to create new container: %w", err)
	}

	newContainerID := resp.ID
	log.Printf("New container created: %s (ID: %s)", containerName, newContainerID)

	// 9. Start new container
	if err := dc.cli.ContainerStart(ctx, newContainerID, container.StartOptions{}); err != nil {
		// Clean up on failure
		dc.cli.ContainerRemove(ctx, newContainerID, container.RemoveOptions{Force: true})
		return "", fmt.Errorf("failed to start new container: %w", err)
	}

	log.Printf("New container started successfully with updated configuration: %s", newContainerID)
	log.Printf("Server rebuild complete: %s -> %s", req.ContainerID, newContainerID)

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
	ServerName    string `json:"serverName"`    // Server name for data removal without container
	RemoveVolumes bool   `json:"removeVolumes"`
	DataPath      string `json:"dataPath"`      // Base path for server data storage
}

// ServerRebuildRequest represents a server.rebuild message payload
type ServerRebuildRequest struct {
	ContainerID string `json:"containerId"`
	// Optional: New config for rebuild (if not provided, uses existing container config)
	Name     string            `json:"name,omitempty"`
	Registry string            `json:"registry,omitempty"`
	ImageTag string            `json:"imageTag,omitempty"`
	Config   map[string]string `json:"config,omitempty"`
	GamePort int               `json:"gamePort,omitempty"`
	UDPPort  int               `json:"udpPort,omitempty"`
	RCONPort int               `json:"rconPort,omitempty"`
	DataPath string            `json:"dataPath,omitempty"`
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

// ServerMoveDataRequest represents a server.movedata message payload
type ServerMoveDataRequest struct {
	ServerName string `json:"serverName"` // Server name (directory name under data path)
	OldPath    string `json:"oldPath"`    // Old base data path
	NewPath    string `json:"newPath"`    // New base data path
}

// MoveProgress represents progress updates during data migration
type MoveProgress struct {
	ServerName  string `json:"serverName"`            // Server being moved (for frontend filtering)
	Phase       string `json:"phase"`                 // "calculating", "copying", "verifying", "cleaning", "complete", "error"
	Percent     int    `json:"percent"`               // 0-100
	CurrentFile string `json:"currentFile,omitempty"` // File being copied
	BytesCopied int64  `json:"bytesCopied"`
	TotalBytes  int64  `json:"totalBytes"`
	FilesCopied int    `json:"filesCopied"`
	TotalFiles  int    `json:"totalFiles"`
	Error       string `json:"error,omitempty"`
}

// ServerMoveDataResponse represents the response to a server.movedata message
type ServerMoveDataResponse struct {
	Success     bool   `json:"success"`
	ServerName  string `json:"serverName"`
	OldPath     string `json:"oldPath"`
	NewPath     string `json:"newPath"`
	BytesMoved  int64  `json:"bytesMoved"`
	FilesMoved  int    `json:"filesMoved"`
	Error       string `json:"error,omitempty"`
}

// ProgressCallback is a function type for reporting move progress
type ProgressCallback func(progress MoveProgress)

// MoveServerData moves server data from one path to another
// It copies files first (for safety), then deletes the source after successful copy
// If progressFn is provided, it will be called with progress updates
func (dc *DockerClient) MoveServerData(serverName, oldBasePath, newBasePath string, progressFn ProgressCallback) (*ServerMoveDataResponse, error) {
	srcDir := filepath.Join(oldBasePath, serverName)
	dstDir := filepath.Join(newBasePath, serverName)

	log.Printf("Moving server data: %s -> %s", srcDir, dstDir)

	// Validate source exists
	if !dirExists(srcDir) {
		return nil, fmt.Errorf("source directory does not exist: %s", srcDir)
	}

	// Check if destination already exists
	if dirExists(dstDir) {
		return nil, fmt.Errorf("destination directory already exists: %s", dstDir)
	}

	// Create destination parent directory
	if err := os.MkdirAll(newBasePath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create destination parent directory: %w", err)
	}

	// Calculate total size for progress (walk source directory)
	var totalBytes int64
	var totalFiles int
	err := filepath.Walk(srcDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			totalBytes += info.Size()
			totalFiles++
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("failed to calculate source size: %w", err)
	}

	log.Printf("Source size: %d bytes, %d files", totalBytes, totalFiles)

	// Send initial progress (calculating complete, starting copy)
	if progressFn != nil {
		progressFn(MoveProgress{
			Phase:       "copying",
			Percent:     0,
			TotalBytes:  totalBytes,
			BytesCopied: 0,
			TotalFiles:  totalFiles,
			FilesCopied: 0,
		})
	}

	// Copy directory recursively
	var bytesCopied int64
	var filesCopied int

	err = filepath.Walk(srcDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Calculate relative path
		relPath, err := filepath.Rel(srcDir, path)
		if err != nil {
			return err
		}

		targetPath := filepath.Join(dstDir, relPath)

		if info.IsDir() {
			// Create directory
			return os.MkdirAll(targetPath, info.Mode())
		}

		// Copy file
		if err := copyFile(path, targetPath, info.Mode()); err != nil {
			return fmt.Errorf("failed to copy %s: %w", relPath, err)
		}

		bytesCopied += info.Size()
		filesCopied++

		// Log and report progress every 100 files or every 100MB
		if filesCopied%100 == 0 || bytesCopied%(100*1024*1024) < info.Size() {
			percent := 0
			if totalBytes > 0 {
				percent = int((bytesCopied * 100) / totalBytes)
			}
			log.Printf("Copy progress: %d%% (%d/%d files, %d/%d bytes)", percent, filesCopied, totalFiles, bytesCopied, totalBytes)

			// Send progress update
			if progressFn != nil {
				progressFn(MoveProgress{
					Phase:       "copying",
					Percent:     percent,
					TotalBytes:  totalBytes,
					BytesCopied: bytesCopied,
					TotalFiles:  totalFiles,
					FilesCopied: filesCopied,
					CurrentFile: relPath,
				})
			}
		}

		return nil
	})

	if err != nil {
		// Clean up partial copy on failure
		log.Printf("Copy failed, cleaning up partial destination: %s", dstDir)
		os.RemoveAll(dstDir)
		return nil, fmt.Errorf("failed to copy data: %w", err)
	}

	log.Printf("Copy complete: %d files, %d bytes", filesCopied, bytesCopied)

	// Send verifying progress
	if progressFn != nil {
		progressFn(MoveProgress{
			Phase:       "verifying",
			Percent:     95,
			TotalBytes:  totalBytes,
			BytesCopied: bytesCopied,
			TotalFiles:  totalFiles,
			FilesCopied: filesCopied,
		})
	}

	// Verify copy by checking file count
	var dstFileCount int
	filepath.Walk(dstDir, func(path string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			dstFileCount++
		}
		return nil
	})

	if dstFileCount != totalFiles {
		// Clean up and fail
		log.Printf("File count mismatch after copy: expected %d, got %d", totalFiles, dstFileCount)
		os.RemoveAll(dstDir)
		return nil, fmt.Errorf("copy verification failed: file count mismatch (expected %d, got %d)", totalFiles, dstFileCount)
	}

	// Send cleaning progress
	if progressFn != nil {
		progressFn(MoveProgress{
			Phase:       "cleaning",
			Percent:     98,
			TotalBytes:  totalBytes,
			BytesCopied: bytesCopied,
			TotalFiles:  totalFiles,
			FilesCopied: filesCopied,
		})
	}

	// Delete source directory (only after successful copy)
	log.Printf("Removing source directory: %s", srcDir)
	if err := os.RemoveAll(srcDir); err != nil {
		// Log but don't fail - data is already copied
		log.Printf("Warning: failed to remove source directory (data already copied): %v", err)
	}

	log.Printf("Server data move complete: %s", serverName)

	// Send complete progress
	if progressFn != nil {
		progressFn(MoveProgress{
			Phase:       "complete",
			Percent:     100,
			TotalBytes:  totalBytes,
			BytesCopied: bytesCopied,
			TotalFiles:  totalFiles,
			FilesCopied: filesCopied,
		})
	}

	return &ServerMoveDataResponse{
		Success:    true,
		ServerName: serverName,
		OldPath:    srcDir,
		NewPath:    dstDir,
		BytesMoved: bytesCopied,
		FilesMoved: filesCopied,
	}, nil
}

// copyFile copies a single file preserving permissions
func copyFile(src, dst string, mode os.FileMode) error {
	srcFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	// Create destination directory if needed
	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return err
	}

	dstFile, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, mode)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	_, err = io.Copy(dstFile, srcFile)
	return err
}
