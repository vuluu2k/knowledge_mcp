#!/bin/bash
set -e

# ─── Colors ─────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

REPO_URL="https://github.com/webcake-tech/knowledge_mcp.git"
INSTALL_DIR="$HOME/knowledge_mcp"

echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Knowledge MCP Server — Quick Install   ║${NC}"
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

# ─── Check git ──────────────────────────────────────────────
if ! command -v git &> /dev/null; then
    echo -e "${RED}✗ git not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ git$(git --version | sed 's/git version/ /')${NC}"

# ─── Clone or update ───────────────────────────────────────
echo ""
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}Directory exists: $INSTALL_DIR${NC}"
    echo -e "${YELLOW}Pulling latest...${NC}"
    cd "$INSTALL_DIR"
    git pull --ff-only
else
    echo -e "${YELLOW}Cloning to $INSTALL_DIR...${NC}"
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi
echo -e "${GREEN}✓ Source ready${NC}"

# ─── Install + Build ───────────────────────────────────────
echo ""
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install --silent
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo ""
echo -e "${YELLOW}Building...${NC}"
npm run build --silent
echo -e "${GREEN}✓ Build complete${NC}"

# ─── Setup .env ─────────────────────────────────────────────
echo ""
if [ -f .env ]; then
    echo -e "${GREEN}✓ .env already exists${NC}"
    source .env 2>/dev/null || true
    ENV_TOKEN="$GITHUB_TOKEN"
    ENV_OWNER="$GITHUB_OWNER"
    ENV_REPO="${GITHUB_REPO:-brain}"
else
    cp .env.example .env
    echo -e "${YELLOW}Configure GitHub connection:${NC}"
    echo ""
    echo -e "  ${CYAN}GITHUB_TOKEN${NC}  — https://github.com/settings/tokens (repo scope)"
    echo -e "  ${CYAN}GITHUB_OWNER${NC}  — Your GitHub username"
    echo -e "  ${CYAN}GITHUB_REPO${NC}   — Repository name (e.g. brain)"
    echo ""

    read -rp "  GITHUB_TOKEN: " ENV_TOKEN
    read -rp "  GITHUB_OWNER: " ENV_OWNER
    read -rp "  GITHUB_REPO (brain): " ENV_REPO
    ENV_REPO=${ENV_REPO:-brain}

    if [ -n "$ENV_TOKEN" ] && [ -n "$ENV_OWNER" ]; then
        sed -i.bak "s|ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx|$ENV_TOKEN|" .env
        sed -i.bak "s|yourusername|$ENV_OWNER|" .env
        sed -i.bak "s|GITHUB_REPO=brain|GITHUB_REPO=$ENV_REPO|" .env
        rm -f .env.bak
        echo ""
        echo -e "${GREEN}✓ .env configured${NC}"
    else
        echo ""
        echo -e "${YELLOW}⚠ Skipped — edit .env manually later${NC}"
        ENV_TOKEN="ghp_..."
        ENV_OWNER="yourusername"
        ENV_REPO="brain"
    fi
fi

# ─── Select platform ──────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Installation complete!                 ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Server path:${NC} $INSTALL_DIR/dist/index.js"
echo ""
echo -e "${BOLD}Select your AI platform:${NC}"
echo ""
echo "  1) Claude Desktop"
echo "  2) Claude Code (CLI)"
echo "  3) Cursor"
echo "  4) VS Code (Copilot / Roo Code / Continue)"
echo "  5) Windsurf"
echo "  6) OpenAI Codex CLI"
echo "  7) Antigravity"
echo "  8) Other / Show all"
echo ""
read -rp "  Enter number (1-8): " PLATFORM

# ─── Config generators ────────────────────────────────────

mcp_json() {
    cat <<EOF
{
  "mcpServers": {
    "knowledge-brain": {
      "command": "node",
      "args": ["$INSTALL_DIR/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "$ENV_TOKEN",
        "GITHUB_OWNER": "$ENV_OWNER",
        "GITHUB_REPO": "$ENV_REPO"
      }
    }
  }
}
EOF
}

vscode_json() {
    cat <<EOF
{
  "servers": {
    "knowledge-brain": {
      "command": "node",
      "args": ["$INSTALL_DIR/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "$ENV_TOKEN",
        "GITHUB_OWNER": "$ENV_OWNER",
        "GITHUB_REPO": "$ENV_REPO"
      }
    }
  }
}
EOF
}

write_config() {
    local FILE="$1"
    local CONTENT="$2"
    if [ -f "$FILE" ]; then
        echo -e "${YELLOW}  ⚠ $FILE already exists.${NC}"
        echo -e "  Merge this config manually:"
        echo ""
        echo "$CONTENT"
    else
        mkdir -p "$(dirname "$FILE")"
        echo "$CONTENT" > "$FILE"
        echo -e "${GREEN}  ✓ Written to $FILE${NC}"
    fi
}

