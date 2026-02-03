#!/bin/bash
# =============================================================================
# GodMode - Unix Setup Script (Bash)
# =============================================================================
# Run this script to set up the project on Linux/macOS
# Usage: ./scripts/setup.sh
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Flags
SKIP_NODE_MODULES=false
SKIP_OLLAMA=false
FORCE=false

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --skip-node-modules) SKIP_NODE_MODULES=true ;;
        --skip-ollama) SKIP_OLLAMA=true ;;
        --force) FORCE=true ;;
        -h|--help) 
            echo "Usage: ./scripts/setup.sh [options]"
            echo "Options:"
            echo "  --skip-node-modules  Skip npm install"
            echo "  --skip-ollama        Skip Ollama check"
            echo "  --force              Force reinstall dependencies"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
    shift
done

echo ""
echo -e "${CYAN}========================================"
echo "  GodMode - Setup Script"
echo -e "========================================${NC}"
echo ""

# -----------------------------------------------------------------------------
# Check Prerequisites
# -----------------------------------------------------------------------------

echo -e "${YELLOW}[1/6] Checking prerequisites...${NC}"

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    VERSION_NUMBER=$(echo $NODE_VERSION | sed 's/v\([0-9]*\).*/\1/')
    if [ "$VERSION_NUMBER" -ge 18 ]; then
        echo -e "  ${GREEN}[OK]${NC} Node.js $NODE_VERSION"
    else
        echo -e "  ${YELLOW}[WARN]${NC} Node.js $NODE_VERSION found, but v18+ recommended"
    fi
else
    echo -e "  ${RED}[ERROR]${NC} Node.js not found. Please install from https://nodejs.org"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "  ${GREEN}[OK]${NC} npm v$NPM_VERSION"
else
    echo -e "  ${RED}[ERROR]${NC} npm not found"
    exit 1
fi

# Check Git (optional)
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version)
    echo -e "  ${GREEN}[OK]${NC} $GIT_VERSION"
else
    echo -e "  ${GRAY}[INFO]${NC} Git not found (optional)"
fi

# Check Docker (optional)
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo -e "  ${GREEN}[OK]${NC} $DOCKER_VERSION"
else
    echo -e "  ${GRAY}[INFO]${NC} Docker not found (optional, for containerized services)"
fi

# Check Ollama (optional)
if [ "$SKIP_OLLAMA" = false ]; then
    if command -v ollama &> /dev/null; then
        echo -e "  ${GREEN}[OK]${NC} Ollama installed"
    else
        echo -e "  ${YELLOW}[INFO]${NC} Ollama not found - Install from https://ollama.ai for local AI"
    fi
fi

# -----------------------------------------------------------------------------
# Install Dependencies
# -----------------------------------------------------------------------------

echo ""
echo -e "${YELLOW}[2/6] Installing Node.js dependencies...${NC}"

if [ "$SKIP_NODE_MODULES" = false ] || [ "$FORCE" = true ]; then
    if [ -d "node_modules" ]; then
        if [ "$FORCE" = true ]; then
            echo -e "  ${GRAY}Removing existing node_modules...${NC}"
            rm -rf node_modules
        else
            echo -e "  ${GREEN}[OK]${NC} node_modules exists (use --force to reinstall)"
        fi
    fi
    
    if [ ! -d "node_modules" ]; then
        npm install
        echo -e "  ${GREEN}[OK]${NC} Dependencies installed"
    fi
else
    echo -e "  ${GRAY}[SKIP]${NC} Skipping npm install"
fi

# -----------------------------------------------------------------------------
# Setup Environment File
# -----------------------------------------------------------------------------

echo ""
echo -e "${YELLOW}[3/6] Setting up environment...${NC}"

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "  ${GREEN}[OK]${NC} Created .env from .env.example"
        echo -e "  ${YELLOW}[ACTION]${NC} Edit .env to add your API keys"
    else
        echo -e "  ${YELLOW}[WARN]${NC} .env.example not found"
    fi
else
    echo -e "  ${GREEN}[OK]${NC} .env already exists"
fi

# Also check src/.env for legacy support
if [ ! -f "src/.env" ] && [ -f ".env" ]; then
    cp .env src/.env
    echo -e "  ${GREEN}[OK]${NC} Copied .env to src/.env for compatibility"
fi

# -----------------------------------------------------------------------------
# Create Data Directories
# -----------------------------------------------------------------------------

echo ""
echo -e "${YELLOW}[4/6] Creating data directories...${NC}"

DIRECTORIES=("data" "data/projects" "temp")

for dir in "${DIRECTORIES[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        echo -e "  ${GREEN}[OK]${NC} Created $dir"
    else
        echo -e "  ${GREEN}[OK]${NC} $dir exists"
    fi
done

# -----------------------------------------------------------------------------
# Build Frontend
# -----------------------------------------------------------------------------

echo ""
echo -e "${YELLOW}[5/6] Building frontend...${NC}"

if npm run build:frontend; then
    echo -e "  ${GREEN}[OK]${NC} Frontend built successfully"
else
    echo -e "  ${YELLOW}[WARN]${NC} Frontend build failed - app may still work in dev mode"
fi

# -----------------------------------------------------------------------------
# Verify Installation
# -----------------------------------------------------------------------------

echo ""
echo -e "${YELLOW}[6/6] Verifying installation...${NC}"

ALL_OK=true

check_file() {
    if [ -e "$1" ]; then
        echo -e "  ${GREEN}[OK]${NC} $2"
    else
        echo -e "  ${RED}[FAIL]${NC} $2 missing ($1)"
        ALL_OK=false
    fi
}

check_file "package.json" "Project manifest"
check_file "node_modules" "Dependencies"
check_file ".env" "Environment config"
check_file "src/server.js" "Server entry point"

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------

echo ""
echo -e "${CYAN}========================================"
echo "  Setup Complete!"
echo -e "========================================${NC}"
echo ""

if [ "$ALL_OK" = true ]; then
    echo -e "Next steps:"
    echo ""
    echo -e "  ${GRAY}1. Edit .env to add your API keys (optional for Ollama-only use)${NC}"
    echo -e "  ${GRAY}2. Install Ollama from https://ollama.ai (if not installed)${NC}"
    echo -e "  ${GRAY}3. Pull AI models:${NC}"
    echo -e "       ${CYAN}ollama pull qwen3:14b${NC}"
    echo -e "       ${CYAN}ollama pull snowflake-arctic-embed:l${NC}"
    echo ""
    echo -e "  ${GRAY}4. Start the application:${NC}"
    echo -e "       ${CYAN}npm start${NC}"
    echo ""
    echo -e "  ${GRAY}5. Open in browser:${NC}"
    echo -e "       ${CYAN}http://localhost:3005${NC}"
    echo ""
else
    echo -e "${YELLOW}[WARN]${NC} Some checks failed. Please review the errors above."
fi
