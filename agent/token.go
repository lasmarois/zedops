package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
)

// stateDir is the FHS-compliant location for agent state files.
const stateDir = "/var/lib/zedops-agent"

// legacyTokenDir is the old location (~/.zedops-agent/) for migration.
const legacyTokenDir = ".zedops-agent"

const tokenFile = "token"
const ephemeralTokenFile = "ephemeral-token"

// StateDir returns the state directory path, creating it if needed.
func StateDir() string {
	return stateDir
}

// ensureStateDir creates the state directory with restricted permissions.
func ensureStateDir() error {
	if err := os.MkdirAll(stateDir, 0700); err != nil {
		return fmt.Errorf("failed to create state directory %s: %w", stateDir, err)
	}
	return nil
}

// MigrateFromLegacyDir moves token and alert config from ~/.zedops-agent/ to /var/lib/zedops-agent/.
// Called once on startup. No-op if legacy dir doesn't exist or new files already exist.
func MigrateFromLegacyDir() {
	home, err := os.UserHomeDir()
	if err != nil {
		return
	}
	legacyDir := filepath.Join(home, legacyTokenDir)

	// Skip if legacy dir doesn't exist
	if _, err := os.Stat(legacyDir); os.IsNotExist(err) {
		return
	}

	if err := ensureStateDir(); err != nil {
		log.Printf("Migration: failed to create state dir: %v", err)
		return
	}

	// Migrate each file (only if destination doesn't already exist)
	files := []string{tokenFile, "alert-config.json"}
	migrated := 0
	for _, f := range files {
		src := filepath.Join(legacyDir, f)
		dst := filepath.Join(stateDir, f)

		if _, err := os.Stat(src); os.IsNotExist(err) {
			continue
		}
		if _, err := os.Stat(dst); err == nil {
			continue // destination already exists, don't overwrite
		}

		data, err := os.ReadFile(src)
		if err != nil {
			log.Printf("Migration: failed to read %s: %v", src, err)
			continue
		}

		// Skip migrating stale ephemeral JWTs from the token file
		// (old install script saved ephemeral tokens to the permanent path)
		if f == tokenFile && isEphemeralJWT(string(data)) {
			log.Printf("Migration: skipping stale ephemeral JWT at %s (deleting)", src)
			os.Remove(src)
			continue
		}

		if err := os.WriteFile(dst, data, 0600); err != nil {
			log.Printf("Migration: failed to write %s: %v", dst, err)
			continue
		}
		os.Remove(src)
		migrated++
		log.Printf("Migration: moved %s -> %s", src, dst)
	}

	if migrated > 0 {
		// Try to remove legacy dir (only succeeds if empty)
		os.Remove(legacyDir)
	}
}

// GetTokenPath returns the path to the permanent token file.
func GetTokenPath() string {
	return filepath.Join(stateDir, tokenFile)
}

// GetEphemeralTokenPath returns the path to the ephemeral token file.
func GetEphemeralTokenPath() string {
	return filepath.Join(stateDir, ephemeralTokenFile)
}

// isEphemeralJWT checks if a token string is an ephemeral JWT by decoding
// the payload (middle segment) and checking the "type" field.
// This is a lightweight check — no signature verification needed here.
func isEphemeralJWT(token string) bool {
	parts := strings.Split(strings.TrimSpace(token), ".")
	if len(parts) != 3 {
		return false
	}

	// Decode the payload (middle segment) — base64url without padding
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return false
	}

	var claims struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return false
	}

	return claims.Type == "ephemeral"
}

// LoadToken loads the permanent token from disk.
// If the stored token is actually an ephemeral JWT (from a stale install),
// it is deleted and an empty string is returned.
func LoadToken() (string, error) {
	token, err := loadFile(GetTokenPath())
	if err != nil || token == "" {
		return token, err
	}

	if isEphemeralJWT(token) {
		log.Printf("WARNING: Permanent token file contains a stale ephemeral JWT — deleting %s", GetTokenPath())
		os.Remove(GetTokenPath())
		return "", nil
	}

	return token, nil
}

// LoadEphemeralToken loads the ephemeral token from disk.
func LoadEphemeralToken() (string, error) {
	return loadFile(GetEphemeralTokenPath())
}

// loadFile reads a token file, returning "" if it doesn't exist.
func loadFile(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", fmt.Errorf("failed to read %s: %w", path, err)
	}
	return string(data), nil
}

// SaveToken saves the permanent token to disk.
func SaveToken(token string) error {
	if err := ensureStateDir(); err != nil {
		return err
	}
	if err := os.WriteFile(GetTokenPath(), []byte(token), 0600); err != nil {
		return fmt.Errorf("failed to write token: %w", err)
	}
	return nil
}

// DeleteToken removes the permanent token from disk.
func DeleteToken() error {
	if err := os.Remove(GetTokenPath()); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete token: %w", err)
	}
	return nil
}

// DeleteEphemeralToken removes the ephemeral token from disk.
func DeleteEphemeralToken() error {
	if err := os.Remove(GetEphemeralTokenPath()); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete ephemeral token: %w", err)
	}
	return nil
}
