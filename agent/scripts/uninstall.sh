#!/usr/bin/env bash
set -e

# ZedOps Agent Uninstallation Script
# Usage: sudo ./uninstall.sh [--purge]
#
# Options:
#   --purge    Remove configuration and token files too

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

INSTALL_DIR="/usr/local/bin"
CONFIG_DIR="/etc/zedops-agent"
SERVICE_FILE="/etc/systemd/system/zedops-agent.service"
TOKEN_DIR="/root/.zedops-agent"

PURGE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --purge)
            PURGE=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}[ERROR]${NC} Please run as root (sudo)"
        exit 1
    fi
}

main() {
    echo ""
    echo "========================================"
    echo "  ZedOps Agent Uninstaller"
    echo "========================================"
    echo ""

    check_root

    # Stop and disable service
    if systemctl is-active --quiet zedops-agent 2>/dev/null; then
        log_info "Stopping service..."
        systemctl stop zedops-agent
    fi

    if systemctl is-enabled --quiet zedops-agent 2>/dev/null; then
        log_info "Disabling service..."
        systemctl disable zedops-agent
    fi

    # Remove service file
    if [ -f "$SERVICE_FILE" ]; then
        log_info "Removing service file..."
        rm -f "$SERVICE_FILE"
        systemctl daemon-reload
    fi

    # Remove binary
    if [ -f "${INSTALL_DIR}/zedops-agent" ]; then
        log_info "Removing binary..."
        rm -f "${INSTALL_DIR}/zedops-agent"
    fi

    # Remove config and token if purge
    if [ "$PURGE" = true ]; then
        if [ -d "$CONFIG_DIR" ]; then
            log_info "Removing configuration..."
            rm -rf "$CONFIG_DIR"
        fi

        if [ -d "$TOKEN_DIR" ]; then
            log_info "Removing token..."
            rm -rf "$TOKEN_DIR"
        fi
    else
        log_warn "Configuration and token preserved. Use --purge to remove."
    fi

    echo ""
    echo "========================================"
    echo -e "${GREEN}ZedOps Agent Uninstalled${NC}"
    echo "========================================"
    echo ""

    if [ "$PURGE" != true ]; then
        echo "Preserved files:"
        [ -d "$CONFIG_DIR" ] && echo "  - $CONFIG_DIR"
        [ -d "$TOKEN_DIR" ] && echo "  - $TOKEN_DIR"
        echo ""
    fi
}

main
