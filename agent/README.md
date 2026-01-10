# ZedOps Agent

Go-based agent that runs on machines hosting Project Zomboid dedicated servers. Establishes WebSocket connection to the ZedOps manager for remote control and monitoring.

## Features

- **Agent Registration**: Exchanges ephemeral token for permanent token
- **WebSocket Connection**: Persistent connection to manager
- **Automatic Reconnection**: Exponential backoff on network loss
- **Heartbeat**: Sends periodic heartbeat to maintain "online" status
- **Message Protocol**: NATS-inspired subject-based routing

## Tech Stack

- **Language:** Go 1.21+
- **WebSocket:** gorilla/websocket
- **Protocol:** NATS-inspired (subject-based routing)

## Installation

### From Source

```bash
# Clone repository
git clone https://github.com/lasmarois/zedops.git
cd zedops/agent

# Build binary
go build -o agent main.go

# Run agent (first time - registration)
./agent --manager-url=https://zedops.your-domain.workers.dev --token=<ephemeral-token>

# Subsequent runs (uses saved permanent token)
./agent --manager-url=https://zedops.your-domain.workers.dev
```

### Configuration

**Flags:**
- `--manager-url` - Manager WebSocket URL (required)
- `--token` - Ephemeral token for first-time registration (required on first run)
- `--name` - Agent name (default: hostname)

**Token Storage:**
- Permanent token saved to `~/.zedops-agent/token` after registration
- Automatically reused on subsequent runs

## Development

```bash
# Run locally
go run main.go --manager-url=ws://localhost:8787 --token=<ephemeral>

# Build
go build -o agent main.go

# Test
go test ./...
```

## Project Structure

```
agent/
├── main.go           # Entrypoint, connection loop
├── message.go        # Message protocol implementation
├── token.go          # Token storage and loading
├── reconnect.go      # Reconnection logic
└── go.mod            # Dependencies
```

## Message Protocol

Agent uses NATS-inspired subject-based routing:

```go
type Message struct {
    Subject   string      `json:"subject"`
    Reply     string      `json:"reply,omitempty"`
    Data      interface{} `json:"data"`
    Timestamp int64       `json:"timestamp,omitempty"`
}
```

**Example subjects:**
- `agent.register` - Register with ephemeral token
- `agent.heartbeat` - Send heartbeat (every 30s)
- `server.start` - Start Zomboid server (future milestone)
- `inbox.*` - Reply inbox for request/reply pattern

## Reconnection Strategy

- **Exponential backoff**: 1s → 2s → 4s → 8s → ... → 60s (cap)
- **Unlimited retries**: Agent never gives up
- **Reuse permanent token**: No re-registration needed

## Logging

Agent logs to stdout:
- Connection state changes
- Registration status
- Errors and reconnection attempts
- Heartbeat intervals (debug mode)
