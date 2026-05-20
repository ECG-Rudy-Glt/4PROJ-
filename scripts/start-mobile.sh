#!/bin/bash
# =============================================================================
# SUPFILE Mobile - Expo Development Script (Unix/Linux/macOS)
# =============================================================================
# Usage:
#   ./start-mobile.sh              Start Expo dev server
#   ./start-mobile.sh --android    Run on Android
#   ./start-mobile.sh --ios        Run on iOS simulator
#   ./start-mobile.sh --web        Run in web browser
#   ./start-mobile.sh --install-only  Install dependencies only
#   ./start-mobile.sh --clean      Clean cache and reinstall
#   ./start-mobile.sh --tunnel     Start with tunnel mode
# =============================================================================

set -euo pipefail

# Navigate to project root
cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"
MOBILE_DIR="$PROJECT_ROOT/mobile"

# Parse arguments
PLATFORM="default"
INSTALL_ONLY=false
CLEAN=false
TUNNEL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --android)
            PLATFORM="android"
            shift
            ;;
        --ios)
            PLATFORM="ios"
            shift
            ;;
        --web)
            PLATFORM="web"
            shift
            ;;
        --install-only)
            INSTALL_ONLY=true
            shift
            ;;
        --clean)
            CLEAN=true
            shift
            ;;
        --tunnel)
            TUNNEL=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo ""
echo "========================================="
echo "  SUPFILE Mobile - Expo Development"
echo "========================================="
echo ""

# -----------------------------------------------------------------------------
# Prerequisites Check
# -----------------------------------------------------------------------------
check_prerequisites() {
    echo "Checking prerequisites..."

    # Check Node.js
    if ! command -v node > /dev/null 2>&1; then
        echo ""
        echo "ERROR: Node.js is not installed!"
        echo ""
        echo "Please install Node.js from: https://nodejs.org/"
        echo "Or use a version manager like nvm:"
        echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
        echo "  nvm install --lts"
        echo ""
        exit 1
    fi
    NODE_VERSION=$(node --version)
    echo "  Node.js: $NODE_VERSION"

    # Check npm
    if ! command -v npm > /dev/null 2>&1; then
        echo ""
        echo "ERROR: npm is not installed!"
        exit 1
    fi
    NPM_VERSION=$(npm --version)
    echo "  npm: v$NPM_VERSION"

    # Check if mobile directory exists
    if [ ! -d "$MOBILE_DIR" ]; then
        echo ""
        echo "ERROR: Mobile directory not found at $MOBILE_DIR"
        exit 1
    fi
    echo "  Mobile directory: OK"
    echo ""
}

# -----------------------------------------------------------------------------
# IP Detection
# -----------------------------------------------------------------------------
detect_ip() {
    local ip=""

    # macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        ip=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)
    # Linux
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command -v hostname > /dev/null 2>&1; then
            ip=$(hostname -I 2>/dev/null | awk '{print $1}')
        fi
        if [ -z "$ip" ] && command -v ip > /dev/null 2>&1; then
            ip=$(ip route get 1 2>/dev/null | awk '{print $7}' | head -n 1)
        fi
    # WSL or Git Bash on Windows
    else
        ip=$(ipconfig.exe 2>/dev/null | grep -i "IPv4" | head -n 1 | awk '{print $NF}' | tr -d '\r')
    fi

    echo "$ip"
}

# -----------------------------------------------------------------------------
# Environment Setup
# -----------------------------------------------------------------------------
setup_mobile_env() {
    local ip="$1"
    local env_file="$MOBILE_DIR/.env"
    local env_example="$MOBILE_DIR/.env.example"

    # Create .env if it doesn't exist
    if [ ! -f "$env_file" ]; then
        if [ -f "$env_example" ]; then
            cp "$env_example" "$env_file"
            echo "Created mobile/.env from .env.example"
        else
            touch "$env_file"
        fi
    fi

    # Update EXPO_PUBLIC_API_URL
    local api_url="http://${ip}:5001/api"

    if grep -q "EXPO_PUBLIC_API_URL=" "$env_file"; then
        sed -i.bak "s|EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=$api_url|" "$env_file"
        rm -f "$env_file.bak"
    else
        echo "EXPO_PUBLIC_API_URL=$api_url" >> "$env_file"
    fi

    echo "Updated mobile/.env with API URL: $api_url"
}

