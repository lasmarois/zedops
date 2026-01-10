package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/url"
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
	agentName     string
	ephemeralToken string
	permanentToken string
	agentID       string
	conn          *websocket.Conn
	done          chan struct{}
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

	agent := &Agent{
		managerURL:     *managerURL,
		agentName:      name,
		ephemeralToken: *token,
		permanentToken: permanentToken,
		done:           make(chan struct{}),
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

	// Connect and run
	if err := agent.Run(ctx); err != nil {
		log.Fatal("Agent error:", err)
	}
}

func (a *Agent) Run(ctx context.Context) error {
	log.Printf("Starting agent: %s", a.agentName)
	log.Printf("Connecting to manager: %s", a.managerURL)

	// Parse manager URL
	u, err := url.Parse(a.managerURL)
	if err != nil {
		return fmt.Errorf("invalid manager URL: %w", err)
	}

	// Connect to manager
	conn, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		return fmt.Errorf("failed to connect to manager: %w", err)
	}
	defer conn.Close()

	a.conn = conn
	log.Println("WebSocket connection established")

	// Register agent
	if err := a.register(); err != nil {
		return fmt.Errorf("registration failed: %w", err)
	}

	// Start message receiver
	go a.receiveMessages()

	// Wait for shutdown or connection close
	select {
	case <-ctx.Done():
		log.Println("Shutting down...")
		// Send close message
		err := conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
		if err != nil {
			log.Println("Error sending close message:", err)
		}
		return nil
	case <-a.done:
		return fmt.Errorf("connection closed")
	}
}

func (a *Agent) register() error {
	// If we have a permanent token, we're already registered (skip registration)
	if a.permanentToken != "" {
		log.Println("Using existing permanent token (already registered)")
		a.agentID = "existing" // Will be updated from token payload if needed
		return nil
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

func (a *Agent) sendMessage(msg Message) error {
	return a.conn.WriteJSON(msg)
}

func (a *Agent) receiveMessages() {
	defer close(a.done)

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
			// Heartbeat acknowledged
			continue
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
