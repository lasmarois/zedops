---
paths:
  - "agent/**"
---

# Agent Development Rules (Go)

## Tech Stack

- **WebSocket**: `gorilla/websocket`
- **Docker**: `docker/docker` SDK
- **Protocol**: NATS-inspired message format

## Critical Design Decision

The agent runs **directly on the host**, NOT in a Docker container:
- Accurate port checking (no network namespace isolation)
- Host metrics collection (CPU, RAM, disk via `/proc`, `/sys`)
- Full Docker socket access

## Patterns

- Implement reconnection logic (agents may lose connection)
- Graceful shutdown on SIGTERM/SIGINT
- NATS-inspired message protocol (see @ARCHITECTURE.md#message-protocol)

## Commands

```bash
# Local development
go run main.go --manager-url ws://localhost:8787/ws --name maestroserver

# Build production binary
./scripts/build.sh  # Uses Docker for cross-compilation

# Run production binary
sudo ./bin/zedops-agent --manager-url wss://zedops.mail-bcf.workers.dev/ws --name maestroserver

# Install as systemd service
sudo ./scripts/install.sh
```

## Production Deployment

```bash
sudo systemctl status zedops-agent
sudo systemctl restart zedops-agent
sudo journalctl -u zedops-agent -f
```