# -----------------------------------------------------------------------------
# Dependency Installation
# -----------------------------------------------------------------------------
install_dependencies() {
    local force="${1:-false}"
    local node_modules="$MOBILE_DIR/node_modules"
    local package_json="$MOBILE_DIR/package.json"

    local needs_install=false

    if [ "$force" = true ] || [ ! -d "$node_modules" ]; then
        needs_install=true
    elif [ -f "$package_json" ] && [ -d "$node_modules" ]; then
        # Check if package.json is newer than node_modules
        if [ "$package_json" -nt "$node_modules" ]; then
            needs_install=true
            echo "package.json has changed, reinstalling dependencies..."
        fi
    fi

    if [ "$needs_install" = true ]; then
        echo "Installing mobile dependencies..."
        echo "This may take a few minutes on first install."
        echo ""

        cd "$MOBILE_DIR"
        npm install
        cd "$PROJECT_ROOT"

        echo ""
        echo "Dependencies installed successfully!"
    else
        echo "Dependencies already installed."
    fi
}

# -----------------------------------------------------------------------------
# Clean Cache
# -----------------------------------------------------------------------------
clean_cache() {
    echo "Cleaning mobile cache..."

    # Remove node_modules
    if [ -d "$MOBILE_DIR/node_modules" ]; then
        echo "  Removing node_modules..."
        rm -rf "$MOBILE_DIR/node_modules"
    fi

    # Remove .expo
    if [ -d "$MOBILE_DIR/.expo" ]; then
        echo "  Removing .expo cache..."
        rm -rf "$MOBILE_DIR/.expo"
    fi

    # Clear npm cache
    echo "  Clearing npm cache..."
    npm cache clean --force 2>/dev/null || true

    echo "Cache cleared!"
    echo ""
}

# -----------------------------------------------------------------------------
# Start Expo
# -----------------------------------------------------------------------------
start_expo() {
    local ip="$1"
    local platform="$2"
    local use_tunnel="$3"

    cd "$MOBILE_DIR"

    # Set environment variable for React Native packager
    export REACT_NATIVE_PACKAGER_HOSTNAME="$ip"

    # Build expo command
    local expo_args=("start" "--clear")

    if [ "$use_tunnel" = true ]; then
        expo_args+=("--tunnel")
    fi

    case "$platform" in
        android) expo_args+=("--android") ;;
        ios) expo_args+=("--ios") ;;
        web) expo_args+=("--web") ;;
    esac

    echo ""
    echo "========================================="
    echo "  Starting Expo Development Server"
    echo "========================================="
    echo ""
    echo "  Local IP: $ip"
    echo "  Backend:  http://${ip}:5001"
    if [ "$use_tunnel" = true ]; then
        echo "  Mode:     Tunnel (for external access)"
    fi
    echo ""
    echo "  Press 'a' for Android, 'i' for iOS, 'w' for Web, 'r' to reload"
    echo "  Press 'q' or Ctrl+C to quit"
    echo ""

    # Run Expo
    npx expo "${expo_args[@]}"
}

# =============================================================================
# Main Execution
# =============================================================================

# Check prerequisites
check_prerequisites

# Handle clean mode
if [ "$CLEAN" = true ]; then
    clean_cache
    install_dependencies true
    if [ "$INSTALL_ONLY" = true ]; then
        echo ""
        echo "Mobile dependencies reinstalled successfully!"
        exit 0
    fi
fi

# Detect IP
echo "Detecting local IP address..."
DETECTED_IP=$(detect_ip || true)

if [ -n "$DETECTED_IP" ]; then
    echo "IP detected: $DETECTED_IP"
    echo ""
    read -r -p "Use this IP address? (Y/n): " USE_DETECTED

    if [[ "$USE_DETECTED" =~ ^[Nn]$ ]]; then
        read -r -p "Enter IP address manually: " FINAL_IP
    else
        FINAL_IP="$DETECTED_IP"
    fi
else
    echo "WARNING: Could not auto-detect IP address"
    echo ""
    read -r -p "Enter IP address manually: " FINAL_IP
fi

if [ -z "$FINAL_IP" ]; then
    FINAL_IP="localhost"
fi

echo ""

# Setup environment
setup_mobile_env "$FINAL_IP"

# Install dependencies if needed (unless clean already did it)
if [ "$CLEAN" = false ]; then
    install_dependencies false
fi

# Exit if install-only mode
if [ "$INSTALL_ONLY" = true ]; then
    echo ""
    echo "Mobile dependencies installed successfully!"
    echo ""
    echo "To start the development server, run:"
    echo "  make mobile"
    exit 0
fi

# Start Expo
start_expo "$FINAL_IP" "$PLATFORM" "$TUNNEL"
