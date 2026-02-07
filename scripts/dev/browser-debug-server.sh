#!/usr/bin/env bash
# Run this on the SERVER as an alternative to the laptop script.
# Creates an SSH tunnel from the server to your laptop's Brave debug port.
#
# Usage:
#   ./browser-debug-server.sh [laptop-user@laptop-ip]
#
# Example:
#   ./browser-debug-server.sh nicolas@192.168.200.250
#
# Prerequisites:
#   - Brave running on laptop with: --remote-debugging-port=9222 --user-data-dir="$HOME/BraveDebug"
#   - SSH access from server to laptop
#   - Chrome DevTools MCP configured (already done)

set -euo pipefail

DEBUG_PORT=9222
LAPTOP="${1:-}"

if [[ -z "$LAPTOP" ]]; then
    echo "Usage: $0 <laptop-user@laptop-ip>"
    echo "Example: $0 nicolas@192.168.200.250"
    exit 1
fi

# Check if tunnel is already active
if curl -s "http://127.0.0.1:${DEBUG_PORT}/json/version" >/dev/null 2>&1; then
    echo "[OK] Tunnel already active - browser reachable on port ${DEBUG_PORT}"
    curl -s "http://127.0.0.1:${DEBUG_PORT}/json/version" | python3 -m json.tool 2>/dev/null || true
    exit 0
fi

echo "[..] Creating SSH tunnel to ${LAPTOP}..."
echo "    localhost:${DEBUG_PORT} -> ${LAPTOP}:${DEBUG_PORT}"
echo ""
echo "    Tunnel active. Press Ctrl+C to disconnect."
echo ""

# Forward local port to laptop's debug port
ssh -L ${DEBUG_PORT}:127.0.0.1:${DEBUG_PORT} -N "$LAPTOP"
