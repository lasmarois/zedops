package main

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/gorcon/rcon"
)

// MaxBackupsPerServer is the retention limit
const MaxBackupsPerServer = 10

// BackupProgress represents progress updates during backup/restore
type BackupProgress struct {
	BackupID   string `json:"backupId"`
	ServerName string `json:"serverName"`
	Phase      string `json:"phase"`   // calculating, saving, compressing, complete, error, stopping, extracting, starting
	Percent    int    `json:"percent"` // 0-100
	Error      string `json:"error,omitempty"`
}

// BackupMeta is the .meta.json sidecar written alongside each .tar.gz
type BackupMeta struct {
	BackupID       string `json:"backupId"`
	ServerName     string `json:"serverName"`
	Filename       string `json:"filename"`
	SizeBytes      int64  `json:"sizeBytes"`
	Notes          string `json:"notes,omitempty"`
	PreSaveSuccess bool   `json:"preSaveSuccess"`
	CreatedAt      int64  `json:"createdAt"` // Unix seconds
}

// BackupCreateRequest is the agent-side request payload
type BackupCreateRequest struct {
	ServerName  string `json:"serverName"`
	DataPath    string `json:"dataPath"`
	BackupID    string `json:"backupId"`
	Notes       string `json:"notes"`
	ContainerID string `json:"containerId"` // For RCON pre-save (empty if server stopped)
	RCONPort    int    `json:"rconPort"`
	RCONPassword string `json:"rconPassword"`
}

// BackupCreateResponse is the agent-side response
type BackupCreateResponse struct {
	Success        bool   `json:"success"`
	BackupID       string `json:"backupId"`
	Filename       string `json:"filename"`
	SizeBytes      int64  `json:"sizeBytes"`
	PreSaveSuccess bool   `json:"preSaveSuccess"`
	Error          string `json:"error,omitempty"`
}

// BackupListRequest is the agent-side list request
type BackupListRequest struct {
	ServerName string `json:"serverName"`
	DataPath   string `json:"dataPath"`
}

// BackupListResponse is the agent-side list response
type BackupListResponse struct {
	Success bool         `json:"success"`
	Backups []BackupMeta `json:"backups"`
	Error   string       `json:"error,omitempty"`
}

// BackupDeleteRequest is the agent-side delete request
type BackupDeleteRequest struct {
	ServerName string `json:"serverName"`
	DataPath   string `json:"dataPath"`
	Filename   string `json:"filename"`
}

// BackupDeleteResponse is the agent-side delete response
type BackupDeleteResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

// BackupRestoreRequest is the agent-side restore request
type BackupRestoreRequest struct {
	ServerName  string `json:"serverName"`
	DataPath    string `json:"dataPath"`
	Filename    string `json:"filename"`
	BackupID    string `json:"backupId"`
	ContainerID string `json:"containerId"`
}

// BackupRestoreResponse is the agent-side restore response
type BackupRestoreResponse struct {
	Success  bool   `json:"success"`
	BackupID string `json:"backupId"`
	Error    string `json:"error,omitempty"`
}

// ProgressCallback for backup operations
type BackupProgressCallback func(progress BackupProgress)

