package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
)

var (
	managerURL = flag.String("manager-url", "", "Manager WebSocket URL (e.g., ws://localhost:8787/ws)")
	token      = flag.String("token", "", "Ephemeral token for registration (required on first run)")
	agentName  = flag.String("name", "", "Agent name (default: hostname)")
)

type Agent struct {
	managerURL    string
	agentName      string
	ephemeralToken string
	permanentToken string
	agentID        string
	conn           *websocket.Conn
	docker         *DockerClient
	logStreams     map[string]context.CancelFunc // containerID -> cancel function
	rconManager    *RCONManager                  // RCON session manager
}

func main() {
	flag.Parse()

	// Validate required flags
	if *managerURL == "" {
		log.Fatal("Error: --manager-url is required")
	}

	// Get agent name (default to hostname)
	name := *agentName
	if name == "" {
		hostname, err := os.Hostname()
		if err != nil {
			log.Fatal("Failed to get hostname:", err)
		}
		name = hostname
	}

	// Try to load permanent token
	permanentToken, err := LoadToken()
	if err != nil {
		log.Fatal("Failed to load token:", err)
	}

	// If no permanent token and no ephemeral token provided, error
	if permanentToken == "" && *token == "" {
		log.Fatal("Error: No permanent token found. Provide --token for first-time registration.")
	}

	// Initialize Docker client
	dockerClient, err := NewDockerClient()
	if err != nil {
		log.Printf("Warning: Failed to initialize Docker client: %v", err)
		log.Println("Container control features will be unavailable")
	} else {
		defer dockerClient.Close()
		log.Println("Docker client initialized successfully")
	}

	// Initialize RCON manager (requires Docker client for network access)
	rconManager := NewRCONManager(dockerClient.cli)
	defer rconManager.Close()

	agent := &Agent{
		managerURL:     *managerURL,
		agentName:      name,
		ephemeralToken: *token,
		permanentToken: permanentToken,
		docker:         dockerClient,
		logStreams:     make(map[string]context.CancelFunc),
		rconManager:    rconManager,
	}

	// Set up graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-sigCh
		log.Println("Received shutdown signal, closing connection...")
		cancel()
	}()

	// Run with automatic reconnection
	log.Printf("Starting agent: %s", agent.agentName)
	log.Printf("Manager URL: %s", agent.managerURL)

	if err := agent.RunWithReconnect(ctx); err != nil && err != context.Canceled {
		log.Fatal("Agent error:", err)
	}

	log.Println("Agent stopped")
}

func (a *Agent) register() error {
	// If we have a permanent token, authenticate instead of registering
	if a.permanentToken != "" {
		return a.authenticate()
	}

	log.Println("Registering with ephemeral token...")

	// Send registration message
	regMsg := NewMessage("agent.register", RegisterRequest{
		Token:     a.ephemeralToken,
		AgentName: a.agentName,
	})

	if err := a.sendMessage(regMsg); err != nil {
		return fmt.Errorf("failed to send registration: %w", err)
	}

	// Wait for registration response (with timeout)
	timeout := time.After(10 * time.Second)
	responseCh := make(chan Message, 1)

	// Temporarily read messages to get registration response
	go func() {
		for {
			var msg Message
			err := a.conn.ReadJSON(&msg)
			if err != nil {
				log.Println("Error reading registration response:", err)
				return
			}
			if msg.Subject == "agent.register.success" || msg.Subject == "error" {
				responseCh <- msg
				return
			}
		}
	}()

	select {
	case msg := <-responseCh:
		if msg.Subject == "error" {
			var errResp ErrorResponse
			data, _ := json.Marshal(msg.Data)
			json.Unmarshal(data, &errResp)
			return fmt.Errorf("registration failed: %s", errResp.Message)
		}

		// Parse registration response
		var resp RegisterResponse
		data, _ := json.Marshal(msg.Data)
		if err := json.Unmarshal(data, &resp); err != nil {
			return fmt.Errorf("failed to parse registration response: %w", err)
		}

		a.agentID = resp.AgentID
		a.permanentToken = resp.Token

		// Save permanent token
		if err := SaveToken(a.permanentToken); err != nil {
			return fmt.Errorf("failed to save token: %w", err)
		}

		log.Printf("Registration successful! Agent ID: %s", a.agentID)
		log.Println("Permanent token saved to ~/.zedops-agent/token")
		return nil

	case <-timeout:
		return fmt.Errorf("registration timeout")
	}
}

