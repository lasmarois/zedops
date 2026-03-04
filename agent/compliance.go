package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"strings"
	"time"

	"github.com/docker/docker/api/types/image"
)

// --- Types ---

// ComplianceReport is the top-level result stored in DB and sent to frontend.
type ComplianceReport struct {
	Success      bool                    `json:"success"`
	ImageRef     string                  `json:"imageRef"`
	CheckedAt    string                  `json:"checkedAt"`
	Mode         string                  `json:"mode"` // "image" or "container"
	Discovered   DiscoveredProperties    `json:"discovered"`
	Capabilities []CapabilityCheckResult `json:"capabilities"`
	Summary      ComplianceSummary       `json:"summary"`
	Error        string                  `json:"error,omitempty"`
}

// DiscoveredProperties holds what was found on the image or container.
type DiscoveredProperties struct {
	Volumes      []string          `json:"volumes,omitempty"`
	Mounts       []ComplianceMountInfo `json:"mounts,omitempty"`
	EnvVars      map[string]string `json:"envVars"`
	Networks     []string          `json:"networks,omitempty"`
	Healthcheck  bool              `json:"healthcheck"`
	ExposedPorts []string          `json:"exposedPorts,omitempty"`
	Health       string            `json:"health,omitempty"`
}

// ComplianceMountInfo describes a container mount in compliance reports.
type ComplianceMountInfo struct {
	Source      string `json:"source"`
	Destination string `json:"destination"`
	Type        string `json:"type"`
}

// CapabilityCheckResult is the evaluation of one capability.
type CapabilityCheckResult struct {
	ID       string        `json:"id"`
	Name     string        `json:"name"`
	Status   string        `json:"status"` // "pass", "warn", "fail", "unknown"
	Category string        `json:"category"`
	Checks   []CheckDetail `json:"checks"`
}

// CheckDetail is one individual requirement check within a capability.
type CheckDetail struct {
	Type   string  `json:"type"`             // "mount", "env", "network"
	Key    string  `json:"key"`
	Pass   bool    `json:"pass"`
	Found  *string `json:"found"`
	Detail *string `json:"detail,omitempty"`
}

// ComplianceSummary counts results by status.
type ComplianceSummary struct {
	Pass    int `json:"pass"`
	Warn    int `json:"warn"`
	Fail    int `json:"fail"`
	Unknown int `json:"unknown"`
}

// --- Capability Registry ---

// Capability declares what a ZedOps feature requires to function.
type Capability struct {
	ID               string   `json:"id"`
	Name             string   `json:"name"`
	RequiresMounts   []string `json:"requiresMounts,omitempty"`
	RequiresEnvVars  []string `json:"requiresEnvVars,omitempty"`
	RequiresNetworks []string `json:"requiresNetworks,omitempty"`
	Category         string   `json:"category"`
}

// CapabilityRegistry is the complete list of capabilities the agent checks.
var CapabilityRegistry = []Capability{
	// Storage
	{ID: "disk-bin", Name: "Binary Disk Usage", RequiresMounts: []string{"/home/steam/zomboid-dedicated"}, Category: "storage"},
	{ID: "disk-data", Name: "Data Disk Usage", RequiresMounts: []string{"/home/steam/Zomboid"}, Category: "storage"},
	{ID: "data-path", Name: "Data Path Detection", RequiresMounts: []string{"/home/steam/zomboid-dedicated"}, Category: "storage"},
	// Config
	{ID: "ini-reading", Name: "INI File Reading", RequiresMounts: []string{"/home/steam/Zomboid"}, RequiresEnvVars: []string{"SERVER_NAME"}, Category: "config"},
	{ID: "mod-display", Name: "Mod Display", RequiresMounts: []string{"/home/steam/Zomboid"}, RequiresEnvVars: []string{"SERVER_NAME"}, Category: "config"},
	{ID: "env-config", Name: "Environment Configuration", Category: "config"},
	// Backup
	{ID: "backup", Name: "Backup & Restore", RequiresMounts: []string{"/home/steam/zomboid-dedicated", "/home/steam/Zomboid"}, Category: "backup"},
	// RCON
	{ID: "rcon", Name: "RCON Commands", RequiresEnvVars: []string{"RCON_PASSWORD"}, RequiresNetworks: []string{"zomboid-backend"}, Category: "rcon"},
	{ID: "player-stats", Name: "Player Statistics", RequiresEnvVars: []string{"RCON_PASSWORD"}, RequiresNetworks: []string{"zomboid-backend"}, Category: "rcon"},
	{ID: "graceful-save", Name: "Graceful Save", RequiresEnvVars: []string{"RCON_PASSWORD", "RCON_PORT"}, RequiresNetworks: []string{"zomboid-backend"}, Category: "rcon"},
	// Health
	{ID: "healthcheck", Name: "Health Check", Category: "health"},
}

