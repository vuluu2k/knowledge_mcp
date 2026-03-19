#!/bin/bash
set -e

# ─── Colors ─────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Knowledge MCP Server — Installer       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ─── Check Node.js ──────────────────────────────────────────
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found. Please install Node.js >= 18${NC}"
    echo "  https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}✗ Node.js >= 18 required. Found: $(node -v)${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# ─── Check npm ──────────────────────────────────────────────
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm $(npm -v)${NC}"

# ─── Install dependencies ──────────────────────────────────
echo ""
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install --silent
echo -e "${GREEN}✓ Dependencies installed${NC}"

# ─── Build ──────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}Building TypeScript...${NC}"
npm run build --silent
echo -e "${GREEN}✓ Build complete${NC}"

# ─── Setup .env ─────────────────────────────────────────────
echo ""
if [ -f .env ]; then
    echo -e "${GREEN}✓ .env already exists${NC}"
else
    cp .env.example .env
    echo -e "${YELLOW}Created .env from .env.example${NC}"
    echo ""
    echo -e "${CYAN}Please edit .env with your settings:${NC}"
    echo ""
    echo "  GITHUB_TOKEN  — GitHub Personal Access Token (repo scope)"
    echo "                   Get one at: https://github.com/settings/tokens"
    echo "  GITHUB_OWNER  — Your GitHub username"
    echo "  GITHUB_REPO   — Repository name (e.g. brain)"
    echo ""
    echo -e "${YELLOW}Edit now? (y/n)${NC}"
    read -r EDIT_ENV
    if [ "$EDIT_ENV" = "y" ] || [ "$EDIT_ENV" = "Y" ]; then
        if command -v nano &> /dev/null; then
            nano .env
        elif command -v vim &> /dev/null; then
            vim .env
        else
            echo "Please edit .env manually with your text editor"
        fi
    fi
fi

# ─── Verify .env ───────────────────────────────────────────
echo ""
source .env 2>/dev/null || true
if [ -z "$GITHUB_TOKEN" ] || [ "$GITHUB_TOKEN" = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" ]; then
    echo -e "${YELLOW}⚠ GITHUB_TOKEN not configured yet. Edit .env before using.${NC}"
else
    echo -e "${GREEN}✓ .env configured${NC}"
fi

# ─── Print setup info ──────────────────────────────────────
INSTALL_DIR=$(pwd)

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Installation complete!                 ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Server path:${NC}"
echo "  $INSTALL_DIR/dist/index.js"
echo ""
echo -e "${CYAN}Claude Desktop — add to claude_desktop_config.json:${NC}"
echo ""
echo '  {'
echo '    "mcpServers": {'
echo '      "knowledge-brain": {'
echo '        "command": "node",'
echo "        \"args\": [\"$INSTALL_DIR/dist/index.js\"],"
echo '        "env": {'
echo '          "GITHUB_TOKEN": "your-token",'
echo '          "GITHUB_OWNER": "your-username",'
echo '          "GITHUB_REPO": "brain"'
echo '        }'
echo '      }'
echo '    }'
echo '  }'
echo ""
echo -e "${CYAN}Claude Code:${NC}"
echo "  claude mcp add knowledge-brain -- node $INSTALL_DIR/dist/index.js"
echo ""
echo -e "${CYAN}Then tell Claude:${NC} \"Khởi tạo brain cho tôi\""
echo ""