func (a *Agent) authenticate() error {
	log.Println("Authenticating with permanent token...")

	// Send authentication message
	authMsg := NewMessage("agent.auth", map[string]string{
		"token": a.permanentToken,
	})

	if err := a.sendMessage(authMsg); err != nil {
		return fmt.Errorf("failed to send authentication: %w", err)
	}

	// Wait for authentication response (with timeout)
	timeout := time.After(10 * time.Second)
	responseCh := make(chan Message, 1)

	// Temporarily read messages to get authentication response
	go func() {
		for {
			var msg Message
			err := a.conn.ReadJSON(&msg)
			if err != nil {
				log.Println("Error reading authentication response:", err)
				return
			}
			if msg.Subject == "agent.auth.success" || msg.Subject == "error" {
				responseCh <- msg
				return
			}
		}
	}()

	select {
	case msg := <-responseCh:
		if msg.Subject == "error" {
			var errResp ErrorResponse
			data, _ := json.Marshal(msg.Data)
			json.Unmarshal(data, &errResp)
			return fmt.Errorf("authentication failed: %s", errResp.Message)
		}

		// Parse authentication response
		var resp struct {
			AgentID   string `json:"agentId"`
			AgentName string `json:"agentName"`
			Message   string `json:"message"`
		}
		data, _ := json.Marshal(msg.Data)
		if err := json.Unmarshal(data, &resp); err != nil {
			return fmt.Errorf("failed to parse authentication response: %w", err)
		}

		a.agentID = resp.AgentID
		log.Printf("Authentication successful! Agent ID: %s", a.agentID)
		return nil

	case <-timeout:
		return fmt.Errorf("authentication timeout")
	}
}

func (a *Agent) sendMessage(msg Message) error {
	return a.conn.WriteJSON(msg)
}

func (a *Agent) receiveMessages() {
	for {
		var msg Message
		err := a.conn.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Println("WebSocket error:", err)
			}
			return
		}

		log.Printf("Received: %s - %v", msg.Subject, msg.Data)

		// Handle different message types
		switch msg.Subject {
		case "agent.register.success":
			// Already handled in register()
			continue
		case "agent.heartbeat.ack":
			// Heartbeat acknowledged (silent)
			continue
		case "container.list":
			a.handleContainerList(msg)
		case "container.start":
			a.handleContainerStart(msg)
		case "container.stop":
			a.handleContainerStop(msg)
		case "container.restart":
			a.handleContainerRestart(msg)
		case "container.metrics":
			a.handleContainerMetrics(msg)
		case "log.stream.start":
			a.handleLogStreamStart(msg)
		case "log.stream.stop":
			a.handleLogStreamStop(msg)
		case "server.create":
			a.handleServerCreate(msg)
		case "server.delete":
			a.handleServerDelete(msg)
		case "server.rebuild":
			a.handleServerRebuild(msg)
		case "server.checkdata":
			a.handleServerCheckData(msg)
		case "port.check":
			a.handlePortCheck(msg)
		case "rcon.connect":
			a.handleRCONConnect(msg)
		case "rcon.command":
			a.handleRCONCommand(msg)
		case "rcon.disconnect":
			a.handleRCONDisconnect(msg)
		case "error":
			var errResp ErrorResponse
			data, _ := json.Marshal(msg.Data)
			json.Unmarshal(data, &errResp)
			log.Printf("Error from manager: %s", errResp.Message)
		default:
			log.Printf("Unknown message subject: %s", msg.Subject)
		}
	}
}