// CreateBackup creates a tar.gz backup of the server's data/ directory
func CreateBackup(serverName, dataPath, backupID, notes string, containerID string, rconPort int, rconPassword string, rconManager *RCONManager, progressFn BackupProgressCallback) (*BackupCreateResponse, error) {
	serverDir := filepath.Join(dataPath, serverName)
	dataDir := filepath.Join(serverDir, "data")
	backupsDir := filepath.Join(serverDir, "backups")

	// Verify data directory exists
	if !dirExists(dataDir) {
		return nil, fmt.Errorf("data directory does not exist: %s", dataDir)
	}

	// Create backups directory if needed
	if err := os.MkdirAll(backupsDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create backups directory: %w", err)
	}

	// Attempt RCON pre-save if server is running
	preSaveOK := false
	if containerID != "" && rconPort > 0 && rconPassword != "" {
		if progressFn != nil {
			progressFn(BackupProgress{BackupID: backupID, ServerName: serverName, Phase: "saving", Percent: 5})
		}
		preSaveOK = attemptRCONSave(containerID, rconPort, rconPassword, rconManager)
		if preSaveOK {
			log.Printf("[Backup] RCON pre-save succeeded for %s", serverName)
			// Wait a bit for save to flush to disk
			time.Sleep(3 * time.Second)
		} else {
			log.Printf("[Backup] RCON pre-save failed for %s (continuing anyway)", serverName)
		}
	}

	// Calculate total size
	if progressFn != nil {
		progressFn(BackupProgress{BackupID: backupID, ServerName: serverName, Phase: "calculating", Percent: 10})
	}

	var totalBytes int64
	var totalFiles int
	err := filepath.Walk(dataDir, func(path string, info os.FileInfo, err error) error {
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
		return nil, fmt.Errorf("failed to calculate data size: %w", err)
	}

	log.Printf("[Backup] Data size: %d bytes, %d files", totalBytes, totalFiles)

	// Generate filename
	timestamp := time.Now().UTC().Format("2006-01-02T15-04-05")
	label := "manual"
	if notes != "" {
		// Sanitize notes for filename (keep alphanumeric, dash, underscore)
		sanitized := sanitizeForFilename(notes)
		if sanitized != "" {
			label = sanitized
		}
	}
	filename := fmt.Sprintf("%s_%s.tar.gz", timestamp, label)
	tarPath := filepath.Join(backupsDir, filename)

	// Create tar.gz
	if progressFn != nil {
		progressFn(BackupProgress{BackupID: backupID, ServerName: serverName, Phase: "compressing", Percent: 15})
	}

	sizeBytes, err := createTarGz(tarPath, dataDir, backupID, serverName, totalBytes, totalFiles, progressFn)
	if err != nil {
		// Clean up partial file
		os.Remove(tarPath)
		return nil, fmt.Errorf("failed to create backup archive: %w", err)
	}

	log.Printf("[Backup] Archive created: %s (%d bytes)", filename, sizeBytes)

	// Write .meta.json sidecar
	meta := BackupMeta{
		BackupID:       backupID,
		ServerName:     serverName,
		Filename:       filename,
		SizeBytes:      sizeBytes,
		Notes:          notes,
		PreSaveSuccess: preSaveOK,
		CreatedAt:      time.Now().Unix(),
	}

	metaPath := filepath.Join(backupsDir, strings.TrimSuffix(filename, ".tar.gz")+".meta.json")
	metaData, _ := json.MarshalIndent(meta, "", "  ")
	if err := os.WriteFile(metaPath, metaData, 0644); err != nil {
		log.Printf("[Backup] Warning: failed to write meta file: %v", err)
	}

	// Enforce retention (delete oldest if >MaxBackupsPerServer)
	enforceRetention(backupsDir, serverName)

	// Send complete
	if progressFn != nil {
		progressFn(BackupProgress{BackupID: backupID, ServerName: serverName, Phase: "complete", Percent: 100})
	}

	return &BackupCreateResponse{
		Success:        true,
		BackupID:       backupID,
		Filename:       filename,
		SizeBytes:      sizeBytes,
		PreSaveSuccess: preSaveOK,
	}, nil
}

// ListBackups reads the backups/ directory and returns metadata for each backup
func ListBackups(serverName, dataPath string) ([]BackupMeta, error) {
	backupsDir := filepath.Join(dataPath, serverName, "backups")

	if !dirExists(backupsDir) {
		return []BackupMeta{}, nil
	}

	entries, err := os.ReadDir(backupsDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read backups directory: %w", err)
	}

	var backups []BackupMeta
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".meta.json") {
			continue
		}

		metaPath := filepath.Join(backupsDir, entry.Name())
		data, err := os.ReadFile(metaPath)
		if err != nil {
			log.Printf("[Backup] Warning: failed to read meta file %s: %v", entry.Name(), err)
			continue
		}

		var meta BackupMeta
		if err := json.Unmarshal(data, &meta); err != nil {
			log.Printf("[Backup] Warning: failed to parse meta file %s: %v", entry.Name(), err)
			continue
		}

		// Verify the tar.gz still exists
		tarPath := filepath.Join(backupsDir, meta.Filename)
		if _, err := os.Stat(tarPath); os.IsNotExist(err) {
			log.Printf("[Backup] Warning: orphaned meta file %s (tar.gz missing)", entry.Name())
			continue
		}

		backups = append(backups, meta)
	}

	// Sort by created_at descending (newest first)
	sort.Slice(backups, func(i, j int) bool {
		return backups[i].CreatedAt > backups[j].CreatedAt
	})

	return backups, nil
}

