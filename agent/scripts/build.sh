#!/usr/bin/env bash
set -e

# ZedOps Agent Build Script
# Uses Docker to build Go binary, extracts to ./bin/
# This ensures consistent builds across platforms

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BIN_DIR="$AGENT_DIR/bin"

echo "==> Building ZedOps Agent"
echo "Agent directory: $AGENT_DIR"
echo "Output directory: $BIN_DIR"
echo ""

# Create bin directory
mkdir -p "$BIN_DIR"

# Build using Docker
echo "==> Building Docker image (zedops-agent-builder)..."
cd "$AGENT_DIR"
docker build -f Dockerfile.build -t zedops-agent-builder --target builder .

# Extract binary from container
echo "==> Extracting binary from container..."
CONTAINER_ID=$(docker create zedops-agent-builder)
docker cp "$CONTAINER_ID:/build/zedops-agent" "$BIN_DIR/zedops-agent"
docker rm "$CONTAINER_ID" > /dev/null 2>&1
chmod +x "$BIN_DIR/zedops-agent"

echo ""
echo "✅ Build complete!"
echo "Binary: $BIN_DIR/zedops-agent"
echo ""
echo "To run the agent:"
echo "  sudo $BIN_DIR/zedops-agent --manager-url wss://zedops.mail-bcf.workers.dev/ws --name <agent-name>"
echo ""
echo "To install as systemd service:"
echo "  sudo $SCRIPT_DIR/install.sh"