// handleContainerList handles container.list messages
func (a *Agent) handleContainerList(msg Message) {
	ctx := context.Background()

	// Check if Docker client is available
	if a.docker == nil {
		a.sendContainerErrorWithReply("", "list", "Docker client not initialized", "DOCKER_NOT_AVAILABLE", msg.Reply)
		return
	}

	// List containers
	containers, err := a.docker.ListContainers(ctx)
	if err != nil {
		log.Printf("Failed to list containers: %v", err)
		a.sendContainerErrorWithReply("", "list", err.Error(), "DOCKER_LIST_FAILED", msg.Reply)
		return
	}

	log.Printf("Listed %d containers", len(containers))

	// Send response to reply subject if specified, otherwise use default
	subject := "container.list.response"
	if msg.Reply != "" {
		subject = msg.Reply
	}

	response := Message{
		Subject: subject,
		Data: map[string]interface{}{
			"containers": containers,
			"count":      len(containers),
		},
		Timestamp: time.Now().Unix(),
	}
	a.sendMessage(response)
}

// handleContainerStart handles container.start messages
func (a *Agent) handleContainerStart(msg Message) {
	ctx := context.Background()

	// Check if Docker client is available
	if a.docker == nil {
		a.sendContainerErrorWithReply("", "start", "Docker client not initialized", "DOCKER_NOT_AVAILABLE", msg.Reply)
		return
	}

	// Parse container ID from message
	data, _ := json.Marshal(msg.Data)
	var op ContainerOperation
	if err := json.Unmarshal(data, &op); err != nil {
		a.sendContainerErrorWithReply("", "start", "Invalid request format", "INVALID_REQUEST", msg.Reply)
		return
	}

	// Start container
	err := a.docker.StartContainer(ctx, op.ContainerID)
	if err != nil {
		log.Printf("Failed to start container %s: %v", op.ContainerID, err)
		a.sendContainerErrorWithReply(op.ContainerID, "start", err.Error(), "DOCKER_START_FAILED", msg.Reply)
		return
	}

	// Send success response
	a.sendContainerSuccessWithReply(op.ContainerID, "start", msg.Reply)
}

// handleContainerStop handles container.stop messages
func (a *Agent) handleContainerStop(msg Message) {
	ctx := context.Background()

	// Check if Docker client is available
	if a.docker == nil {
		a.sendContainerErrorWithReply("", "stop", "Docker client not initialized", "DOCKER_NOT_AVAILABLE", msg.Reply)
		return
	}

	// Parse container ID from message
	data, _ := json.Marshal(msg.Data)
	var op ContainerOperation
	if err := json.Unmarshal(data, &op); err != nil {
		a.sendContainerErrorWithReply("", "stop", "Invalid request format", "INVALID_REQUEST", msg.Reply)
		return
	}

	// Stop container
	err := a.docker.StopContainer(ctx, op.ContainerID)
	if err != nil {
		log.Printf("Failed to stop container %s: %v", op.ContainerID, err)
		a.sendContainerErrorWithReply(op.ContainerID, "stop", err.Error(), "DOCKER_STOP_FAILED", msg.Reply)
		return
	}

	// Send success response
	a.sendContainerSuccessWithReply(op.ContainerID, "stop", msg.Reply)
}

// handleContainerRestart handles container.restart messages
func (a *Agent) handleContainerRestart(msg Message) {
	ctx := context.Background()

	// Check if Docker client is available
	if a.docker == nil {
		a.sendContainerErrorWithReply("", "restart", "Docker client not initialized", "DOCKER_NOT_AVAILABLE", msg.Reply)
		return
	}

	// Parse container ID from message
	data, _ := json.Marshal(msg.Data)
	var op ContainerOperation
	if err := json.Unmarshal(data, &op); err != nil {
		a.sendContainerErrorWithReply("", "restart", "Invalid request format", "INVALID_REQUEST", msg.Reply)
		return
	}

	// Restart container
	err := a.docker.RestartContainer(ctx, op.ContainerID)
	if err != nil {
		log.Printf("Failed to restart container %s: %v", op.ContainerID, err)
		a.sendContainerErrorWithReply(op.ContainerID, "restart", err.Error(), "DOCKER_RESTART_FAILED", msg.Reply)
		return
	}

	// Send success response
	a.sendContainerSuccessWithReply(op.ContainerID, "restart", msg.Reply)
}

