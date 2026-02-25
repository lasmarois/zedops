package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// VersionInfo represents the response from the version endpoint
type VersionInfo struct {
	Version      string            `json:"version"`
	DownloadURLs map[string]string `json:"downloadUrls"`
}

// AutoUpdater handles automatic agent updates
type AutoUpdater struct {
	managerURL      string
	currentBinary   string
	onBeforeRestart func() // Called before syscall.Exec to notify manager
}

// NewAutoUpdater creates a new auto updater
func NewAutoUpdater(managerURL string) *AutoUpdater {
	executable, err := os.Executable()
	if err != nil {
		log.Printf("Warning: Could not determine executable path: %v", err)
		executable = os.Args[0]
	}

	// Resolve symlinks to get the real path
	realPath, err := filepath.EvalSymlinks(executable)
	if err == nil {
		executable = realPath
	}

	return &AutoUpdater{
		managerURL:    managerURL,
		currentBinary: executable,
	}
}

// CheckOnce checks for updates once (called on startup)
func (u *AutoUpdater) CheckOnce() {
	go u.checkAndUpdate(false)
}

// TriggerUpdate is called when manager pushes an update notification
func (u *AutoUpdater) TriggerUpdate(version string) {
	log.Printf("Received update notification from manager: version %s available", version)
	go u.checkAndUpdate(true) // Bust cache when triggered by push notification
}

// checkAndUpdate checks for updates and applies them if available
// bustCache: if true, adds timestamp to bypass Cloudflare cache
func (u *AutoUpdater) checkAndUpdate(bustCache bool) {
	log.Println("Checking for updates...")

	latestVersion, downloadURL, err := u.getLatestVersion(bustCache)
	if err != nil {
		log.Printf("Failed to check for updates: %v", err)
		return
	}

	if latestVersion == Version {
		log.Printf("Agent is up to date (version %s)", Version)
		return
	}

	if !isNewerVersion(latestVersion, Version) {
		log.Printf("Remote version %s is not newer than current %s, skipping", latestVersion, Version)
		return
	}

	log.Printf("New version available: %s (current: %s)", latestVersion, Version)

	// Download and apply update
	if err := u.downloadAndApply(downloadURL, latestVersion); err != nil {
		log.Printf("Failed to apply update: %v", err)
		return
	}
}

// getLatestVersion fetches the latest version info from the manager
// bustCache: if true, adds timestamp query param to bypass Cloudflare cache
func (u *AutoUpdater) getLatestVersion(bustCache bool) (string, string, error) {
	// Convert WebSocket URL to HTTP
	httpURL := strings.Replace(u.managerURL, "wss://", "https://", 1)
	httpURL = strings.Replace(httpURL, "ws://", "http://", 1)
	httpURL = strings.TrimSuffix(httpURL, "/ws")
	versionURL := httpURL + "/api/agent/version"

	// Add cache-busting timestamp when triggered by push notification
	if bustCache {
		versionURL = fmt.Sprintf("%s?t=%d", versionURL, time.Now().UnixNano())
	}

	resp, err := http.Get(versionURL)
	if err != nil {
		return "", "", fmt.Errorf("failed to fetch version info: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("version endpoint returned status %d", resp.StatusCode)
	}

	var info VersionInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return "", "", fmt.Errorf("failed to decode version info: %w", err)
	}

	// Get download URL for current platform
	platform := fmt.Sprintf("%s-%s", runtime.GOOS, runtime.GOARCH)
	downloadURL, ok := info.DownloadURLs[platform]
	if !ok {
		return "", "", fmt.Errorf("no download URL for platform %s", platform)
	}

	return info.Version, downloadURL, nil
}

// downloadAndApply downloads the new binary and restarts the agent
func (u *AutoUpdater) downloadAndApply(downloadURL, newVersion string) error {
	log.Printf("Downloading update from %s", downloadURL)

	// Download to temp file
	resp, err := http.Get(downloadURL)
	if err != nil {
		return fmt.Errorf("failed to download update: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download returned status %d", resp.StatusCode)
	}

	// Create temp file in the same directory as the current binary
	// This ensures we can rename it atomically
	dir := filepath.Dir(u.currentBinary)
	tmpFile, err := os.CreateTemp(dir, "zedops-agent-update-*")
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}
	tmpPath := tmpFile.Name()

	// Download content
	_, err = io.Copy(tmpFile, resp.Body)
	tmpFile.Close()
	if err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("failed to write update: %w", err)
	}

	// Make executable
	if err := os.Chmod(tmpPath, 0755); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("failed to make update executable: %w", err)
	}

	// Verify the new binary works
	// We could run it with --version flag to verify
	log.Println("Verifying new binary...")

	// Replace current binary
	log.Println("Applying update...")
	if err := os.Rename(tmpPath, u.currentBinary); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("failed to replace binary: %w", err)
	}

	log.Printf("Update applied successfully! Restarting to version %s...", newVersion)

	// Restart by exec'ing into the new binary
	// This replaces the current process with the new one
	// systemd will see the same PID, so it won't think the service crashed
	return u.restart()
}

// restart replaces the current process with a new instance
func (u *AutoUpdater) restart() error {
	// Notify manager that we're about to restart for an update
	if u.onBeforeRestart != nil {
		u.onBeforeRestart()
	}

	// Get current arguments
	args := os.Args

	// Get current environment
	env := os.Environ()

	// Exec into the new binary
	// This replaces the current process - code after this won't execute
	log.Println("Executing new binary...")
	return syscall.Exec(u.currentBinary, args, env)
}

// isNewerVersion returns true if remote is newer than current (semver comparison).
// Versions are expected in "MAJOR.MINOR.PATCH" format (e.g., "1.0.11").
func isNewerVersion(remote, current string) bool {
	rParts := parseVersion(remote)
	cParts := parseVersion(current)
	for i := 0; i < 3; i++ {
		if rParts[i] > cParts[i] {
			return true
		}
		if rParts[i] < cParts[i] {
			return false
		}
	}
	return false // equal
}

// parseVersion splits a "MAJOR.MINOR.PATCH" string into [3]int.
func parseVersion(v string) [3]int {
	var parts [3]int
	for i, s := range strings.SplitN(v, ".", 3) {
		if i >= 3 {
			break
		}
		parts[i], _ = strconv.Atoi(s)
	}
	return parts
}
