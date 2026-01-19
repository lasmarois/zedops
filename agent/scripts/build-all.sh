#!/usr/bin/env bash
set -e

# ZedOps Agent Cross-Platform Build Script
# Builds agent binary for all supported platforms

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BIN_DIR="$AGENT_DIR/bin"
VERSION="${VERSION:-dev}"

# Build targets
PLATFORMS=(
    "linux/amd64"
    "linux/arm64"
    "darwin/amd64"
    "darwin/arm64"
    "windows/amd64"
)

echo "==> Building ZedOps Agent v${VERSION}"
echo "Agent directory: $AGENT_DIR"
echo "Output directory: $BIN_DIR"
echo ""

# Create bin directory
mkdir -p "$BIN_DIR"

# Change to agent directory
cd "$AGENT_DIR"

# Ensure dependencies are up to date
echo "==> Updating dependencies..."
go mod tidy
go mod download

# Build for each platform
for PLATFORM in "${PLATFORMS[@]}"; do
    GOOS="${PLATFORM%/*}"
    GOARCH="${PLATFORM#*/}"

    OUTPUT="zedops-agent-${GOOS}-${GOARCH}"
    if [ "$GOOS" = "windows" ]; then
        OUTPUT="${OUTPUT}.exe"
    fi

    echo "==> Building for ${GOOS}/${GOARCH}..."

    CGO_ENABLED=0 GOOS="$GOOS" GOARCH="$GOARCH" go build \
        -ldflags="-w -s -X main.Version=${VERSION}" \
        -o "$BIN_DIR/$OUTPUT" \
        .

    echo "    Created: $BIN_DIR/$OUTPUT"
done

echo ""
echo "✅ Build complete! Binaries:"
ls -lh "$BIN_DIR"/zedops-agent-*

echo ""
echo "To create a release, tag and push:"
echo "  git tag agent-v${VERSION}"
echo "  git push origin agent-v${VERSION}"