// envConfigVars are ENV vars checked for the env-config capability.
var envConfigVars = []string{
	"ADMIN_PASSWORD", "SERVER_PASSWORD", "RCON_PASSWORD",
	"SERVER_NAME", "SERVER_PUBLIC_NAME", "MAX_PLAYERS",
	"SERVER_MAP", "SERVER_PUBLIC", "SERVER_OPEN",
	"SERVER_PVP", "SERVER_PAUSE_EMPTY", "SERVER_GLOBAL_CHAT",
	"SERVER_WELCOME_MESSAGE", "SERVER_PUBLIC_DESCRIPTION",
	"SERVER_MODS", "SERVER_WORKSHOP_ITEMS",
	"BETABRANCH", "TZ", "PUID",
	"SERVER_DEFAULT_PORT", "SERVER_UDP_PORT",
}

// sensitiveEnvVars are masked in compliance reports.
var sensitiveEnvVars = map[string]bool{
	"ADMIN_PASSWORD":  true,
	"SERVER_PASSWORD": true,
	"RCON_PASSWORD":   true,
}

// --- Request Types ---

// ImageComplianceRequest is the request for image.compliance.
type ImageComplianceRequest struct {
	Registry string `json:"registry"`
	ImageTag string `json:"imageTag"`
}

// ContainerComplianceRequest is the request for container.compliance.
type ContainerComplianceRequest struct {
	ContainerID string `json:"containerId"`
}

// --- Evaluation Engine ---

func strPtr(s string) *string { return &s }

// evaluateCapabilities evaluates the registry against discovered properties.
func evaluateCapabilities(discovered DiscoveredProperties, mode string) ([]CapabilityCheckResult, ComplianceSummary) {
	var results []CapabilityCheckResult

	for _, cap := range CapabilityRegistry {
		// Special case: healthcheck
		if cap.ID == "healthcheck" {
			result := evaluateHealthcheck(discovered)
			results = append(results, result)
			continue
		}

		// Special case: env-config checks each ENV var individually
		if cap.ID == "env-config" {
			result := evaluateEnvConfig(discovered)
			results = append(results, result)
			continue
		}

		var checks []CheckDetail

		// Mount checks
		for _, mount := range cap.RequiresMounts {
			check := evaluateMountCheck(mount, discovered, mode)
			checks = append(checks, check)
		}

		// ENV var checks
		for _, envVar := range cap.RequiresEnvVars {
			check := evaluateEnvCheck(envVar, discovered)
			checks = append(checks, check)
		}

		// Network checks (container mode only)
		for _, net := range cap.RequiresNetworks {
			check := evaluateNetworkCheck(net, discovered, mode)
			checks = append(checks, check)
		}

		status := worstStatus(checks)
		results = append(results, CapabilityCheckResult{
			ID:       cap.ID,
			Name:     cap.Name,
			Status:   status,
			Category: cap.Category,
			Checks:   checks,
		})
	}

	summary := summarize(results)
	return results, summary
}

func evaluateMountCheck(expectedMount string, discovered DiscoveredProperties, mode string) CheckDetail {
	if mode == "image" {
		// Image mode: check VOLUME directives
		for _, vol := range discovered.Volumes {
			if vol == expectedMount {
				return CheckDetail{Type: "mount", Key: expectedMount, Pass: true, Found: strPtr(vol)}
			}
		}
		if len(discovered.Volumes) > 0 {
			return CheckDetail{Type: "mount", Key: expectedMount, Pass: false, Found: nil,
				Detail: strPtr(fmt.Sprintf("Expected VOLUME %s not declared in image", expectedMount))}
		}
		return CheckDetail{Type: "mount", Key: expectedMount, Pass: false, Found: nil,
			Detail: strPtr("Image has no VOLUME directives")}
	}

	// Container mode: check actual mounts
	for _, m := range discovered.Mounts {
		if m.Destination == expectedMount {
			return CheckDetail{Type: "mount", Key: expectedMount, Pass: true, Found: strPtr(m.Source)}
		}
	}
	if len(discovered.Mounts) > 0 {
		return CheckDetail{Type: "mount", Key: expectedMount, Pass: false, Found: nil,
			Detail: strPtr(fmt.Sprintf("No mount at %s", expectedMount))}
	}
	return CheckDetail{Type: "mount", Key: expectedMount, Pass: false, Found: nil,
		Detail: strPtr("Container has no mounts")}
}