echo ""

case "$PLATFORM" in
    1)
        echo -e "${CYAN}── Claude Desktop ──${NC}"
        if [ "$(uname)" = "Darwin" ]; then
            CONFIG_FILE="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
        else
            CONFIG_FILE="${APPDATA:-$HOME/.config}/Claude/claude_desktop_config.json"
        fi
        echo -e "  Config file: ${BOLD}$CONFIG_FILE${NC}"
        echo ""
        echo -e "${YELLOW}  Write config automatically? (y/n)${NC}"
        read -r AUTO_WRITE
        if [ "$AUTO_WRITE" = "y" ] || [ "$AUTO_WRITE" = "Y" ]; then
            write_config "$CONFIG_FILE" "$(mcp_json)"
        else
            echo ""
            mcp_json
        fi
        echo ""
        echo -e "${YELLOW}  Restart Claude Desktop to load the server.${NC}"
        ;;
    2)
        echo -e "${CYAN}── Claude Code ──${NC}"
        echo ""
        echo "  Run this command:"
        echo ""
        echo -e "  ${GREEN}claude mcp add knowledge-brain -- node $INSTALL_DIR/dist/index.js${NC}"
        ;;
    3)
        echo -e "${CYAN}── Cursor ──${NC}"
        echo ""
        echo "  Settings → MCP Servers → Add new → paste:"
        echo ""
        mcp_json
        echo ""
        echo -e "  Or write to ${BOLD}~/.cursor/mcp.json${NC}:"
        echo -e "${YELLOW}  Write config automatically? (y/n)${NC}"
        read -r AUTO_WRITE
        if [ "$AUTO_WRITE" = "y" ] || [ "$AUTO_WRITE" = "Y" ]; then
            write_config "$HOME/.cursor/mcp.json" "$(mcp_json)"
        fi
        ;;
    4)
        echo -e "${CYAN}── VS Code ──${NC}"
        echo ""
        echo -e "  Add to ${BOLD}.vscode/mcp.json${NC} in your project:"
        echo ""
        vscode_json
        echo ""
        echo -e "${YELLOW}  Write to current project? (y/n)${NC}"
        read -r AUTO_WRITE
        if [ "$AUTO_WRITE" = "y" ] || [ "$AUTO_WRITE" = "Y" ]; then
            write_config ".vscode/mcp.json" "$(vscode_json)"
        fi
        ;;
    5)
        echo -e "${CYAN}── Windsurf ──${NC}"
        CONFIG_FILE="$HOME/.codeium/windsurf/mcp_config.json"
        echo -e "  Config file: ${BOLD}$CONFIG_FILE${NC}"
        echo ""
        echo -e "${YELLOW}  Write config automatically? (y/n)${NC}"
        read -r AUTO_WRITE
        if [ "$AUTO_WRITE" = "y" ] || [ "$AUTO_WRITE" = "Y" ]; then
            write_config "$CONFIG_FILE" "$(mcp_json)"
        else
            echo ""
            mcp_json
        fi
        ;;
    6)
        echo -e "${CYAN}── OpenAI Codex CLI ──${NC}"
        CONFIG_FILE="$HOME/.codex/config.json"
        echo -e "  Config file: ${BOLD}$CONFIG_FILE${NC}"
        echo ""
        echo -e "${YELLOW}  Write config automatically? (y/n)${NC}"
        read -r AUTO_WRITE
        if [ "$AUTO_WRITE" = "y" ] || [ "$AUTO_WRITE" = "Y" ]; then
            write_config "$CONFIG_FILE" "$(mcp_json)"
        else
            echo ""
            mcp_json
        fi
        ;;
    7)
        echo -e "${CYAN}── Antigravity ──${NC}"
        echo ""
        echo "  Project settings → Integrations → MCP → Add server → paste:"
        echo ""
        mcp_json
        ;;
    8|*)
        echo -e "${CYAN}── Universal MCP config ──${NC}"
        echo ""
        echo -e "  ${BOLD}Command:${NC}  node"
        echo -e "  ${BOLD}Args:${NC}     $INSTALL_DIR/dist/index.js"
        echo -e "  ${BOLD}Env:${NC}      GITHUB_TOKEN=$ENV_TOKEN"
        echo "            GITHUB_OWNER=$ENV_OWNER"
        echo "            GITHUB_REPO=$ENV_REPO"
        echo ""
        echo -e "  ${BOLD}JSON (mcpServers):${NC}"
        echo ""
        mcp_json
        echo ""
        echo -e "  ${BOLD}JSON (VS Code):${NC}"
        echo ""
        vscode_json
        ;;
esac

echo ""
echo -e "${CYAN}── Next step ──${NC}"
echo -e "  Tell your AI: ${GREEN}\"Khởi tạo brain cho tôi\"${NC}"
echo ""
