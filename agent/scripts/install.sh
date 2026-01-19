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
        darwin)
            OS="darwin"
            ;;
        *)
            log_error "Unsupported operating system: $OS"
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

    # Handle token if provided
    if [ -n "$TOKEN" ]; then
        mkdir -p /root/.zedops-agent
        echo "$TOKEN" > /root/.zedops-agent/token
        chmod 600 /root/.zedops-agent/token
        log_info "Token saved to /root/.zedops-agent/token"
    fi
}

install_service() {
    log_info "Installing systemd service..."

    # Create service file
    cat > "$SERVICE_FILE" << 'EOF'
[Unit]
Description=ZedOps Agent - Server Management Agent
Documentation=https://github.com/lasmarois/zedops
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=simple
ExecStart=/usr/local/bin/zedops-agent --manager-url ${MANAGER_URL} --name ${AGENT_NAME}
Restart=always
RestartSec=10
TimeoutStopSec=30

User=root
Group=root

Environment=HOME=/root
EnvironmentFile=-/etc/zedops-agent/config

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