// handleContainerMetrics handles container.metrics messages
func (a *Agent) handleContainerMetrics(msg Message) {
	ctx := context.Background()

	// Check if Docker client is available
	if a.docker == nil {
		a.sendContainerErrorWithReply("", "metrics", "Docker client not initialized", "DOCKER_NOT_AVAILABLE", msg.Reply)
		return
	}

	// Parse container ID from message
	data, _ := json.Marshal(msg.Data)
	var request struct {
		ContainerID string `json:"containerId"`
	}
	if err := json.Unmarshal(data, &request); err != nil {
		a.sendContainerErrorWithReply("", "metrics", "Invalid request format", "INVALID_REQUEST", msg.Reply)
		return
	}

	if request.ContainerID == "" {
		a.sendContainerErrorWithReply("", "metrics", "Container ID is required", "MISSING_CONTAINER_ID", msg.Reply)
		return
	}

	log.Printf("Collecting metrics for container: %s", request.ContainerID)

	// Collect container metrics
	metrics, err := a.docker.CollectContainerMetrics(ctx, request.ContainerID)
	if err != nil {
		log.Printf("Failed to collect metrics for container %s: %v", request.ContainerID, err)
		a.sendContainerErrorWithReply(request.ContainerID, "metrics", err.Error(), "METRICS_COLLECTION_FAILED", msg.Reply)
		return
	}

	log.Printf("Collected metrics for container %s: CPU=%.2f%%, Memory=%dMB/%dMB, Uptime=%s",
		request.ContainerID, metrics.CPUPercent, metrics.MemoryUsedMB, metrics.MemoryLimitMB, metrics.Uptime)

	// Send response to reply subject
	subject := "container.metrics.response"
	if msg.Reply != "" {
		subject = msg.Reply
	}

	response := Message{
		Subject: subject,
		Data:    metrics,
		Timestamp: time.Now().Unix(),
	}
	a.sendMessage(response)
}

// sendContainerSuccess sends a success response for a container operation
func (a *Agent) sendContainerSuccess(containerID, operation string) {
	response := NewMessage("container.operation.success", ContainerOperationResponse{
		Success:     true,
		ContainerID: containerID,
		Operation:   operation,
	})
	a.sendMessage(response)
}

// sendContainerError sends an error response for a container operation
func (a *Agent) sendContainerError(containerID, operation, errorMsg, errorCode string) {
	response := NewMessage("container.operation.error", ContainerOperationResponse{
		Success:     false,
		ContainerID: containerID,
		Operation:   operation,
		Error:       errorMsg,
		ErrorCode:   errorCode,
	})
	a.sendMessage(response)
}

// sendContainerSuccessWithReply sends a success response with optional reply-to subject
func (a *Agent) sendContainerSuccessWithReply(containerID, operation, replyTo string) {
	subject := "container.operation.success"
	if replyTo != "" {
		subject = replyTo
	}

	response := Message{
		Subject: subject,
		Data: ContainerOperationResponse{
			Success:     true,
			ContainerID: containerID,
			Operation:   operation,
		},
		Timestamp: time.Now().Unix(),
	}
	a.sendMessage(response)
}

// sendContainerErrorWithReply sends an error response with optional reply-to subject
func (a *Agent) sendContainerErrorWithReply(containerID, operation, errorMsg, errorCode, replyTo string) {
	subject := "container.operation.error"
	if replyTo != "" {
		subject = replyTo
	}

	response := Message{
		Subject: subject,
		Data: ContainerOperationResponse{
			Success:     false,
			ContainerID: containerID,
			Operation:   operation,
			Error:       errorMsg,
			ErrorCode:   errorCode,
		},
		Timestamp: time.Now().Unix(),
	}
	a.sendMessage(response)
}