// DeleteBackup removes a backup's .tar.gz and .meta.json files
func DeleteBackup(serverName, dataPath, filename string) error {
	backupsDir := filepath.Join(dataPath, serverName, "backups")
	tarPath := filepath.Join(backupsDir, filename)

	// Validate filename to prevent path traversal
	if strings.Contains(filename, "/") || strings.Contains(filename, "..") {
		return fmt.Errorf("invalid filename")
	}

	// Remove tar.gz
	if err := os.Remove(tarPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to remove backup file: %w", err)
	}

	// Remove .meta.json
	metaPath := filepath.Join(backupsDir, strings.TrimSuffix(filename, ".tar.gz")+".meta.json")
	if err := os.Remove(metaPath); err != nil && !os.IsNotExist(err) {
		log.Printf("[Backup] Warning: failed to remove meta file: %v", err)
	}

	log.Printf("[Backup] Deleted backup: %s/%s", serverName, filename)
	return nil
}

// RestoreFromBackup restores server data from a backup archive
func RestoreFromBackup(serverName, dataPath, filename, backupID, containerID string, docker *DockerClient, progressFn BackupProgressCallback) error {
	serverDir := filepath.Join(dataPath, serverName)
	dataDir := filepath.Join(serverDir, "data")
	backupsDir := filepath.Join(serverDir, "backups")
	tarPath := filepath.Join(backupsDir, filename)

	// Validate filename
	if strings.Contains(filename, "/") || strings.Contains(filename, "..") {
		return fmt.Errorf("invalid filename")
	}

	// Verify backup exists
	if _, err := os.Stat(tarPath); os.IsNotExist(err) {
		return fmt.Errorf("backup file not found: %s", filename)
	}

	ctx := context.Background()

	// Stop container if running
	if containerID != "" {
		if progressFn != nil {
			progressFn(BackupProgress{BackupID: backupID, ServerName: serverName, Phase: "stopping", Percent: 10})
		}
		log.Printf("[Restore] Stopping container %s", containerID)
		if err := docker.StopContainer(ctx, containerID); err != nil {
			log.Printf("[Restore] Warning: failed to stop container (may already be stopped): %v", err)
		}
		// Give it a moment to fully stop
		time.Sleep(2 * time.Second)
	}

	// Rename current data/ to data.pre-restore.{timestamp}/
	preRestoreDir := ""
	if dirExists(dataDir) {
		preRestoreDir = filepath.Join(serverDir, fmt.Sprintf("data.pre-restore.%d", time.Now().Unix()))
		if progressFn != nil {
			progressFn(BackupProgress{BackupID: backupID, ServerName: serverName, Phase: "extracting", Percent: 20})
		}
		log.Printf("[Restore] Moving current data to %s", preRestoreDir)
		if err := os.Rename(dataDir, preRestoreDir); err != nil {
			// Try to restart container before returning error
			if containerID != "" {
				docker.StartContainer(ctx, containerID)
			}
			return fmt.Errorf("failed to move current data directory: %w", err)
		}
	}

	// Extract tar.gz to data/
	if progressFn != nil {
		progressFn(BackupProgress{BackupID: backupID, ServerName: serverName, Phase: "extracting", Percent: 30})
	}
	log.Printf("[Restore] Extracting %s to %s", filename, dataDir)

	if err := extractTarGz(tarPath, dataDir, backupID, serverName, progressFn); err != nil {
		log.Printf("[Restore] Extraction failed: %v", err)
		// Rollback: restore pre-restore data
		if preRestoreDir != "" {
			log.Printf("[Restore] Rolling back: restoring pre-restore data")
			os.RemoveAll(dataDir) // Remove partial extraction
			if renameErr := os.Rename(preRestoreDir, dataDir); renameErr != nil {
				log.Printf("[Restore] CRITICAL: Failed to rollback! Pre-restore at: %s, error: %v", preRestoreDir, renameErr)
			}
		}
		// Try to restart container
		if containerID != "" {
			docker.StartContainer(ctx, containerID)
		}
		return fmt.Errorf("failed to extract backup: %w", err)
	}

	// Start container
	if containerID != "" {
		if progressFn != nil {
			progressFn(BackupProgress{BackupID: backupID, ServerName: serverName, Phase: "starting", Percent: 90})
		}
		log.Printf("[Restore] Starting container %s", containerID)
		if err := docker.StartContainer(ctx, containerID); err != nil {
			log.Printf("[Restore] Warning: failed to start container: %v", err)
			// Don't fail the restore — data is restored, container can be started manually
		}
	}

	// Clean up pre-restore directory (keep it for safety — user can delete manually)
	// We don't auto-delete it because it's a safety net
	if preRestoreDir != "" {
		log.Printf("[Restore] Pre-restore data kept at: %s (can be deleted manually)", preRestoreDir)
	}

	// Send complete
	if progressFn != nil {
		progressFn(BackupProgress{BackupID: backupID, ServerName: serverName, Phase: "complete", Percent: 100})
	}

	log.Printf("[Restore] Restore complete for %s from %s", serverName, filename)
	return nil
}

