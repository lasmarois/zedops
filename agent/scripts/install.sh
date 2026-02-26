#!/usr/bin/env bash
set -e

# ZedOps Agent Installation Script
# Usage: curl -sSL https://raw.githubusercontent.com/lasmarois/zedops/main/agent/scripts/install.sh | sudo bash -s -- [options]
#
# Options:
#   --manager-url URL    Manager WebSocket URL (required)
#   --name NAME          Agent name (default: hostname)
#   --token TOKEN        Registration token (optional, for first-time setup)
#   --version VERSION    Specific version to install (default: latest)

GITHUB_REPO="lasmarois/zedops"
INSTALL_DIR="/usr/local/bin"
CONFIG_DIR="/etc/zedops-agent"
SERVICE_FILE="/etc/systemd/system/zedops-agent.service"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
MANAGER_URL=""
AGENT_NAME=""
TOKEN=""
VERSION="latest"

while [[ $# -gt 0 ]]; do
    case $1 in
        --manager-url)
            MANAGER_URL="$2"
            shift 2
            ;;
        --name)
            AGENT_NAME="$2"
            shift 2
            ;;
        --token)
            TOKEN="$2"
            shift 2
            ;;
        --version)
            VERSION="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Please run as root (sudo)"
        exit 1
    fi
}

validate_token() {
    # Convert WebSocket URL to HTTPS for API call
    # wss://host/ws -> https://host
    API_BASE=$(echo "$MANAGER_URL" | sed 's|^wss://|https://|;s|^ws://|http://|;s|/ws$||')

    log_info "Validating token against ${API_BASE}..."

    VALIDATE_RESPONSE=$(curl -sSL -w "\n%{http_code}" \
        -X POST "${API_BASE}/api/agent/validate-token" \
        -H "Content-Type: application/json" \
        -d "{\"token\":\"${TOKEN}\",\"agentName\":\"${AGENT_NAME}\"}" \
        2>/dev/null) || true

    HTTP_CODE=$(echo "$VALIDATE_RESPONSE" | tail -1)
    BODY=$(echo "$VALIDATE_RESPONSE" | sed '$d')

    if [ -z "$HTTP_CODE" ] || [ "$HTTP_CODE" = "000" ]; then
        log_warn "Could not reach manager for token validation (network error) — proceeding anyway"
        return
    fi

    # Parse the valid field from JSON response
    IS_VALID=$(echo "$BODY" | grep -o '"valid":\s*true' || true)

    if [ -n "$IS_VALID" ]; then
        log_info "Token valid ✓"
    else
        # Extract error message from response
        ERROR_MSG=$(echo "$BODY" | grep -o '"error":"[^"]*"' | sed 's/"error":"//;s/"$//' || echo "Unknown error")
        log_error "Token validation failed: ${ERROR_MSG}"
        log_error "Generate a new token from the manager UI and try again"
        exit 1
    fi
}

detect_platform() {
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)

    case "$ARCH" in
        x86_64)
            ARCH="amd64"
            ;;
        aarch64|arm64)
            ARCH="arm64"
            ;;
        *)
            log_error "Unsupported architecture: $ARCH"
            exit 1
            ;;
    esac

    case "$OS" in
        linux)
            OS="linux"
            ;;
        *)
            log_error "Unsupported operating system: $OS (only Linux is supported)"
            exit 1
            ;;
    esac

    log_info "Detected platform: ${OS}/${ARCH}"
}

