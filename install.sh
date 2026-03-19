#!/bin/bash

# ═══════════════════════════════════════════════════════════
#  Knowledge Brain MCP Server - Trình cài đặt tự động
#  Hỗ trợ: Claude Desktop, Claude Code, Cursor, Windsurf, Augment, Codex
#
#  Dùng từ xa (khuyên dùng):
#    curl -fsSL https://raw.githubusercontent.com/vuluu2k/knowledge_mcp/main/install.sh -o install.sh && bash install.sh
#
#  Hoặc:
#    curl -fsSL https://raw.githubusercontent.com/vuluu2k/knowledge_mcp/main/install.sh | bash
#
#  Dùng sau khi clone:
#    ./install.sh
#
#  Gỡ cài đặt:
#    ./install.sh --uninstall
# ═══════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

print_banner() {
  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║${NC}  ${BOLD}Knowledge Brain MCP Server - Cài đặt${NC}            ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}  Biến AI thành trợ lý có trí nhớ vĩnh viễn       ${CYAN}║${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
  echo ""
}

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[CẢNH BÁO]${NC} $1"; }
error()   { echo -e "${RED}[LỖI]${NC} $1"; }

# ═══════════════════════════════════════════════════════════
#  Kiểm tra & cài Node.js
# ═══════════════════════════════════════════════════════════

install_node() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    if command -v brew &> /dev/null; then
      info "Đang cài Node.js qua Homebrew..."
      brew install node@20
      brew link --overwrite node@20 2>/dev/null || brew link --force node@20 2>/dev/null || true
    else
      info "Đang cài Homebrew trước..."
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" < /dev/tty
      if [ -f "/opt/homebrew/bin/brew" ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
      elif [ -f "/usr/local/bin/brew" ]; then
        eval "$(/usr/local/bin/brew shellenv)"
      fi
      brew install node@20
      brew link --overwrite node@20 2>/dev/null || brew link --force node@20 2>/dev/null || true
    fi
  elif command -v apt-get &> /dev/null; then
    info "Đang cài Node.js 20 qua NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  elif command -v yum &> /dev/null; then
    info "Đang cài Node.js 20 qua NodeSource..."
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo yum install -y nodejs
  else
    error "Không thể tự cài Node.js trên hệ điều hành này."
    echo "  Vui lòng cài thủ công: https://nodejs.org/"
    exit 1
  fi

  if ! command -v node &> /dev/null; then
    error "Cài Node.js thất bại."
    echo "  Vui lòng cài thủ công: https://nodejs.org/"
    exit 1
  fi
  success "Đã cài Node.js $(node -v)"
}