// attemptRCONSave tries to connect to RCON, send a save command, and disconnect
func attemptRCONSave(containerID string, port int, password string, rconManager *RCONManager) bool {
	// Use RCONManager's docker client to get container IP
	ctx := context.Background()
	inspect, err := rconManager.dockerClient.ContainerInspect(ctx, containerID)
	if err != nil {
		log.Printf("[Backup] RCON: failed to inspect container: %v", err)
		return false
	}

	network := inspect.NetworkSettings.Networks["zomboid-backend"]
	if network == nil {
		log.Printf("[Backup] RCON: container not on zomboid-backend network")
		return false
	}

	containerIP := network.IPAddress
	if containerIP == "" {
		log.Printf("[Backup] RCON: no IP address")
		return false
	}

	addr := fmt.Sprintf("%s:%d", containerIP, port)
	log.Printf("[Backup] RCON: connecting to %s for pre-save", addr)

	conn, err := rcon.Dial(addr, password, rcon.SetDialTimeout(5*time.Second))
	if err != nil {
		log.Printf("[Backup] RCON: connection failed: %v", err)
		return false
	}
	defer conn.Close()

	_, err = conn.Execute("save")
	if err != nil {
		log.Printf("[Backup] RCON: save command failed: %v", err)
		return false
	}

	return true
}

// createTarGz creates a gzip-compressed tar archive of srcDir
func createTarGz(tarPath, srcDir, backupID, serverName string, totalBytes int64, totalFiles int, progressFn BackupProgressCallback) (int64, error) {
	outFile, err := os.Create(tarPath)
	if err != nil {
		return 0, err
	}
	defer outFile.Close()

	gzWriter := gzip.NewWriter(outFile)
	defer gzWriter.Close()

	tarWriter := tar.NewWriter(gzWriter)
	defer tarWriter.Close()

	var bytesProcessed int64
	var filesProcessed int
	lastPercent := 0

	err = filepath.Walk(srcDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Create tar header
		header, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}

		// Use relative path
		relPath, err := filepath.Rel(srcDir, path)
		if err != nil {
			return err
		}
		header.Name = relPath

		if err := tarWriter.WriteHeader(header); err != nil {
			return err
		}

		// Write file content
		if !info.IsDir() {
			file, err := os.Open(path)
			if err != nil {
				return err
			}
			defer file.Close()

			if _, err := io.Copy(tarWriter, file); err != nil {
				return err
			}

			bytesProcessed += info.Size()
			filesProcessed++

			// Send progress every 5%
			if totalBytes > 0 && progressFn != nil {
				percent := int((bytesProcessed * 80) / totalBytes) + 15 // 15-95 range
				if percent > 95 {
					percent = 95
				}
				if percent-lastPercent >= 5 {
					lastPercent = percent
					progressFn(BackupProgress{
						BackupID:   backupID,
						ServerName: serverName,
						Phase:      "compressing",
						Percent:    percent,
					})
				}
			}
		}

		return nil
	})

	if err != nil {
		return 0, err
	}

	// Flush writers
	tarWriter.Close()
	gzWriter.Close()
	outFile.Close()

	// Get actual file size
	stat, err := os.Stat(tarPath)
	if err != nil {
		return 0, err
	}

	return stat.Size(), nil
}

