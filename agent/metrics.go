package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
)

// DiskMetric represents disk usage for a single volume/filesystem
type DiskMetric struct {
	Path       string  `json:"path"`       // Original path checked (e.g., "/data/servers")
	MountPoint string  `json:"mountPoint"` // Resolved mount point (e.g., "/data")
	Label      string  `json:"label"`      // Human-readable label
	UsedGB     int64   `json:"usedGB"`
	TotalGB    int64   `json:"totalGB"`
	Percent    float64 `json:"percent"`
}

// HostMetrics represents collected host system metrics
type HostMetrics struct {
	CPUPercent    float64      `json:"cpuPercent"`
	MemoryUsedMB  int64        `json:"memoryUsedMB"`
	MemoryTotalMB int64        `json:"memoryTotalMB"`
	Disks         []DiskMetric `json:"disks"`
	Timestamp     int64        `json:"timestamp"`
}

// cpuStats stores CPU stats for delta calculation
type cpuStats struct {
	total uint64
	idle  uint64
}

var lastCPUStats *cpuStats

// CollectHostMetrics collects CPU, memory, and disk metrics from the host
// dc is optional - if nil, only root filesystem is checked for disk metrics
func CollectHostMetrics(dc *DockerClient) (*HostMetrics, error) {
	metrics := &HostMetrics{
		Timestamp: time.Now().Unix(),
	}

	// Collect CPU usage
	cpu, err := getCPUUsage()
	if err != nil {
		return nil, fmt.Errorf("CPU collection failed: %w", err)
	}
	metrics.CPUPercent = cpu

	// Collect memory usage
	memUsed, memTotal, err := getMemoryUsage()
	if err != nil {
		return nil, fmt.Errorf("memory collection failed: %w", err)
	}
	metrics.MemoryUsedMB = memUsed
	metrics.MemoryTotalMB = memTotal

	// Collect disk usage for all server data volumes
	disks, err := collectDiskMetrics(dc)
	if err != nil {
		return nil, fmt.Errorf("disk collection failed: %w", err)
	}
	metrics.Disks = disks

	return metrics, nil
}

// getCPUUsage parses /proc/stat to calculate CPU usage percentage
func getCPUUsage() (float64, error) {
	file, err := os.Open("/proc/stat")
	if err != nil {
		return 0, fmt.Errorf("failed to open /proc/stat: %w", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	if !scanner.Scan() {
		return 0, fmt.Errorf("failed to read /proc/stat")
	}

	line := scanner.Text()
	if !strings.HasPrefix(line, "cpu ") {
		return 0, fmt.Errorf("invalid /proc/stat format")
	}

	// Parse CPU line: cpu  user nice system idle iowait irq softirq steal guest guest_nice
	fields := strings.Fields(line)
	if len(fields) < 5 {
		return 0, fmt.Errorf("invalid /proc/stat CPU line")
	}

	// Calculate total and idle time
	var total, idle uint64
	for i := 1; i < len(fields); i++ {
		val, err := strconv.ParseUint(fields[i], 10, 64)
		if err != nil {
			return 0, fmt.Errorf("failed to parse CPU field: %w", err)
		}
		total += val
		if i == 4 { // idle is the 4th field (index 4)
			idle = val
		}
	}

	// Calculate percentage from delta if we have previous stats
	var cpuPercent float64
	if lastCPUStats != nil {
		totalDelta := total - lastCPUStats.total
		idleDelta := idle - lastCPUStats.idle

		if totalDelta > 0 {
			cpuPercent = float64(totalDelta-idleDelta) / float64(totalDelta) * 100.0
		}
	} else {
		// First run, return 0% (need two samples for accurate percentage)
		cpuPercent = 0.0
	}

	// Store current stats for next calculation
	lastCPUStats = &cpuStats{
		total: total,
		idle:  idle,
	}

	return cpuPercent, nil
}

// getMemoryUsage parses /proc/meminfo to calculate memory usage
func getMemoryUsage() (usedMB, totalMB int64, err error) {
	file, err := os.Open("/proc/meminfo")
	if err != nil {
		return 0, 0, fmt.Errorf("failed to open /proc/meminfo: %w", err)
	}
	defer file.Close()

	var memTotal, memAvailable uint64
	foundTotal, foundAvailable := false, false

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}

		switch fields[0] {
		case "MemTotal:":
			memTotal, err = strconv.ParseUint(fields[1], 10, 64)
			if err != nil {
				return 0, 0, fmt.Errorf("failed to parse MemTotal: %w", err)
			}
			foundTotal = true
		case "MemAvailable:":
			memAvailable, err = strconv.ParseUint(fields[1], 10, 64)
			if err != nil {
				return 0, 0, fmt.Errorf("failed to parse MemAvailable: %w", err)
			}
			foundAvailable = true
		}

		if foundTotal && foundAvailable {
			break
		}
	}

	if err := scanner.Err(); err != nil {
		return 0, 0, fmt.Errorf("error reading /proc/meminfo: %w", err)
	}

	if !foundTotal || !foundAvailable {
		return 0, 0, fmt.Errorf("missing required memory fields in /proc/meminfo")
	}

	// Convert from KB to MB
	totalMB = int64(memTotal / 1024)
	usedMB = int64((memTotal - memAvailable) / 1024)

	return usedMB, totalMB, nil
}

