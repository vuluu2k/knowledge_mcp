#!/bin/bash
set -e

# ─── Colors ─────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Knowledge MCP Server — Update          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ─── Check git ──────────────────────────────────────────────
if ! command -v git &> /dev/null; then
    echo -e "${RED}✗ git not found${NC}"
    exit 1
fi

# ─── Save current version ──────────────────────────────────
OLD_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo -e "${YELLOW}Current: ${OLD_HASH}${NC}"

# ─── Pull latest ───────────────────────────────────────────
echo ""
echo -e "${YELLOW}Pulling latest changes...${NC}"
git pull --ff-only
NEW_HASH=$(git rev-parse --short HEAD)

if [ "$OLD_HASH" = "$NEW_HASH" ]; then
    echo -e "${GREEN}✓ Already up to date (${NEW_HASH})${NC}"
else
    echo -e "${GREEN}✓ Updated: ${OLD_HASH} → ${NEW_HASH}${NC}"
    echo ""

    # Show what changed
    echo -e "${CYAN}Changes:${NC}"
    git log --oneline "${OLD_HASH}..${NEW_HASH}" 2>/dev/null | head -10
    echo ""
fi

# ─── Install dependencies ──────────────────────────────────
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install --silent
echo -e "${GREEN}✓ Dependencies installed${NC}"

# ─── Rebuild ───────────────────────────────────────────────
echo ""
echo -e "${YELLOW}Building TypeScript...${NC}"
rm -rf dist
npm run build --silent
echo -e "${GREEN}✓ Build complete${NC}"

# ─── Check .env for new variables ──────────────────────────
echo ""
if [ -f .env ] && [ -f .env.example ]; then
    MISSING=""
    while IFS= read -r line; do
        KEY=$(echo "$line" | grep -oP '^\w+' 2>/dev/null || echo "$line" | sed -n 's/^\([A-Z_]*\)=.*/\1/p')
        if [ -n "$KEY" ] && ! grep -q "^$KEY=" .env 2>/dev/null; then
            MISSING="$MISSING  $KEY\n"
        fi
    done < <(grep -E '^[A-Z]' .env.example)

    if [ -n "$MISSING" ]; then
        echo -e "${YELLOW}⚠ New env variables found in .env.example:${NC}"
        echo -e "$MISSING"
        echo -e "  Add them to your .env file"
    else
        echo -e "${GREEN}✓ .env is up to date${NC}"
    fi
else
    echo -e "${GREEN}✓ .env check skipped${NC}"
fi

# ─── Done ──────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Update complete!                       ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Restart Claude Desktop to load the updated server.${NC}"
echo ""