func evaluateEnvCheck(envVar string, discovered DiscoveredProperties) CheckDetail {
	val, exists := discovered.EnvVars[envVar]
	if !exists {
		return CheckDetail{Type: "env", Key: envVar, Pass: false, Found: nil,
			Detail: strPtr(fmt.Sprintf("ENV %s not found", envVar))}
	}
	displayVal := val
	if sensitiveEnvVars[envVar] {
		displayVal = "***"
	}
	if val == "" {
		return CheckDetail{Type: "env", Key: envVar, Pass: false, Found: strPtr(displayVal),
			Detail: strPtr(fmt.Sprintf("ENV %s exists but is empty", envVar))}
	}
	return CheckDetail{Type: "env", Key: envVar, Pass: true, Found: strPtr(displayVal)}
}

func evaluateNetworkCheck(expectedNetwork string, discovered DiscoveredProperties, mode string) CheckDetail {
	if mode == "image" {
		// Can't check networks at image level — unknown
		return CheckDetail{Type: "network", Key: expectedNetwork, Pass: false, Found: nil,
			Detail: strPtr("Network checks not available in image mode")}
	}
	for _, net := range discovered.Networks {
		if net == expectedNetwork {
			return CheckDetail{Type: "network", Key: expectedNetwork, Pass: true, Found: strPtr(net)}
		}
	}
	return CheckDetail{Type: "network", Key: expectedNetwork, Pass: false, Found: nil,
		Detail: strPtr(fmt.Sprintf("Container not on %s network", expectedNetwork))}
}

func evaluateHealthcheck(discovered DiscoveredProperties) CapabilityCheckResult {
	if discovered.Healthcheck {
		return CapabilityCheckResult{
			ID: "healthcheck", Name: "Health Check", Status: "pass", Category: "health",
			Checks: []CheckDetail{{Type: "env", Key: "HEALTHCHECK", Pass: true, Found: strPtr("configured")}},
		}
	}
	return CapabilityCheckResult{
		ID: "healthcheck", Name: "Health Check", Status: "unknown", Category: "health",
		Checks: []CheckDetail{{Type: "env", Key: "HEALTHCHECK", Pass: false, Found: nil,
			Detail: strPtr("No HEALTHCHECK configured in image")}},
	}
}

func evaluateEnvConfig(discovered DiscoveredProperties) CapabilityCheckResult {
	var checks []CheckDetail
	for _, envVar := range envConfigVars {
		check := evaluateEnvCheck(envVar, discovered)
		checks = append(checks, check)
	}
	status := worstStatus(checks)
	// env-config uses "warn" instead of "fail" for missing vars — the image may
	// still work, it just won't support that particular config field
	if status == "fail" {
		status = "warn"
	}
	return CapabilityCheckResult{
		ID: "env-config", Name: "Environment Configuration", Status: status, Category: "config",
		Checks: checks,
	}
}

// worstStatus returns the worst status from a set of checks.
func worstStatus(checks []CheckDetail) string {
	hasFail := false
	hasWarn := false
	hasUnknown := false
	for _, c := range checks {
		if !c.Pass {
			if c.Detail != nil && strings.Contains(*c.Detail, "not available") {
				hasUnknown = true
			} else {
				hasFail = true
			}
		}
	}
	if hasFail {
		return "fail"
	}
	if hasWarn {
		return "warn"
	}
	if hasUnknown {
		return "unknown"
	}
	return "pass"
}

func summarize(results []CapabilityCheckResult) ComplianceSummary {
	var s ComplianceSummary
	for _, r := range results {
		switch r.Status {
		case "pass":
			s.Pass++
		case "warn":
			s.Warn++
		case "fail":
			s.Fail++
		case "unknown":
			s.Unknown++
		}
	}
	return s
}

// --- Handlers ---