// handleLogStreamStart handles log.stream.start messages
func (a *Agent) handleLogStreamStart(msg Message) {
	// Check if Docker client is available
	if a.docker == nil {
		a.sendLogStreamError("", "Docker client not initialized", "DOCKER_NOT_AVAILABLE", msg.Reply)
		return
	}

	// Parse request
	data, _ := json.Marshal(msg.Data)
	var req struct {
		ContainerID string `json:"containerId"`
		Tail        int    `json:"tail"`
		Follow      bool   `json:"follow"`
		Timestamps  bool   `json:"timestamps"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		a.sendLogStreamError("", "Invalid request format", "INVALID_REQUEST", msg.Reply)
		return
	}

	// Check if already streaming this container
	if _, exists := a.logStreams[req.ContainerID]; exists {
		a.sendLogStreamError(req.ContainerID, "Already streaming logs for this container", "ALREADY_STREAMING", msg.Reply)
		return
	}

	// Default tail to 1000 if not specified
	if req.Tail == 0 {
		req.Tail = 1000
	}

	// Create context for this log stream
	ctx, cancel := context.WithCancel(context.Background())
	a.logStreams[req.ContainerID] = cancel

	log.Printf("Starting log stream for container: %s (tail: %d)", req.ContainerID, req.Tail)

	// Start streaming logs
	logChan, errChan := a.docker.StreamContainerLogs(ctx, req.ContainerID, req.Tail)

	// Send acknowledgment
	if msg.Reply != "" {
		response := Message{
			Subject: msg.Reply,
			Data: map[string]interface{}{
				"success":     true,
				"containerId": req.ContainerID,
				"message":     "Log streaming started",
			},
			Timestamp: time.Now().Unix(),
		}
		a.sendMessage(response)
	}

	// Forward logs to manager
	go func() {
		defer func() {
			delete(a.logStreams, req.ContainerID)
			log.Printf("Stopped log stream for container: %s", req.ContainerID)
		}()

		for {
			select {
			case logLine, ok := <-logChan:
				if !ok {
					// Channel closed, stream ended
					return
				}

				// Send log line to manager
				logMsg := Message{
					Subject:   "log.line",
					Data:      logLine,
					Timestamp: time.Now().Unix(),
				}
				if err := a.sendMessage(logMsg); err != nil {
					log.Printf("Failed to send log line: %v", err)
					return
				}

			case err, ok := <-errChan:
				if ok && err != nil {
					log.Printf("Log streaming error for %s: %v", req.ContainerID, err)
					a.sendLogStreamError(req.ContainerID, err.Error(), "DOCKER_LOG_FAILED", "")
					return
				}

			case <-ctx.Done():
				return
			}
		}
	}()
}

// handleLogStreamStop handles log.stream.stop messages
func (a *Agent) handleLogStreamStop(msg Message) {
	// Parse request
	data, _ := json.Marshal(msg.Data)
	var req struct {
		ContainerID string `json:"containerId"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		a.sendLogStreamError("", "Invalid request format", "INVALID_REQUEST", msg.Reply)
		return
	}

	// Check if stream exists
	cancel, exists := a.logStreams[req.ContainerID]
	if !exists {
		a.sendLogStreamError(req.ContainerID, "No active log stream for this container", "NOT_STREAMING", msg.Reply)
		return
	}

	// Cancel the stream
	cancel()
	delete(a.logStreams, req.ContainerID)

	log.Printf("Stopped log stream for container: %s", req.ContainerID)

	// Send acknowledgment
	if msg.Reply != "" {
		response := Message{
			Subject: msg.Reply,
			Data: map[string]interface{}{
				"success":     true,
				"containerId": req.ContainerID,
				"message":     "Log streaming stopped",
			},
			Timestamp: time.Now().Unix(),
		}
		a.sendMessage(response)
	}
}

// sendLogStreamError sends a log streaming error message
func (a *Agent) sendLogStreamError(containerID, errorMsg, errorCode, replyTo string) {
	subject := "log.stream.error"
	if replyTo != "" {
		subject = replyTo
	}

	response := Message{
		Subject: subject,
		Data: map[string]interface{}{
			"success":     false,
			"containerId": containerID,
			"error":       errorMsg,
			"errorCode":   errorCode,
		},
		Timestamp: time.Now().Unix(),
	}
	a.sendMessage(response)
}