check_node() {
  local NEED_INSTALL=false

  if ! command -v node &> /dev/null; then
    warn "Chưa cài Node.js."
    NEED_INSTALL=true
  else
    NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
      warn "Cần Node.js >= 18. Hiện tại: $(node -v)"
      NEED_INSTALL=true
    fi
  fi

  if [ "$NEED_INSTALL" = true ]; then
    echo ""
    read -rp "  Tự động cài Node.js 20 LTS? (C/k): " INSTALL_CONFIRM < /dev/tty
    INSTALL_CONFIRM="${INSTALL_CONFIRM:-C}"
    if [[ "$INSTALL_CONFIRM" =~ ^[CcYy]$ ]]; then
      install_node
    else
      error "Cần Node.js >= 18. Cài xong rồi chạy lại."
      echo "  https://nodejs.org/"
      exit 1
    fi
  fi

  NODE_BIN="$(which node)"
  case "$NODE_BIN" in
    /*) ;;
    *)  NODE_BIN="/usr/local/bin/node" ;;
  esac

  success "Node.js $(node -v) tại ${BOLD}$NODE_BIN${NC}"
}

check_npm() {
  if ! command -v npm &> /dev/null; then
    error "Chưa cài npm."
    exit 1
  fi
  success "npm $(npm -v)"
}

check_git() {
  if ! command -v git &> /dev/null; then
    error "Chưa cài git."
    echo "  macOS:  xcode-select --install"
    echo "  Linux:  sudo apt install git"
    exit 1
  fi
  success "git $(git --version | sed 's/git version //')"
}

# ═══════════════════════════════════════════════════════════
#  Cài MCP Server
# ═══════════════════════════════════════════════════════════

REPO_URL="https://github.com/vuluu2k/knowledge_mcp.git"
DEFAULT_INSTALL_DIR="$HOME/.knowledge-brain-mcp"

detect_mode() {
  # Nếu đang chạy từ trong repo đã clone (có package.json + src/)
  if [ -f "./package.json" ] && [ -d "./src" ] && grep -q "knowledge-mcp" "./package.json" 2>/dev/null; then
    IS_LOCAL=true
    INSTALL_DIR="$(pwd)"
  else
    IS_LOCAL=false
  fi
}

install_mcp() {
  if [ "$IS_LOCAL" = true ]; then
    info "Phát hiện chạy từ repo đã clone: ${BOLD}$INSTALL_DIR${NC}"
  else
    echo ""
    info "Cài MCP server vào đâu?"
    echo -e "  Mặc định: ${BOLD}$DEFAULT_INSTALL_DIR${NC}"
    read -rp "  Đường dẫn (Enter để dùng mặc định): " INSTALL_DIR < /dev/tty
    INSTALL_DIR="${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
    INSTALL_DIR="${INSTALL_DIR/#\~/$HOME}"

    if [ -d "$INSTALL_DIR" ]; then
      if [ -f "$INSTALL_DIR/dist/index.js" ]; then
        # Case 1: Đã cài đầy đủ → hỏi update
        success "MCP server đã có tại $INSTALL_DIR"
        read -rp "  Cập nhật lên bản mới nhất? (c/K): " UPDATE < /dev/tty
        if [[ "$UPDATE" =~ ^[CcYy]$ ]]; then
          info "Đang cập nhật..."
          cd "$INSTALL_DIR"
          git pull origin main 2>/dev/null || git pull 2>/dev/null || warn "Git pull thất bại, dùng bản hiện tại"
          npm install
          npm run build
          success "Cập nhật thành công"
          cd - > /dev/null
          MCP_INDEX="$INSTALL_DIR/dist/index.js"
          return
        fi
      elif [ -d "$INSTALL_DIR/.git" ]; then
        # Case 2: Thư mục là git repo nhưng chưa build (clone cũ lỗi) → pull + rebuild
        warn "Thư mục đã tồn tại nhưng chưa build: $INSTALL_DIR"
        info "Đang pull code mới nhất và build lại..."
        cd "$INSTALL_DIR"
        git fetch origin main 2>/dev/null || true
        git reset --hard origin/main 2>/dev/null || git pull 2>/dev/null || true
        cd - > /dev/null
      else
        # Case 3: Thư mục tồn tại nhưng không phải repo → hỏi xóa
        warn "Thư mục đã tồn tại nhưng không phải git repo: $INSTALL_DIR"
        read -rp "  Xóa và cài lại? (c/K): " REMOVE < /dev/tty
        if [[ "$REMOVE" =~ ^[CcYy]$ ]]; then
          rm -rf "$INSTALL_DIR"
          info "Đang clone repository..."
          git clone "$REPO_URL" "$INSTALL_DIR" < /dev/null
        else
          error "Không thể cài đặt. Xóa thư mục hoặc chọn đường dẫn khác."
          exit 1
        fi
      fi
    else
      info "Đang clone repository..."
      git clone "$REPO_URL" "$INSTALL_DIR" < /dev/null
    fi
  fi

  cd "$INSTALL_DIR"

  # Sửa quyền thư mục project nếu cần
  if [ ! -w "$INSTALL_DIR" ]; then
    warn "Không có quyền ghi vào $INSTALL_DIR, đang sửa quyền..."
    chmod -R u+rwX "$INSTALL_DIR" 2>/dev/null || sudo chown -R "$(whoami)" "$INSTALL_DIR"
  fi

  # Sửa quyền npm cache nếu bị lỗi permission
  NPM_CACHE_DIR="$(npm config get cache 2>/dev/null || echo "$HOME/.npm")"
  if [ -d "$NPM_CACHE_DIR" ] && [ ! -w "$NPM_CACHE_DIR" ]; then
    warn "npm cache bị lỗi quyền, đang sửa..."
    sudo chown -R "$(whoami)" "$NPM_CACHE_DIR"
  fi

  info "Đang cài dependencies..."
  if ! npm install < /dev/null; then
    # Thử lại với cache clean
    warn "npm install thất bại, thử clean cache..."
    npm cache clean --force 2>/dev/null
    sudo chown -R "$(whoami)" "$NPM_CACHE_DIR" 2>/dev/null || true
    if ! npm install < /dev/null; then
      error "npm install thất bại!"
      echo "  Thử chạy thủ công:"
      echo "    sudo chown -R \$(whoami) ~/.npm"
      echo "    cd $INSTALL_DIR && npm install"
      exit 1
    fi
  fi

  info "Đang build TypeScript..."
  if ! npm run build < /dev/null; then
    error "npm run build thất bại!"
    echo "  Thử chạy thủ công: cd $INSTALL_DIR && npm run build"
    exit 1
  fi
  cd - > /dev/null

  success "Đã cài MCP server tại ${BOLD}$INSTALL_DIR${NC}"
  MCP_INDEX="$INSTALL_DIR/dist/index.js"
}

# ═══════════════════════════════════════════════════════════
#  Thu thập biến môi trường
# ═══════════════════════════════════════════════════════════

collect_env() {
  # Nếu đã có .env, đọc từ đó
  if [ -f "$INSTALL_DIR/.env" ]; then
    source "$INSTALL_DIR/.env" 2>/dev/null || true
    if [ -n "$GITHUB_TOKEN" ] && [ "$GITHUB_TOKEN" != "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" ]; then
      ENV_TOKEN="$GITHUB_TOKEN"
      ENV_OWNER="$GITHUB_OWNER"
      ENV_REPO="${GITHUB_REPO:-brain}"
      success ".env đã có cấu hình"
      echo "  Owner : $ENV_OWNER"
      echo "  Repo  : $ENV_REPO"

      read -rp "  Giữ nguyên cấu hình này? (C/k): " KEEP < /dev/tty
      KEEP="${KEEP:-C}"
      if [[ "$KEEP" =~ ^[CcYy]$ ]]; then
        return
      fi
    fi
  fi

  echo ""
  echo -e "${BOLD}── Cấu hình kết nối GitHub ──${NC}"
  echo ""
  echo -e "  ${YELLOW}Cách lấy GitHub Token:${NC}"
  echo "    1. Vào https://github.com/settings/tokens"
  echo "    2. Generate new token (classic)"
  echo "    3. Tick quyền 'repo' (Full control of private repositories)"
  echo "    4. Copy token (ghp_...)"
  echo ""
  echo -e "  ${YELLOW}Chuẩn bị repo:${NC}"
  echo "    Tạo 1 repo rỗng trên GitHub (ví dụ: 'brain')"
  echo ""

  read -rp "  GITHUB_TOKEN (ghp_...): " ENV_TOKEN < /dev/tty
  ENV_TOKEN="${ENV_TOKEN:-}"

  read -rp "  GITHUB_OWNER (username GitHub): " ENV_OWNER < /dev/tty
  ENV_OWNER="${ENV_OWNER:-}"

  read -rp "  GITHUB_REPO [brain]: " ENV_REPO < /dev/tty
  ENV_REPO="${ENV_REPO:-brain}"

  # Ghi .env
  if [ -f "$INSTALL_DIR/.env.example" ]; then
    cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
    if [ -n "$ENV_TOKEN" ]; then
      sed -i.bak "s|ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx|$ENV_TOKEN|" "$INSTALL_DIR/.env"
    fi
    if [ -n "$ENV_OWNER" ]; then
      sed -i.bak "s|yourusername|$ENV_OWNER|" "$INSTALL_DIR/.env"
    fi
    sed -i.bak "s|GITHUB_REPO=brain|GITHUB_REPO=$ENV_REPO|" "$INSTALL_DIR/.env"
    rm -f "$INSTALL_DIR/.env.bak"
  fi

  echo ""
  success "Cấu hình:"
  if [ -n "$ENV_TOKEN" ]; then
    echo "  Token : ${ENV_TOKEN:0:10}..."
  else
    echo -e "  Token : ${YELLOW}(chưa set — sửa .env sau)${NC}"
  fi
  if [ -n "$ENV_OWNER" ]; then
    echo "  Owner : $ENV_OWNER"
  else
    echo -e "  Owner : ${YELLOW}(chưa set — sửa .env sau)${NC}"
  fi
  echo "  Repo  : $ENV_REPO"
}

# ═══════════════════════════════════════════════════════════
#  Cấu hình IDE
# ═══════════════════════════════════════════════════════════

write_mcp_json() {
  local CONFIG_FILE="$1"
  cat > "$CONFIG_FILE" << JSONEOF
{
  "mcpServers": {
    "knowledge-brain": {
      "command": "$NODE_BIN",
      "args": ["$MCP_INDEX"],
      "env": {
        "GITHUB_TOKEN": "$ENV_TOKEN",
        "GITHUB_OWNER": "$ENV_OWNER",
        "GITHUB_REPO": "$ENV_REPO"
      }
    }
  }
}
JSONEOF
}

merge_mcp_json() {
  local CONFIG_FILE="$1"
  node -e "
    const fs = require('fs');
    const config = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf8'));
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers['knowledge-brain'] = {
      command: '$NODE_BIN',
      args: ['$MCP_INDEX'],
      env: {
        GITHUB_TOKEN: '$ENV_TOKEN',
        GITHUB_OWNER: '$ENV_OWNER',
        GITHUB_REPO: '$ENV_REPO'
      }
    };
    fs.writeFileSync('$CONFIG_FILE', JSON.stringify(config, null, 2));
  "
}

write_or_merge() {
  local FILE="$1"
  mkdir -p "$(dirname "$FILE")"
  if [ -f "$FILE" ] && [ -s "$FILE" ]; then
    merge_mcp_json "$FILE"
  else
    write_mcp_json "$FILE"
  fi
}

configure_claude_desktop() {
  info "Đang cấu hình Claude Desktop..."
  local DIR="$HOME/Library/Application Support/Claude"
  [ ! -d "$DIR" ] && DIR="$HOME/.config/Claude"
  mkdir -p "$DIR"
  write_or_merge "$DIR/claude_desktop_config.json"
  success "Đã cấu hình Claude Desktop"
  warn "Khởi động lại Claude Desktop để kích hoạt"
}

configure_claude_code() {
  info "Đang cấu hình Claude Code..."
  if command -v claude &> /dev/null; then
    claude mcp add knowledge-brain \
      -e GITHUB_TOKEN="$ENV_TOKEN" \
      -e GITHUB_OWNER="$ENV_OWNER" \
      -e GITHUB_REPO="$ENV_REPO" \
      -- "$NODE_BIN" "$MCP_INDEX" 2>/dev/null
    success "Đã cấu hình Claude Code (qua CLI)"
  else
    write_or_merge "$HOME/.claude.json"
    success "Đã cấu hình Claude Code ($HOME/.claude.json)"
  fi
}

configure_cursor() {
  info "Đang cấu hình Cursor..."
  mkdir -p "$HOME/.cursor"
  write_or_merge "$HOME/.cursor/mcp.json"
  success "Đã cấu hình Cursor"
}

configure_windsurf() {
  info "Đang cấu hình Windsurf..."
  mkdir -p "$HOME/.codeium/windsurf"
  write_or_merge "$HOME/.codeium/windsurf/mcp_config.json"
  success "Đã cấu hình Windsurf"
}

configure_augment() {
  info "Đang cấu hình Augment (VS Code)..."
  local DIR="$HOME/.vscode"
  [ -d "$HOME/Library/Application Support/Code/User" ] && DIR="$HOME/Library/Application Support/Code/User"
  [ -d "$HOME/.config/Code/User" ] && DIR="$HOME/.config/Code/User"
  mkdir -p "$DIR"
  write_or_merge "$DIR/mcp.json"
  success "Đã cấu hình Augment"
}

configure_codex() {
  info "Đang cấu hình Codex (OpenAI)..."
  local DIR="$HOME/.codex"
  mkdir -p "$DIR"

  local TOML_BLOCK="
[mcp_servers.knowledge-brain]
command = \"$NODE_BIN\"
args = [\"$MCP_INDEX\"]
env = { \"GITHUB_TOKEN\" = \"$ENV_TOKEN\", \"GITHUB_OWNER\" = \"$ENV_OWNER\", \"GITHUB_REPO\" = \"$ENV_REPO\" }"

  if [ -f "$DIR/config.toml" ]; then
    if grep -q '\[mcp_servers\.knowledge-brain\]' "$DIR/config.toml" 2>/dev/null; then
      node -e "
        const fs = require('fs');
        let c = fs.readFileSync('$DIR/config.toml', 'utf8');
        c = c.replace(/\\n?\\[mcp_servers\\.knowledge-brain\\][\\s\\S]*?(?=\\n\\[|$)/, '');
        fs.writeFileSync('$DIR/config.toml', c.trimEnd() + '\\n');
      " 2>/dev/null
    fi
    echo "$TOML_BLOCK" >> "$DIR/config.toml"
  else
    echo "# Knowledge Brain MCP Server" > "$DIR/config.toml"
    echo "$TOML_BLOCK" >> "$DIR/config.toml"
  fi
  success "Đã cấu hình Codex"
}

select_ides() {
  echo ""
  echo -e "${BOLD}── Chọn IDE/Tool để cấu hình ──${NC}"
  echo ""
  echo "  1) Claude Desktop"
  echo "  2) Claude Code (CLI)"
  echo "  3) Cursor"
  echo "  4) Windsurf"
  echo "  5) Augment (VS Code)"
  echo "  6) Codex (OpenAI)"
  echo "  7) Tất cả"
  echo "  0) Bỏ qua (cấu hình thủ công sau)"
  echo ""
  read -rp "  Chọn (phân cách bằng dấu phẩy, vd: 1,2): " IDE_CHOICE < /dev/tty

  IFS=',' read -ra CHOICES <<< "$IDE_CHOICE"
  for choice in "${CHOICES[@]}"; do
    choice=$(echo "$choice" | tr -d ' ')
    case "$choice" in
      1) configure_claude_desktop ;;
      2) configure_claude_code ;;
      3) configure_cursor ;;
      4) configure_windsurf ;;
      5) configure_augment ;;
      6) configure_codex ;;
      7)
        configure_claude_desktop
        configure_claude_code
        configure_cursor
        configure_windsurf
        configure_augment
        configure_codex
        ;;
      0) info "Bỏ qua cấu hình IDE." ;;
      *) warn "Lựa chọn không hợp lệ: $choice" ;;
    esac
  done
}

# ═══════════════════════════════════════════════════════════
#  Kiểm tra & Tổng kết
# ═══════════════════════════════════════════════════════════

verify() {
  echo ""
  info "Đang kiểm tra..."
  if [ -f "$MCP_INDEX" ]; then
    success "MCP server: $MCP_INDEX"
  else
    error "Không tìm thấy $MCP_INDEX"
    return 1
  fi
}

print_summary() {
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}${BOLD}  Cài đặt hoàn tất!${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  Node.js    : ${BOLD}$NODE_BIN${NC}"
  echo -e "  MCP Server : ${BOLD}$MCP_INDEX${NC}"
  echo -e "  Owner      : ${BOLD}${ENV_OWNER:-chưa set}${NC}"
  echo -e "  Repo       : ${BOLD}$ENV_REPO${NC}"
  echo ""
  echo -e "  ${BOLD}Bước tiếp theo:${NC}"
  echo "  1. Khởi động lại IDE"
  echo -e "  2. Nói với AI: ${GREEN}\"Khởi tạo brain cho tôi\"${NC}"
  echo "  3. Bắt đầu dùng: thêm task, lưu kiến thức, hỏi đáp..."
  if [ -z "$ENV_TOKEN" ] || [ -z "$ENV_OWNER" ]; then
    echo ""
    echo -e "  ${YELLOW}Chưa đủ thông tin. Sửa file:${NC}"
    echo -e "    ${BOLD}$INSTALL_DIR/.env${NC}"
  fi
  echo ""
  echo -e "  ${BOLD}Cập nhật sau này:${NC}"
  echo "    cd $INSTALL_DIR && ./update.sh"
  echo ""
}

# ═══════════════════════════════════════════════════════════
#  Gỡ cài đặt
# ═══════════════════════════════════════════════════════════

uninstall() {
  print_banner
  echo -e "${BOLD}── Gỡ cài đặt Knowledge Brain MCP ──${NC}"
  echo ""

  if [ -d "$DEFAULT_INSTALL_DIR" ]; then
    read -rp "  Xóa $DEFAULT_INSTALL_DIR? (c/K): " CONFIRM < /dev/tty
    if [[ "$CONFIRM" =~ ^[CcYy]$ ]]; then
      rm -rf "$DEFAULT_INSTALL_DIR"
      success "Đã xóa $DEFAULT_INSTALL_DIR"
    fi
  else
    info "Không tìm thấy $DEFAULT_INSTALL_DIR"
  fi

  if command -v claude &> /dev/null; then
    claude mcp remove knowledge-brain 2>/dev/null && success "Đã xóa khỏi Claude Code" || true
  fi

  for CONFIG_FILE in \
    "$HOME/Library/Application Support/Claude/claude_desktop_config.json" \
    "$HOME/.config/Claude/claude_desktop_config.json" \
    "$HOME/.cursor/mcp.json" \
    "$HOME/.codeium/windsurf/mcp_config.json" \
    "$HOME/.claude.json"; do
    if [ -f "$CONFIG_FILE" ]; then
      node -e "
        const fs = require('fs');
        const c = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf8'));
        if (c.mcpServers) delete c.mcpServers['knowledge-brain'];
        fs.writeFileSync('$CONFIG_FILE', JSON.stringify(c, null, 2));
      " 2>/dev/null && success "Đã xóa khỏi $(basename "$CONFIG_FILE")" || true
    fi
  done

  echo ""
  success "Gỡ cài đặt hoàn tất. Khởi động lại IDE."
}

# ═══════════════════════════════════════════════════════════
#  Main
# ═══════════════════════════════════════════════════════════

main() {
  print_banner

  if [ "${1:-}" = "--uninstall" ] || [ "${1:-}" = "uninstall" ]; then
    uninstall
    exit 0
  fi

  check_node
  check_npm
  check_git

  detect_mode
  install_mcp
  collect_env
  select_ides
  verify
  print_summary
}

# Wrap trong { } để đảm bảo bash đọc hết script trước khi chạy
# (cần thiết khi dùng curl | bash)
{
main "$@"
}
