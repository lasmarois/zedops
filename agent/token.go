package main

import (
	"fmt"
	"os"
	"path/filepath"
)

const tokenDir = ".zedops-agent"
const tokenFile = "token"

// GetTokenPath returns the path to the token file
func GetTokenPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("failed to get home directory: %w", err)
	}

	dir := filepath.Join(home, tokenDir)
	return filepath.Join(dir, tokenFile), nil
}

// LoadToken loads the permanent token from disk
func LoadToken() (string, error) {
	path, err := GetTokenPath()
	if err != nil {
		return "", err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil // Token doesn't exist yet
		}
		return "", fmt.Errorf("failed to read token: %w", err)
	}

	return string(data), nil
}

// SaveToken saves the permanent token to disk
func SaveToken(token string) error {
	path, err := GetTokenPath()
	if err != nil {
		return err
	}

	// Create directory if it doesn't exist
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return fmt.Errorf("failed to create token directory: %w", err)
	}

	// Write token to file with restricted permissions
	if err := os.WriteFile(path, []byte(token), 0600); err != nil {
		return fmt.Errorf("failed to write token: %w", err)
	}

	return nil
}

// DeleteToken removes the permanent token from disk
func DeleteToken() error {
	path, err := GetTokenPath()
	if err != nil {
		return err
	}

	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete token: %w", err)
	}

	return nil
}