// handleServerCreate handles server.create messages
func (a *Agent) handleServerCreate(msg Message) {
	ctx := context.Background()

	// Check if Docker client is available
	if a.docker == nil {
		a.sendServerErrorWithReply("", "", "create", "Docker client not initialized", "DOCKER_NOT_AVAILABLE", msg.Reply)
		return
	}

	// Parse request
	data, _ := json.Marshal(msg.Data)
	var req ServerCreateRequest
	if err := json.Unmarshal(data, &req); err != nil {
		a.sendServerErrorWithReply("", "", "create", "Invalid request format", "INVALID_REQUEST", msg.Reply)
		return
	}

	log.Printf("Creating server: %s (registry: %s, tag: %s)", req.Name, req.Registry, req.ImageTag)

	// Create server config
	config := ServerConfig{
		ServerID: req.ServerID,
		Name:     req.Name,
		Registry: req.Registry,
		ImageTag: req.ImageTag,
		Config:   req.Config,
		GamePort: req.GamePort,
		UDPPort:  req.UDPPort,
		RCONPort: req.RCONPort,
		DataPath: req.DataPath,
	}

	// Create server
	containerID, err := a.docker.CreateServer(ctx, config)
	if err != nil {
		log.Printf("Failed to create server %s: %v", req.Name, err)
		a.sendServerErrorWithReply(req.ServerID, "", "create", err.Error(), "SERVER_CREATE_FAILED", msg.Reply)
		return
	}

	log.Printf("Server created successfully: %s (container: %s)", req.Name, containerID)

	// Send success response
	a.sendServerSuccessWithReply(req.ServerID, containerID, "create", msg.Reply)
}

// handleServerDelete handles server.delete messages
func (a *Agent) handleServerDelete(msg Message) {
	ctx := context.Background()

	// Check if Docker client is available
	if a.docker == nil {
		a.sendServerErrorWithReply("", "", "delete", "Docker client not initialized", "DOCKER_NOT_AVAILABLE", msg.Reply)
		return
	}

	// Parse request
	data, _ := json.Marshal(msg.Data)
	var req ServerDeleteRequest
	if err := json.Unmarshal(data, &req); err != nil {
		a.sendServerErrorWithReply("", "", "delete", "Invalid request format", "INVALID_REQUEST", msg.Reply)
		return
	}

	log.Printf("Deleting server: containerID=%s, serverName=%s, removeVolumes=%v", req.ContainerID, req.ServerName, req.RemoveVolumes)

	// Delete server (container and/or data)
	err := a.docker.DeleteServer(ctx, req.ContainerID, req.ServerName, req.RemoveVolumes)
	if err != nil {
		log.Printf("Failed to delete server (container=%s, name=%s): %v", req.ContainerID, req.ServerName, err)
		a.sendServerErrorWithReply("", req.ContainerID, "delete", err.Error(), "SERVER_DELETE_FAILED", msg.Reply)
		return
	}

	log.Printf("Server deleted successfully: %s", req.ServerName)

	// Send success response
	a.sendServerSuccessWithReply("", req.ContainerID, "delete", msg.Reply)
}

// handleServerRebuild handles server.rebuild messages
func (a *Agent) handleServerRebuild(msg Message) {
	ctx := context.Background()

	// Check if Docker client is available
	if a.docker == nil {
		a.sendServerErrorWithReply("", "", "rebuild", "Docker client not initialized", "DOCKER_NOT_AVAILABLE", msg.Reply)
		return
	}

	// Parse request
	data, _ := json.Marshal(msg.Data)
	var req ServerRebuildRequest
	if err := json.Unmarshal(data, &req); err != nil {
		a.sendServerErrorWithReply("", "", "rebuild", "Invalid request format", "INVALID_REQUEST", msg.Reply)
		return
	}

	log.Printf("Rebuilding server container: %s", req.ContainerID)

	// Rebuild server
	newContainerID, err := a.docker.RebuildServer(ctx, req.ContainerID)
	if err != nil {
		log.Printf("Failed to rebuild server %s: %v", req.ContainerID, err)
		a.sendServerErrorWithReply("", req.ContainerID, "rebuild", err.Error(), "SERVER_REBUILD_FAILED", msg.Reply)
		return
	}

	log.Printf("Server rebuilt successfully: %s -> %s", req.ContainerID, newContainerID)

	// Send success response with new container ID
	if msg.Reply != "" {
		response := Message{
			Subject: msg.Reply,
			Data: map[string]interface{}{
				"success":        true,
				"oldContainerID": req.ContainerID,
				"newContainerID": newContainerID,
				"operation":      "rebuild",
			},
			Timestamp: time.Now().Unix(),
		}
		a.sendMessage(response)
	}
}