// extractTarGz extracts a gzip-compressed tar archive to dstDir
func extractTarGz(tarPath, dstDir, backupID, serverName string, progressFn BackupProgressCallback) error {
	inFile, err := os.Open(tarPath)
	if err != nil {
		return err
	}
	defer inFile.Close()

	// Get file size for progress
	stat, err := inFile.Stat()
	if err != nil {
		return err
	}
	totalSize := stat.Size()

	gzReader, err := gzip.NewReader(inFile)
	if err != nil {
		return err
	}
	defer gzReader.Close()

	tarReader := tar.NewReader(gzReader)
	var filesExtracted int

	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		// Prevent path traversal
		targetPath := filepath.Join(dstDir, header.Name)
		if !strings.HasPrefix(filepath.Clean(targetPath), filepath.Clean(dstDir)) {
			return fmt.Errorf("tar entry attempts path traversal: %s", header.Name)
		}

		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(targetPath, os.FileMode(header.Mode)); err != nil {
				return err
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
				return err
			}

			outFile, err := os.OpenFile(targetPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, os.FileMode(header.Mode))
			if err != nil {
				return err
			}

			if _, err := io.Copy(outFile, tarReader); err != nil {
				outFile.Close()
				return err
			}
			outFile.Close()

			filesExtracted++

			// Progress update every 50 files
			if filesExtracted%50 == 0 && progressFn != nil {
				// Estimate progress from file position
				pos, _ := inFile.Seek(0, io.SeekCurrent)
				percent := 30
				if totalSize > 0 {
					percent = 30 + int((int64(pos)*55)/totalSize) // 30-85 range
				}
				if percent > 85 {
					percent = 85
				}
				progressFn(BackupProgress{
					BackupID:   backupID,
					ServerName: serverName,
					Phase:      "extracting",
					Percent:    percent,
				})
			}
		}
	}

	return nil
}

// enforceRetention deletes the oldest backups if there are more than MaxBackupsPerServer
func enforceRetention(backupsDir, serverName string) {
	backups, err := ListBackups(serverName, filepath.Dir(filepath.Dir(backupsDir)))
	if err != nil {
		log.Printf("[Backup] Warning: failed to list backups for retention check: %v", err)
		return
	}

	if len(backups) <= MaxBackupsPerServer {
		return
	}

	// backups are sorted newest-first; delete from the end
	for i := MaxBackupsPerServer; i < len(backups); i++ {
		log.Printf("[Backup] Retention: deleting old backup %s", backups[i].Filename)
		tarPath := filepath.Join(backupsDir, backups[i].Filename)
		metaPath := filepath.Join(backupsDir, strings.TrimSuffix(backups[i].Filename, ".tar.gz")+".meta.json")
		os.Remove(tarPath)
		os.Remove(metaPath)
	}
}

// sanitizeForFilename returns a filename-safe version of the input
func sanitizeForFilename(s string) string {
	// Replace spaces with underscores, keep only safe chars
	var result strings.Builder
	for _, c := range s {
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_' {
			result.WriteRune(c)
		} else if c == ' ' {
			result.WriteRune('_')
		}
	}
	out := result.String()
	if len(out) > 30 {
		out = out[:30]
	}
	return out
}

// handleBackupCreate handles backup.create messages
func (a *Agent) handleBackupCreate(msg Message) {
	data, _ := json.Marshal(msg.Data)
	var req BackupCreateRequest
	if err := json.Unmarshal(data, &req); err != nil {
		if msg.Reply != "" {
			response := Message{
				Subject: msg.Reply,
				Data:    BackupCreateResponse{Success: false, Error: "Invalid request format"},
				Timestamp: time.Now().Unix(),
			}
			a.sendMessage(response)
		}
		return
	}

	log.Printf("[Backup] Creating backup for %s (ID: %s)", req.ServerName, req.BackupID)

	progressFn := func(progress BackupProgress) {
		progressMsg := Message{
			Subject:   "backup.progress",
			Data:      progress,
			Timestamp: time.Now().Unix(),
		}
		a.sendMessage(progressMsg)
	}

	result, err := CreateBackup(
		req.ServerName, req.DataPath, req.BackupID, req.Notes,
		req.ContainerID, req.RCONPort, req.RCONPassword,
		a.rconManager, progressFn,
	)

	if err != nil {
		log.Printf("[Backup] Create failed for %s: %v", req.ServerName, err)
		// Send error progress
		progressFn(BackupProgress{BackupID: req.BackupID, ServerName: req.ServerName, Phase: "error", Error: err.Error()})

		if msg.Reply != "" {
			response := Message{
				Subject:   msg.Reply,
				Data:      BackupCreateResponse{Success: false, BackupID: req.BackupID, Error: err.Error()},
				Timestamp: time.Now().Unix(),
			}
			a.sendMessage(response)
		}
		return
	}

	if msg.Reply != "" {
		response := Message{
			Subject:   msg.Reply,
			Data:      result,
			Timestamp: time.Now().Unix(),
		}
		a.sendMessage(response)
	}
}