// getDiskUsage uses syscall.Statfs to get disk usage for a given path
func getDiskUsage(path string) (usedGB, totalGB int64, percent float64, err error) {
	var stat syscall.Statfs_t
	err = syscall.Statfs(path, &stat)
	if err != nil {
		return 0, 0, 0, fmt.Errorf("failed to statfs %s: %w", path, err)
	}

	// Calculate total and available space in GB
	// stat.Blocks = total blocks
	// stat.Bfree = free blocks (for root)
	// stat.Bavail = free blocks (for non-root users)
	// stat.Bsize = block size in bytes
	totalBytes := stat.Blocks * uint64(stat.Bsize)
	availableBytes := stat.Bavail * uint64(stat.Bsize)
	usedBytes := totalBytes - availableBytes

	// Convert to GB (1 GB = 1024^3 bytes)
	totalGB = int64(totalBytes / (1024 * 1024 * 1024))
	usedGB = int64(usedBytes / (1024 * 1024 * 1024))

	// Calculate percentage
	if totalGB > 0 {
		percent = float64(usedGB) / float64(totalGB) * 100.0
	}

	return usedGB, totalGB, percent, nil
}

// getDiskMetricWithDeviceID gets disk usage and returns device ID string for deduplication
func getDiskMetricWithDeviceID(path, label string) (*DiskMetric, string, error) {
	var stat syscall.Statfs_t
	err := syscall.Statfs(path, &stat)
	if err != nil {
		return nil, "", fmt.Errorf("failed to statfs %s: %w", path, err)
	}

	// Calculate disk usage
	totalBytes := stat.Blocks * uint64(stat.Bsize)
	availableBytes := stat.Bavail * uint64(stat.Bsize)
	usedBytes := totalBytes - availableBytes

	totalGB := int64(totalBytes / (1024 * 1024 * 1024))
	usedGB := int64(usedBytes / (1024 * 1024 * 1024))

	var percent float64
	if totalGB > 0 {
		percent = float64(usedGB) / float64(totalGB) * 100.0
	}

	// Use Fsid as device identifier for deduplication
	// Use string representation for cross-platform compatibility
	deviceID := fmt.Sprintf("%v", stat.Fsid)

	metric := &DiskMetric{
		Path:       path,
		MountPoint: path, // We'll use the path as mount point for now
		Label:      label,
		UsedGB:     usedGB,
		TotalGB:    totalGB,
		Percent:    percent,
	}

	return metric, deviceID, nil
}

// mountInfo represents a mounted filesystem
type mountInfo struct {
	Device     string // e.g., "/dev/mapper/main--array-petty"
	MountPoint string // e.g., "/Volumes/Petty"
}