// handleImageCompliance handles image.compliance messages.
func (a *Agent) handleImageCompliance(msg Message) {
	ctx := context.Background()

	if a.docker == nil {
		a.replyError(msg, "Docker client not initialized")
		return
	}

	data, _ := json.Marshal(msg.Data)
	var req ImageComplianceRequest
	if err := json.Unmarshal(data, &req); err != nil {
		a.replyError(msg, "Invalid request: "+err.Error())
		return
	}

	imageRef := req.Registry
	if req.ImageTag != "" {
		imageRef += ":" + req.ImageTag
	}

	log.Printf("Compliance check (image): %s", imageRef)

	// Pull image to ensure it's available locally
	log.Printf("Pulling image for compliance check: %s", imageRef)
	reader, err := a.docker.cli.ImagePull(ctx, imageRef, image.PullOptions{})
	if err != nil {
		a.replyError(msg, fmt.Sprintf("Failed to pull image: %v", err))
		return
	}
	io.Copy(io.Discard, reader)
	reader.Close()

	// Inspect image
	inspect, err := a.docker.cli.ImageInspect(ctx, imageRef)
	if err != nil {
		a.replyError(msg, fmt.Sprintf("Failed to inspect image: %v", err))
		return
	}

	// Discover properties
	discovered := DiscoveredProperties{
		EnvVars:     make(map[string]string),
		Healthcheck: inspect.Config.Healthcheck != nil,
	}

	// Volumes
	for vol := range inspect.Config.Volumes {
		discovered.Volumes = append(discovered.Volumes, vol)
	}

	// ENV vars
	for _, env := range inspect.Config.Env {
		parts := strings.SplitN(env, "=", 2)
		if len(parts) == 2 {
			key := parts[0]
			val := parts[1]
			if sensitiveEnvVars[key] {
				discovered.EnvVars[key] = "***"
			} else {
				discovered.EnvVars[key] = val
			}
		}
	}

	// Exposed ports
	for port := range inspect.Config.ExposedPorts {
		discovered.ExposedPorts = append(discovered.ExposedPorts, string(port))
	}

	// Evaluate — need unmasked env vars for evaluation
	unmaskedEnv := make(map[string]string)
	for _, env := range inspect.Config.Env {
		parts := strings.SplitN(env, "=", 2)
		if len(parts) == 2 {
			unmaskedEnv[parts[0]] = parts[1]
		}
	}
	evalDiscovered := discovered
	evalDiscovered.EnvVars = unmaskedEnv
	capabilities, summary := evaluateCapabilities(evalDiscovered, "image")

	report := ComplianceReport{
		Success:      true,
		ImageRef:     imageRef,
		CheckedAt:    time.Now().UTC().Format(time.RFC3339),
		Mode:         "image",
		Discovered:   discovered,
		Capabilities: capabilities,
		Summary:      summary,
	}

	if msg.Reply != "" {
		a.sendMessage(Message{Subject: msg.Reply, Data: report, Timestamp: time.Now().UnixMilli()})
	}
}

// handleContainerCompliance handles container.compliance messages.
func (a *Agent) handleContainerCompliance(msg Message) {
	ctx := context.Background()

	if a.docker == nil {
		a.replyError(msg, "Docker client not initialized")
		return
	}

	data, _ := json.Marshal(msg.Data)
	var req ContainerComplianceRequest
	if err := json.Unmarshal(data, &req); err != nil {
		a.replyError(msg, "Invalid request: "+err.Error())
		return
	}

	log.Printf("Compliance check (container): %s", req.ContainerID)

	inspect, err := a.docker.cli.ContainerInspect(ctx, req.ContainerID)
	if err != nil {
		a.replyError(msg, fmt.Sprintf("Failed to inspect container: %v", err))
		return
	}

	imageRef := inspect.Config.Image

	// Discover properties
	discovered := DiscoveredProperties{
		EnvVars:     make(map[string]string),
		Healthcheck: inspect.Config.Healthcheck != nil,
	}

	// Mounts
	for _, m := range inspect.Mounts {
		discovered.Mounts = append(discovered.Mounts, ComplianceMountInfo{
			Source:      m.Source,
			Destination: m.Destination,
			Type:        string(m.Type),
		})
	}

	// ENV vars (masked for report, unmasked for evaluation)
	unmaskedEnv := make(map[string]string)
	for _, env := range inspect.Config.Env {
		parts := strings.SplitN(env, "=", 2)
		if len(parts) == 2 {
			key := parts[0]
			val := parts[1]
			unmaskedEnv[key] = val
			if sensitiveEnvVars[key] {
				discovered.EnvVars[key] = "***"
			} else {
				discovered.EnvVars[key] = val
			}
		}
	}

	// Networks
	if inspect.NetworkSettings != nil {
		for netName := range inspect.NetworkSettings.Networks {
			discovered.Networks = append(discovered.Networks, netName)
		}
	}

	// Exposed ports
	for port := range inspect.Config.ExposedPorts {
		discovered.ExposedPorts = append(discovered.ExposedPorts, string(port))
	}

	// Health status
	if inspect.State != nil && inspect.State.Health != nil {
		discovered.Health = inspect.State.Health.Status
	}

	// Evaluate with unmasked env vars
	evalDiscovered := discovered
	evalDiscovered.EnvVars = unmaskedEnv
	capabilities, summary := evaluateCapabilities(evalDiscovered, "container")

	report := ComplianceReport{
		Success:      true,
		ImageRef:     imageRef,
		CheckedAt:    time.Now().UTC().Format(time.RFC3339),
		Mode:         "container",
		Discovered:   discovered,
		Capabilities: capabilities,
		Summary:      summary,
	}

	if msg.Reply != "" {
		a.sendMessage(Message{Subject: msg.Reply, Data: report, Timestamp: time.Now().UnixMilli()})
	}
}

// replyError sends an error compliance report.
func (a *Agent) replyError(msg Message, errMsg string) {
	log.Printf("Compliance error: %s", errMsg)
	if msg.Reply != "" {
		a.sendMessage(Message{
			Subject:   msg.Reply,
			Data:      ComplianceReport{Success: false, Error: errMsg},
			Timestamp: time.Now().UnixMilli(),
		})
	}
}
