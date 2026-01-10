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

	agent := &Agent{
		managerURL:     *managerURL,
		agentName:      name,
		ephemeralToken: *token,
		permanentToken: permanentToken,
		docker:         dockerClient,
		logStreams:     make(map[string]context.CancelFunc),
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
		case "log.stream.start":
			a.handleLogStreamStart(msg)
		case "log.stream.stop":
			a.handleLogStreamStop(msg)
		case "server.create":
			a.handleServerCreate(msg)
		case "server.delete":
			a.handleServerDelete(msg)
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

	log.Printf("Deleting server container: %s", req.ContainerID)

	// Delete server
	err := a.docker.DeleteServer(ctx, req.ContainerID, req.RemoveVolumes)
	if err != nil {
		log.Printf("Failed to delete server %s: %v", req.ContainerID, err)
		a.sendServerErrorWithReply("", req.ContainerID, "delete", err.Error(), "SERVER_DELETE_FAILED", msg.Reply)
		return
	}

	log.Printf("Server deleted successfully: %s", req.ContainerID)

	// Send success response
	a.sendServerSuccessWithReply("", req.ContainerID, "delete", msg.Reply)
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