// handleServerCheckData handles server.checkdata messages
func (a *Agent) handleServerCheckData(msg Message) {
	// Parse request
	data, _ := json.Marshal(msg.Data)
	var req ServerCheckDataRequest
	if err := json.Unmarshal(data, &req); err != nil {
		if msg.Reply != "" {
			response := Message{
				Subject: msg.Reply,
				Data: ServerCheckDataResponse{
					Success: false,
					Error:   "Invalid request format",
				},
				Timestamp: time.Now().Unix(),
			}
			a.sendMessage(response)
		}
		return
	}

	log.Printf("Checking data existence for %d server(s)", len(req.Servers))

	// Check data existence for each server
	statuses := make([]ServerDataStatus, 0, len(req.Servers))
	for _, serverName := range req.Servers {
		status := a.docker.CheckServerData(serverName, req.DataPath)
		statuses = append(statuses, status)

		log.Printf("Server %s: data_exists=%t (bin=%t, data=%t)",
			serverName, status.DataExists, status.BinExists, status.DataFolderExists)
	}

	// Send response
	if msg.Reply != "" {
		response := Message{
			Subject: msg.Reply,
			Data: ServerCheckDataResponse{
				Success:  true,
				Statuses: statuses,
			},
			Timestamp: time.Now().Unix(),
		}
		a.sendMessage(response)
	}
}

// handlePortCheck handles port.check messages
func (a *Agent) handlePortCheck(msg Message) {
	ctx := context.Background()

	// Check if Docker client is available
	if a.docker == nil {
		if msg.Reply != "" {
			response := Message{
				Subject: msg.Reply,
				Data: map[string]interface{}{
					"success": false,
					"error":   "Docker client not initialized",
				},
				Timestamp: time.Now().Unix(),
			}
			a.sendMessage(response)
		}
		return
	}

	// Parse request
	data, _ := json.Marshal(msg.Data)
	var req PortCheckRequest
	if err := json.Unmarshal(data, &req); err != nil {
		if msg.Reply != "" {
			response := Message{
				Subject: msg.Reply,
				Data: map[string]interface{}{
					"success": false,
					"error":   "Invalid port check request format",
				},
				Timestamp: time.Now().Unix(),
			}
			a.sendMessage(response)
		}
		return
	}

	log.Printf("Checking port availability for ports: %v", req.Ports)

	// Check port availability
	availability, err := a.docker.CheckPortAvailability(ctx, req.Ports)
	if err != nil {
		log.Printf("Failed to check port availability: %v", err)
		if msg.Reply != "" {
			response := Message{
				Subject: msg.Reply,
				Data: map[string]interface{}{
					"success": false,
					"error":   fmt.Sprintf("Port check failed: %v", err),
				},
				Timestamp: time.Now().Unix(),
			}
			a.sendMessage(response)
		}
		return
	}

	log.Printf("Port check complete: %d available, %d unavailable",
		len(availability.Available), len(availability.Unavailable))

	// Send response
	if msg.Reply != "" {
		response := Message{
			Subject:   msg.Reply,
			Data:      availability,
			Timestamp: time.Now().Unix(),
		}
		a.sendMessage(response)
	}
}

// sendServerSuccessWithReply sends a success response for a server operation
func (a *Agent) sendServerSuccessWithReply(serverID, containerID, operation, replyTo string) {
	subject := "server.operation.success"
	if replyTo != "" {
		subject = replyTo
	}

	response := Message{
		Subject: subject,
		Data: ServerOperationResponse{
			Success:     true,
			ServerID:    serverID,
			ContainerID: containerID,
			Operation:   operation,
		},
		Timestamp: time.Now().Unix(),
	}
	a.sendMessage(response)
}

// sendServerErrorWithReply sends an error response for a server operation
func (a *Agent) sendServerErrorWithReply(serverID, containerID, operation, errorMsg, errorCode, replyTo string) {
	subject := "server.operation.error"
	if replyTo != "" {
		subject = replyTo
	}

	response := Message{
		Subject: subject,
		Data: ServerOperationResponse{
			Success:     false,
			ServerID:    serverID,
			ContainerID: containerID,
			Operation:   operation,
			Error:       errorMsg,
			ErrorCode:   errorCode,
		},
		Timestamp: time.Now().Unix(),
	}
	a.sendMessage(response)
}