// parseMounts reads /proc/mounts and returns a list of mount points
func parseMounts() ([]mountInfo, error) {
	file, err := os.Open("/proc/mounts")
	if err != nil {
		return nil, fmt.Errorf("failed to open /proc/mounts: %w", err)
	}
	defer file.Close()

	var mounts []mountInfo
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 2 {
			continue
		}
		device := fields[0]
		mountPoint := fields[1]

		// Skip virtual filesystems
		if strings.HasPrefix(device, "/dev/") {
			mounts = append(mounts, mountInfo{
				Device:     device,
				MountPoint: mountPoint,
			})
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading /proc/mounts: %w", err)
	}

	return mounts, nil
}

// findMountForPath finds the mount point that contains the given path (longest prefix match)
func findMountForPath(path string, mounts []mountInfo) *mountInfo {
	var bestMatch *mountInfo
	bestLen := 0

	for i := range mounts {
		mp := mounts[i].MountPoint
		// Check if path starts with this mount point
		if strings.HasPrefix(path, mp) {
			// Ensure it's a proper prefix:
			// - exact match (path == mount point)
			// - root mount point "/" matches everything
			// - mount point followed by "/" in path
			if len(mp) > bestLen && (len(path) == len(mp) || mp == "/" || path[len(mp)] == '/') {
				bestMatch = &mounts[i]
				bestLen = len(mp)
			}
		}
	}

	return bestMatch
}

// collectDiskMetrics discovers unique filesystems used by container bind mounts
func collectDiskMetrics(dc *DockerClient) ([]DiskMetric, error) {
	// Parse system mounts
	mounts, err := parseMounts()
	if err != nil {
		// Fallback to root if we can't parse mounts
		metric, _, err := getDiskMetricWithDeviceID("/", "Root")
		if err != nil {
			return nil, err
		}
		return []DiskMetric{*metric}, nil
	}

	// Track unique devices
	seenDevices := make(map[string]bool)
	var metrics []DiskMetric

	// If no DockerClient, fallback to root filesystem only
	if dc == nil {
		metric, _, err := getDiskMetricWithDeviceID("/", "Root")
		if err != nil {
			return nil, err
		}
		return []DiskMetric{*metric}, nil
	}

	// List all ZedOps-managed containers
	ctx := context.Background()
	containerFilters := filters.NewArgs()
	containerFilters.Add("label", "zedops.managed=true")

	containers, err := dc.cli.ContainerList(ctx, container.ListOptions{
		All:     true, // Include stopped containers
		Filters: containerFilters,
	})
	if err != nil {
		// Fallback to root if we can't list containers
		metric, _, err := getDiskMetricWithDeviceID("/", "Root")
		if err != nil {
			return nil, err
		}
		return []DiskMetric{*metric}, nil
	}

	// Collect ALL bind mount source paths from each container
	for _, c := range containers {
		inspect, err := dc.cli.ContainerInspect(ctx, c.ID)
		if err != nil {
			continue // Skip containers we can't inspect
		}

		for _, mount := range inspect.Mounts {
			if mount.Type != "bind" {
				continue
			}

			// Find which filesystem this path belongs to
			mountInfo := findMountForPath(mount.Source, mounts)
			if mountInfo == nil {
				continue
			}

			// Skip if we've already seen this device
			if seenDevices[mountInfo.Device] {
				continue
			}
			seenDevices[mountInfo.Device] = true

			// Get disk metrics for this mount point
			metric, _, err := getDiskMetricWithDeviceID(mountInfo.MountPoint, mountInfo.MountPoint)
			if err != nil {
				continue
			}

			// Use mount point as both path and label
			metric.Path = mountInfo.MountPoint
			metric.Label = mountInfo.MountPoint
			metrics = append(metrics, *metric)
		}
	}

	// If no volumes found from containers, fallback to root
	if len(metrics) == 0 {
		metric, _, err := getDiskMetricWithDeviceID("/", "Root")
		if err != nil {
			return nil, err
		}
		return []DiskMetric{*metric}, nil
	}

	return metrics, nil
}