get_latest_version() {
    if [ "$VERSION" = "latest" ]; then
        log_info "Fetching latest version from GitHub..."
        VERSION=$(curl -sSL "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"agent-v([^"]+)".*/\1/' || echo "")

        if [ -z "$VERSION" ]; then
            # Fallback: list all releases and find latest agent release
            VERSION=$(curl -sSL "https://api.github.com/repos/${GITHUB_REPO}/releases" | grep '"tag_name": "agent-v' | head -1 | sed -E 's/.*"agent-v([^"]+)".*/\1/' || echo "")
        fi

        if [ -z "$VERSION" ]; then
            log_error "Could not determine latest version. Please specify with --version"
            exit 1
        fi
    fi

    log_info "Installing version: ${VERSION}"
}

download_binary() {
    BINARY_NAME="zedops-agent-${OS}-${ARCH}"
    DOWNLOAD_URL="https://github.com/${GITHUB_REPO}/releases/download/agent-v${VERSION}/${BINARY_NAME}"

    log_info "Downloading from: ${DOWNLOAD_URL}"

    if ! curl -sSL -o "/tmp/zedops-agent" "$DOWNLOAD_URL"; then
        log_error "Failed to download binary"
        exit 1
    fi

    chmod +x /tmp/zedops-agent

    # Verify binary works
    if ! /tmp/zedops-agent --version > /dev/null 2>&1; then
        log_error "Downloaded binary is not executable or corrupted"
        exit 1
    fi

    log_info "Binary downloaded and verified"
}

install_binary() {
    log_info "Installing binary to ${INSTALL_DIR}..."

    # Stop existing service if running
    if systemctl is-active --quiet zedops-agent 2>/dev/null; then
        log_info "Stopping existing service..."
        systemctl stop zedops-agent
    fi

    mv /tmp/zedops-agent "${INSTALL_DIR}/zedops-agent"
    chmod +x "${INSTALL_DIR}/zedops-agent"

    # Fix SELinux context if SELinux is enabled (binary comes from /tmp with wrong context)
    if command -v restorecon &> /dev/null; then
        restorecon -v "${INSTALL_DIR}/zedops-agent" 2>/dev/null || true
    fi

    log_info "Binary installed: ${INSTALL_DIR}/zedops-agent"
}

setup_config() {
    log_info "Setting up configuration..."

    mkdir -p "$CONFIG_DIR"

    # Prompt for manager URL if not provided
    if [ -z "$MANAGER_URL" ]; then
        echo -n "Enter Manager WebSocket URL (e.g., wss://zedops.example.com/ws): "
        read -r MANAGER_URL
    fi

    if [ -z "$MANAGER_URL" ]; then
        log_error "Manager URL is required"
        exit 1
    fi

    # Default agent name to hostname
    if [ -z "$AGENT_NAME" ]; then
        AGENT_NAME=$(hostname)
    fi

    # Create config file
    cat > "${CONFIG_DIR}/config" << EOF
# ZedOps Agent Configuration
MANAGER_URL=${MANAGER_URL}
AGENT_NAME=${AGENT_NAME}
EOF

    log_info "Configuration saved to ${CONFIG_DIR}/config"

    # Clean up stale legacy tokens (old install script saved to ~/.zedops-agent/)
    LEGACY_TOKEN="/root/.zedops-agent/token"
    if [ -f "$LEGACY_TOKEN" ]; then
        log_warn "Removing stale legacy token at $LEGACY_TOKEN"
        rm -f "$LEGACY_TOKEN"
        # Remove legacy dir if empty
        rmdir /root/.zedops-agent 2>/dev/null || true
    fi

    # Check if agent is already registered (permanent token exists)
    if [ -f "/var/lib/zedops-agent/token" ]; then
        log_warn "Agent is already registered (permanent token exists at /var/lib/zedops-agent/token)"
        log_warn "Skipping ephemeral token save — the existing registration will be used"
        if [ -n "$TOKEN" ]; then
            log_warn "The --token flag was provided but will be ignored (agent already registered)"
        fi
        return
    fi

    # Handle token if provided (save as ephemeral — agent will exchange for permanent on registration)
    if [ -n "$TOKEN" ]; then
        # Validate token against manager before saving
        validate_token

        mkdir -p /var/lib/zedops-agent
        chmod 700 /var/lib/zedops-agent
        printf '%s' "$TOKEN" > /var/lib/zedops-agent/ephemeral-token
        chmod 600 /var/lib/zedops-agent/ephemeral-token
        log_info "Ephemeral token saved to /var/lib/zedops-agent/ephemeral-token"
    fi
}

install_service() {
    log_info "Installing systemd service..."

    # Create service file (variables expand during install)
    cat > "$SERVICE_FILE" << EOF
[Unit]
Description=ZedOps Agent - Server Management Agent
Documentation=https://github.com/lasmarois/zedops
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=simple
ExecStart=/usr/local/bin/zedops-agent --manager-url ${MANAGER_URL} --name ${AGENT_NAME}
Restart=on-failure
RestartSec=10
TimeoutStopSec=30

# Exit code 78 = auth failure (invalid token, agent deleted, etc.)
# Don't restart on auth failures - manual intervention required
RestartPreventExitStatus=78

# Run as root for Docker socket access
User=root
Group=root

# State files stored in /var/lib/zedops-agent/
Environment=HOME=/root

# Logging via journald
StandardOutput=journal
StandardError=journal
SyslogIdentifier=zedops-agent

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd
    systemctl daemon-reload

    # Enable service
    systemctl enable zedops-agent

    log_info "Service installed and enabled"
}

start_service() {
    log_info "Starting service..."

    systemctl start zedops-agent

    # Wait a moment for startup
    sleep 2

    if systemctl is-active --quiet zedops-agent; then
        log_info "Service started successfully"
    else
        log_warn "Service may have failed to start. Check logs with: journalctl -u zedops-agent -f"
    fi
}

print_summary() {
    echo ""
    echo "========================================"
    echo -e "${GREEN}ZedOps Agent Installation Complete!${NC}"
    echo "========================================"
    echo ""
    echo "Binary:  ${INSTALL_DIR}/zedops-agent"
    echo "Config:  ${CONFIG_DIR}/config"
    echo "Service: zedops-agent.service"
    echo ""
    echo "Useful commands:"
    echo "  sudo systemctl status zedops-agent    # Check status"
    echo "  sudo systemctl restart zedops-agent   # Restart"
    echo "  sudo journalctl -u zedops-agent -f    # View logs"
    echo ""

    if [ -z "$TOKEN" ]; then
        echo -e "${YELLOW}Note: No registration token was provided.${NC}"
        echo "If this is a new agent, you'll need to register it with the manager."
        echo ""
    fi
}

# Main installation flow
main() {
    echo ""
    echo "========================================"
    echo "  ZedOps Agent Installer"
    echo "========================================"
    echo ""

    check_root
    detect_platform
    get_latest_version
    download_binary
    install_binary
    setup_config
    install_service
    start_service
    print_summary
}

main
