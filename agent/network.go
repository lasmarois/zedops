package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/docker/docker/api/types/container"
)

// PortConflict represents a port that is unavailable
type PortConflict struct {
	Port   int    `json:"port"`
	Reason string `json:"reason"`
	Source string `json:"source"` // "docker" or "host"
}

// PortAvailability represents the result of a port availability check
type PortAvailability struct {
	Available   []int          `json:"available"`
	Unavailable []PortConflict `json:"unavailable"`
}

// PortCheckRequest represents a port.check message payload
type PortCheckRequest struct {
	Ports []int `json:"ports"`
}

// CheckPortAvailability checks if the given ports are available
// Checks both Docker containers and host-level network bindings
func (dc *DockerClient) CheckPortAvailability(ctx context.Context, ports []int) (PortAvailability, error) {
	availability := PortAvailability{
		Available:   []int{},
		Unavailable: []PortConflict{},
	}

	// Build map of requested ports for quick lookup
	requestedPorts := make(map[int]bool)
	for _, port := range ports {
		requestedPorts[port] = true
	}

	// 1. Check Docker containers (all containers, including stopped)
	dockerPorts := make(map[int]string) // port -> container name
	containers, err := dc.cli.ContainerList(ctx, container.ListOptions{All: true})
	if err != nil {
		log.Printf("Warning: Failed to list containers for port check: %v", err)
	} else {
		for _, c := range containers {
			// Get container name
			containerName := "unknown"
			if len(c.Names) > 0 {
				containerName = strings.TrimPrefix(c.Names[0], "/")
			}

			// Check port bindings
			for _, port := range c.Ports {
				if port.PublicPort > 0 {
					dockerPorts[int(port.PublicPort)] = containerName
				}
			}
		}
	}

	// 2. Check host-level network bindings
	hostPorts, err := getHostBoundPorts()
	if err != nil {
		log.Printf("Warning: Failed to get host bound ports: %v", err)
		// Continue with Docker-only checking
		hostPorts = make(map[int]bool)
	}

	// 3. Compare requested ports against Docker and host bindings
	for _, port := range ports {
		// Check Docker containers first
		if containerName, found := dockerPorts[port]; found {
			availability.Unavailable = append(availability.Unavailable, PortConflict{
				Port:   port,
				Reason: fmt.Sprintf("Used by container '%s'", containerName),
				Source: "docker",
			})
			continue
		}

		// Check host bindings
		if hostPorts[port] {
			availability.Unavailable = append(availability.Unavailable, PortConflict{
				Port:   port,
				Reason: "Port is bound at host level",
				Source: "host",
			})
			continue
		}

		// Port is available
		availability.Available = append(availability.Available, port)
	}

	return availability, nil
}

// getHostBoundPorts returns a map of ports that are bound at the host level
// Reads /proc/net/{tcp,tcp6,udp,udp6} for actual network bindings (no external dependencies)
func getHostBoundPorts() (map[int]bool, error) {
	ports := make(map[int]bool)

	// Read all protocol files
	procFiles := []string{
		"/proc/net/tcp",
		"/proc/net/tcp6",
		"/proc/net/udp",
		"/proc/net/udp6",
	}

	for _, procFile := range procFiles {
		filePorts, err := parseProcNetFile(procFile)
		if err != nil {
			log.Printf("Warning: Failed to read %s: %v", procFile, err)
			continue
		}

		// Merge ports into main map
		for port := range filePorts {
			ports[port] = true
		}
	}

	log.Printf("Found %d bound ports at host level", len(ports))
	return ports, nil
}

// parseProcNetFile reads a /proc/net/* file and extracts bound ports
// Format: sl local_address rem_address st tx_queue rx_queue...
// Example: 0: 00000000:3F85 00000000:0000 0A ... (port 16261 = 0x3F85)
func parseProcNetFile(filename string) (map[int]bool, error) {
	ports := make(map[int]bool)

	content, err := os.ReadFile(filename)
	if err != nil {
		return ports, err
	}

	lines := strings.Split(string(content), "\n")
	for i, line := range lines {
		// Skip header line
		if i == 0 {
			continue
		}

		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}

		// Local address is field 1 (format: IIIIIIII:PPPP in hex)
		localAddr := fields[1]

		// Split by colon to get port part
		parts := strings.Split(localAddr, ":")
		if len(parts) != 2 {
			continue
		}

		// Parse hex port
		portHex := parts[1]
		port, err := strconv.ParseInt(portHex, 16, 32)
		if err != nil {
			continue
		}

		if port > 0 && port < 65536 {
			ports[int(port)] = true
		}
	}

	return ports, nil
}

// SuggestNextAvailablePorts suggests the next available port range
// Starts from basePort and increments by 2 until finding an available range
func (dc *DockerClient) SuggestNextAvailablePorts(ctx context.Context, basePort int, count int) ([]int, error) {
	maxAttempts := 100
	currentPort := basePort

	for attempt := 0; attempt < maxAttempts; attempt++ {
		// Build range to check
		portsToCheck := make([]int, count)
		for i := 0; i < count; i++ {
			portsToCheck[i] = currentPort + (i * 2) // Increment by 2 for each port
		}

		// Check availability
		availability, err := dc.CheckPortAvailability(ctx, portsToCheck)
		if err != nil {
			return nil, err
		}

		// If all ports are available, return them
		if len(availability.Unavailable) == 0 {
			return portsToCheck, nil
		}

		// Move to next range
		currentPort += 2
	}

	return nil, fmt.Errorf("no available ports found in range %d-%d", basePort, basePort+(maxAttempts*2))
}
