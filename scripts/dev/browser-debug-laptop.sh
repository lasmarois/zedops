#!/usr/bin/env bash
# Run this on your LAPTOP (macOS) to enable browser debugging for Claude Code.
# It launches Brave with remote debugging and sets up an SSH tunnel to the server.
#
# Usage:
#   ./browser-debug-laptop.sh [server-user@server-ip]
#
# Example:
#   ./browser-debug-laptop.sh root@10.0.13.31
#
# Prerequisites:
#   - Brave Browser installed
#   - SSH access to the dev server
#   - Chrome DevTools MCP configured on the server (already done)

set -euo pipefail

DEBUG_PORT=9222
BRAVE_APP="/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
SERVER="${1:-}"

if [[ -z "$SERVER" ]]; then
    echo "Usage: $0 <server-user@server-ip>"
    echo "Example: $0 root@10.0.13.31"
    exit 1
fi

# Check if Brave is already running with debug port
if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${DEBUG_PORT}/json/version" 2>/dev/null | grep -q "200"; then
    echo "[OK] Brave already running with debug port ${DEBUG_PORT}"
else
    echo "[..] Launching Brave with remote debugging on port ${DEBUG_PORT}..."

    # Kill existing Brave instances
    pkill -f "Brave Browser" 2>/dev/null || true
    sleep 1

    # Launch Brave with debug port and separate profile
    "$BRAVE_APP" \
        --remote-debugging-port=${DEBUG_PORT} \
        --user-data-dir="$HOME/BraveDebug" &

    # Wait for Brave to start
    echo "[..] Waiting for Brave to start..."
    for i in {1..10}; do
        if curl -s "http://127.0.0.1:${DEBUG_PORT}/json/version" >/dev/null 2>&1; then
            echo "[OK] Brave ready on port ${DEBUG_PORT}"
            break
        fi
        sleep 1
    done
fi

# Verify Brave is responding
if ! curl -s "http://127.0.0.1:${DEBUG_PORT}/json/version" >/dev/null 2>&1; then
    echo "[FAIL] Brave not responding on port ${DEBUG_PORT}"
    echo "Try manually: \"$BRAVE_APP\" --remote-debugging-port=${DEBUG_PORT} --user-data-dir=\"\$HOME/BraveDebug\""
    exit 1
fi

echo ""
echo "[..] Setting up SSH tunnel to ${SERVER}..."
echo "    Server localhost:${DEBUG_PORT} -> Laptop localhost:${DEBUG_PORT}"
echo ""
echo "    Tunnel active. Press Ctrl+C to disconnect."
echo ""

# SSH with reverse tunnel (server can reach laptop's debug port)
# -N = no remote command, -L on server side via -R from laptop
ssh -R ${DEBUG_PORT}:127.0.0.1:${DEBUG_PORT} -N "$SERVER"