// handleRCONConnect handles rcon.connect messages
func (a *Agent) handleRCONConnect(msg Message) {
	// Parse connection data
	data, _ := json.Marshal(msg.Data)
	var req struct {
		ServerID    string `json:"serverId"`
		ContainerID string `json:"containerId"`
		Port        int    `json:"port"`
		Password    string `json:"password"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		a.sendRCONError("", "Invalid request format", "INVALID_REQUEST", msg.Reply)
		return
	}

	// Validate required fields
	if req.ContainerID == "" {
		a.sendRCONError("", "containerID is required", "INVALID_REQUEST", msg.Reply)
		return
	}

	// Connect to RCON via Docker network
	sessionID, err := a.rconManager.Connect(req.ServerID, req.ContainerID, req.Port, req.Password)
	if err != nil {
		log.Printf("[RCON] Connection failed for container %s: %v", req.ContainerID[:12], err)
		a.sendRCONError("", err.Error(), "RCON_CONNECT_FAILED", msg.Reply)
		return
	}

	// Send success response
	subject := "rcon.connect.response"
	if msg.Reply != "" {
		subject = msg.Reply
	}

	response := Message{
		Subject: subject,
		Data: map[string]interface{}{
			"success":   true,
			"sessionId": sessionID,
		},
		Timestamp: time.Now().Unix(),
	}
	a.sendMessage(response)
}

// handleRCONCommand handles rcon.command messages
func (a *Agent) handleRCONCommand(msg Message) {
	// Parse command data
	data, _ := json.Marshal(msg.Data)
	var req struct {
		SessionID string `json:"sessionId"`
		Command   string `json:"command"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		a.sendRCONError(req.SessionID, "Invalid request format", "INVALID_REQUEST", msg.Reply)
		return
	}

	// Execute command
	response, err := a.rconManager.Execute(req.SessionID, req.Command)
	if err != nil {
		log.Printf("RCON command failed: %v", err)
		a.sendRCONError(req.SessionID, err.Error(), "RCON_COMMAND_FAILED", msg.Reply)
		return
	}

	// Send success response
	subject := "rcon.command.response"
	if msg.Reply != "" {
		subject = msg.Reply
	}

	responseMsg := Message{
		Subject: subject,
		Data: map[string]interface{}{
			"success":  true,
			"response": response,
		},
		Timestamp: time.Now().Unix(),
	}
	a.sendMessage(responseMsg)
}

// handleRCONDisconnect handles rcon.disconnect messages
func (a *Agent) handleRCONDisconnect(msg Message) {
	// Parse disconnect data
	data, _ := json.Marshal(msg.Data)
	var req struct {
		SessionID string `json:"sessionId"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		a.sendRCONError("", "Invalid request format", "INVALID_REQUEST", msg.Reply)
		return
	}

	// Disconnect
	err := a.rconManager.Disconnect(req.SessionID)
	if err != nil {
		log.Printf("RCON disconnect failed: %v", err)
		a.sendRCONError(req.SessionID, err.Error(), "RCON_DISCONNECT_FAILED", msg.Reply)
		return
	}

	// Send success response
	subject := "rcon.disconnect.response"
	if msg.Reply != "" {
		subject = msg.Reply
	}

	response := Message{
		Subject: subject,
		Data: map[string]interface{}{
			"success": true,
		},
		Timestamp: time.Now().Unix(),
	}
	a.sendMessage(response)
}

// sendRCONError sends an error response for RCON operations
func (a *Agent) sendRCONError(sessionID, errorMsg, errorCode, replyTo string) {
	subject := "rcon.error"
	if replyTo != "" {
		subject = replyTo
	}

	response := Message{
		Subject: subject,
		Data: map[string]interface{}{
			"success":   false,
			"sessionId": sessionID,
			"error":     errorMsg,
			"errorCode": errorCode,
		},
		Timestamp: time.Now().Unix(),
	}
	a.sendMessage(response)
}
