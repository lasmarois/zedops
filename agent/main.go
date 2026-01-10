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
