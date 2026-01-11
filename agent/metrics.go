package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// HostMetrics represents collected host system metrics
type HostMetrics struct {
	CPUPercent     float64 `json:"cpuPercent"`
	MemoryUsedMB   int64   `json:"memoryUsedMB"`
	MemoryTotalMB  int64   `json:"memoryTotalMB"`
	DiskUsedGB     int64   `json:"diskUsedGB"`
	DiskTotalGB    int64   `json:"diskTotalGB"`
	DiskPercent    float64 `json:"diskPercent"`
	Timestamp      int64   `json:"timestamp"`
}

// cpuStats stores CPU stats for delta calculation
type cpuStats struct {
	total uint64
	idle  uint64
}

var lastCPUStats *cpuStats

// CollectHostMetrics collects CPU, memory, and disk metrics from the host
func CollectHostMetrics() (*HostMetrics, error) {
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

	// Collect disk usage (try /var/lib/zedops first, fallback to /)
	diskUsed, diskTotal, diskPercent, err := getDiskUsage("/var/lib/zedops")
	if err != nil {
		// Fallback to root filesystem if /var/lib/zedops doesn't exist
		diskUsed, diskTotal, diskPercent, err = getDiskUsage("/")
		if err != nil {
			return nil, fmt.Errorf("disk collection failed: %w", err)
		}
	}
	metrics.DiskUsedGB = diskUsed
	metrics.DiskTotalGB = diskTotal
	metrics.DiskPercent = diskPercent

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