// handleBackupList handles backup.list messages
func (a *Agent) handleBackupList(msg Message) {
	data, _ := json.Marshal(msg.Data)
	var req BackupListRequest
	if err := json.Unmarshal(data, &req); err != nil {
		if msg.Reply != "" {
			response := Message{
				Subject:   msg.Reply,
				Data:      BackupListResponse{Success: false, Error: "Invalid request format"},
				Timestamp: time.Now().Unix(),
			}
			a.sendMessage(response)
		}
		return
	}

	backups, err := ListBackups(req.ServerName, req.DataPath)
	if err != nil {
		if msg.Reply != "" {
			response := Message{
				Subject:   msg.Reply,
				Data:      BackupListResponse{Success: false, Error: err.Error()},
				Timestamp: time.Now().Unix(),
			}
			a.sendMessage(response)
		}
		return
	}

	if msg.Reply != "" {
		response := Message{
			Subject:   msg.Reply,
			Data:      BackupListResponse{Success: true, Backups: backups},
			Timestamp: time.Now().Unix(),
		}
		a.sendMessage(response)
	}
}

// handleBackupDelete handles backup.delete messages
func (a *Agent) handleBackupDelete(msg Message) {
	data, _ := json.Marshal(msg.Data)
	var req BackupDeleteRequest
	if err := json.Unmarshal(data, &req); err != nil {
		if msg.Reply != "" {
			response := Message{
				Subject:   msg.Reply,
				Data:      BackupDeleteResponse{Success: false, Error: "Invalid request format"},
				Timestamp: time.Now().Unix(),
			}
			a.sendMessage(response)
		}
		return
	}

	err := DeleteBackup(req.ServerName, req.DataPath, req.Filename)
	if err != nil {
		if msg.Reply != "" {
			response := Message{
				Subject:   msg.Reply,
				Data:      BackupDeleteResponse{Success: false, Error: err.Error()},
				Timestamp: time.Now().Unix(),
			}
			a.sendMessage(response)
		}
		return
	}

	if msg.Reply != "" {
		response := Message{
			Subject:   msg.Reply,
			Data:      BackupDeleteResponse{Success: true},
			Timestamp: time.Now().Unix(),
		}
		a.sendMessage(response)
	}
}

// handleBackupRestore handles backup.restore messages
func (a *Agent) handleBackupRestore(msg Message) {
	data, _ := json.Marshal(msg.Data)
	var req BackupRestoreRequest
	if err := json.Unmarshal(data, &req); err != nil {
		if msg.Reply != "" {
			response := Message{
				Subject:   msg.Reply,
				Data:      BackupRestoreResponse{Success: false, Error: "Invalid request format"},
				Timestamp: time.Now().Unix(),
			}
			a.sendMessage(response)
		}
		return
	}

	log.Printf("[Restore] Starting restore for %s from %s (ID: %s)", req.ServerName, req.Filename, req.BackupID)

	progressFn := func(progress BackupProgress) {
		progressMsg := Message{
			Subject:   "backup.progress",
			Data:      progress,
			Timestamp: time.Now().Unix(),
		}
		a.sendMessage(progressMsg)
	}

	err := RestoreFromBackup(req.ServerName, req.DataPath, req.Filename, req.BackupID, req.ContainerID, a.docker, progressFn)
	if err != nil {
		log.Printf("[Restore] Failed for %s: %v", req.ServerName, err)
		progressFn(BackupProgress{BackupID: req.BackupID, ServerName: req.ServerName, Phase: "error", Error: err.Error()})

		if msg.Reply != "" {
			response := Message{
				Subject:   msg.Reply,
				Data:      BackupRestoreResponse{Success: false, BackupID: req.BackupID, Error: err.Error()},
				Timestamp: time.Now().Unix(),
			}
			a.sendMessage(response)
		}
		return
	}

	if msg.Reply != "" {
		response := Message{
			Subject:   msg.Reply,
			Data:      BackupRestoreResponse{Success: true, BackupID: req.BackupID},
			Timestamp: time.Now().Unix(),
		}
		a.sendMessage(response)
	}
}
