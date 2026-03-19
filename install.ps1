# ═══════════════════════════════════════════════════════════
#  Knowledge Brain MCP Server - Trình cài đặt tự động (Windows)
#  Hỗ trợ: Claude Desktop, Claude Code, Cursor, Windsurf, Augment, Codex
#
#  Dùng từ xa:
#    irm https://raw.githubusercontent.com/vuluu2k/knowledge_mcp/main/install.ps1 | iex
#
#  Hoặc tải về rồi chạy:
#    Invoke-WebRequest -Uri https://raw.githubusercontent.com/vuluu2k/knowledge_mcp/main/install.ps1 -OutFile install.ps1; .\install.ps1
#
#  Dùng sau khi clone:
#    .\install.ps1
#
#  Gỡ cài đặt:
#    .\install.ps1 -Uninstall
# ═══════════════════════════════════════════════════════════

param(
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

# ── Màu sắc ──
function Write-Info    { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Blue }
function Write-Success { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn    { param($msg) Write-Host "[CANH BAO] $msg" -ForegroundColor Yellow }
function Write-Err     { param($msg) Write-Host "[LOI] $msg" -ForegroundColor Red }

function Print-Banner {
  Write-Host ""
  Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
  Write-Host "║  Knowledge Brain MCP Server - Cai dat (Windows) ║" -ForegroundColor Cyan
  Write-Host "║  Bien AI thanh tro ly co tri nho vinh vien       ║" -ForegroundColor Cyan
  Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
  Write-Host ""
}

# ═══════════════════════════════════════════════════════════
#  Kiểm tra & cài Node.js
# ═══════════════════════════════════════════════════════════

function Install-NodeJS {
  Write-Info "Dang cai Node.js 20 LTS..."

  # Kiểm tra winget
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    Write-Info "Cai qua winget..."
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
  }
  # Kiểm tra choco
  elseif (Get-Command choco -ErrorAction SilentlyContinue) {
    Write-Info "Cai qua Chocolatey..."
    choco install nodejs-lts -y
  }
  # Kiểm tra scoop
  elseif (Get-Command scoop -ErrorAction SilentlyContinue) {
    Write-Info "Cai qua Scoop..."
    scoop install nodejs-lts
  }
  else {
    # Tải installer trực tiếp
    Write-Info "Dang tai Node.js installer..."
    $nodeUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi"
    $installer = "$env:TEMP\node-installer.msi"
    Invoke-WebRequest -Uri $nodeUrl -OutFile $installer -UseBasicParsing
    Write-Info "Dang cai dat Node.js (can quyen Admin)..."
    Start-Process msiexec.exe -ArgumentList "/i", $installer, "/qn" -Wait -Verb RunAs
    Remove-Item $installer -Force -ErrorAction SilentlyContinue
  }

  # Refresh PATH
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Err "Cai Node.js that bai."
    Write-Host "  Vui long cai thu cong: https://nodejs.org/"
    exit 1
  }
  Write-Success "Da cai Node.js $(node -v)"
}

function Check-NodeJS {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Warn "Chua cai Node.js."
    $confirm = Read-Host "  Tu dong cai Node.js 20 LTS? (C/k)"
    if (-not $confirm) { $confirm = "C" }
    if ($confirm -match "^[CcYy]$") {
      Install-NodeJS
    } else {
      Write-Err "Can Node.js >= 18. Cai xong roi chay lai."
      Write-Host "  https://nodejs.org/"
      exit 1
    }
  } else {
    $nodeVersion = (node -v) -replace "v", "" -split "\." | Select-Object -First 1
    if ([int]$nodeVersion -lt 18) {
      Write-Warn "Can Node.js >= 18. Hien tai: $(node -v)"
      $confirm = Read-Host "  Tu dong cai Node.js 20 LTS? (C/k)"
      if (-not $confirm) { $confirm = "C" }
      if ($confirm -match "^[CcYy]$") {
        Install-NodeJS
      } else {
        Write-Err "Can Node.js >= 18. Cai xong roi chay lai."
        exit 1
      }
    }
  }

  $script:NODE_BIN = (Get-Command node).Source
  Write-Success "Node.js $(node -v) tai $script:NODE_BIN"
}

function Check-Npm {
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Err "Chua cai npm."
    exit 1
  }
  Write-Success "npm $(npm -v)"
}

function Check-Git {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Err "Chua cai git."
    Write-Host "  Tai tai: https://git-scm.com/download/win"
    Write-Host "  Hoac:    winget install Git.Git"
    exit 1
  }
  Write-Success "git $(git --version)"
}

# ═══════════════════════════════════════════════════════════
#  Cài MCP Server
# ═══════════════════════════════════════════════════════════

$REPO_URL = "https://github.com/vuluu2k/knowledge_mcp.git"
$DEFAULT_INSTALL_DIR = "$env:USERPROFILE\.knowledge-brain-mcp"

function Install-MCP {
  $script:IS_LOCAL = $false

  # Phát hiện chạy từ repo đã clone
  if ((Test-Path ".\package.json") -and (Test-Path ".\src") -and (Select-String -Path ".\package.json" -Pattern "knowledge-mcp" -Quiet)) {
    $script:IS_LOCAL = $true
    $script:INSTALL_DIR = (Get-Location).Path
    Write-Info "Phat hien chay tu repo da clone: $script:INSTALL_DIR"
  } else {
    Write-Host ""
    Write-Info "Cai MCP server vao dau?"
    Write-Host "  Mac dinh: $DEFAULT_INSTALL_DIR"
    $inputDir = Read-Host "  Duong dan (Enter de dung mac dinh)"
    if (-not $inputDir) { $inputDir = $DEFAULT_INSTALL_DIR }
    $script:INSTALL_DIR = $inputDir

    if (Test-Path $script:INSTALL_DIR) {
      if (Test-Path "$($script:INSTALL_DIR)\dist\index.js") {
        # Case 1: Đã cài đầy đủ → hỏi update
        Write-Success "MCP server da co tai $($script:INSTALL_DIR)"
        $update = Read-Host "  Cap nhat len ban moi nhat? (c/K)"
        if ($update -match "^[CcYy]$") {
          Write-Info "Dang cap nhat..."
          Push-Location $script:INSTALL_DIR
          git pull origin main 2>$null
          npm install
          npm run build
          Pop-Location
          Write-Success "Cap nhat thanh cong"
          $script:MCP_INDEX = "$($script:INSTALL_DIR)\dist\index.js"
          return
        }
      }
      elseif (Test-Path "$($script:INSTALL_DIR)\.git") {
        # Case 2: Git repo nhưng chưa build
        Write-Warn "Thu muc da ton tai nhung chua build: $($script:INSTALL_DIR)"
        Write-Info "Dang pull code moi nhat va build lai..."
        Push-Location $script:INSTALL_DIR
        git fetch origin main 2>$null
        git reset --hard origin/main 2>$null
        Pop-Location
      }
      else {
        # Case 3: Thư mục tồn tại nhưng không phải repo
        Write-Warn "Thu muc da ton tai nhung khong phai git repo: $($script:INSTALL_DIR)"
        $remove = Read-Host "  Xoa va cai lai? (c/K)"
        if ($remove -match "^[CcYy]$") {
          Remove-Item -Recurse -Force $script:INSTALL_DIR
          Write-Info "Dang clone repository..."
          git clone $REPO_URL $script:INSTALL_DIR
        } else {
          Write-Err "Khong the cai dat. Xoa thu muc hoac chon duong dan khac."
          exit 1
        }
      }
    }
    else {
      Write-Info "Dang clone repository..."
      git clone $REPO_URL $script:INSTALL_DIR
    }
  }

  Push-Location $script:INSTALL_DIR

  Write-Info "Dang cai dependencies..."
  try {
    npm install
  } catch {
    Write-Warn "npm install that bai, thu clean cache..."
    npm cache clean --force 2>$null
    try {
      npm install
    } catch {
      Write-Err "npm install that bai!"
      Write-Host "  Thu chay thu cong:"
      Write-Host "    cd $($script:INSTALL_DIR)"
      Write-Host "    npm install"
      Pop-Location
      exit 1
    }
  }

  Write-Info "Dang build TypeScript..."
  try {
    npm run build
  } catch {
    Write-Err "npm run build that bai!"
    Write-Host "  Thu chay thu cong: cd $($script:INSTALL_DIR); npm run build"
    Pop-Location
    exit 1
  }

  Pop-Location

  Write-Success "Da cai MCP server tai $($script:INSTALL_DIR)"
  $script:MCP_INDEX = "$($script:INSTALL_DIR)\dist\index.js"
}

# ═══════════════════════════════════════════════════════════
#  Thu thập biến môi trường
# ═══════════════════════════════════════════════════════════

function Collect-Env {
  $envFile = "$($script:INSTALL_DIR)\.env"
  $envExample = "$($script:INSTALL_DIR)\.env.example"

  # Đọc .env nếu đã có
  if (Test-Path $envFile) {
    $envContent = Get-Content $envFile -Raw
    if ($envContent -match "GITHUB_TOKEN=(.+)") {
      $existingToken = $Matches[1].Trim()
      if ($existingToken -and $existingToken -ne "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx") {
        $script:ENV_TOKEN = $existingToken
        if ($envContent -match "GITHUB_OWNER=(.+)") { $script:ENV_OWNER = $Matches[1].Trim() }
        if ($envContent -match "GITHUB_REPO=(.+)") { $script:ENV_REPO = $Matches[1].Trim() }
        if (-not $script:ENV_REPO) { $script:ENV_REPO = "brain" }

        Write-Success ".env da co cau hinh"
        Write-Host "  Owner : $($script:ENV_OWNER)"
        Write-Host "  Repo  : $($script:ENV_REPO)"

        $keep = Read-Host "  Giu nguyen cau hinh nay? (C/k)"
        if (-not $keep) { $keep = "C" }
        if ($keep -match "^[CcYy]$") { return }
      }
    }
  }

  Write-Host ""
  Write-Host "-- Cau hinh ket noi GitHub --" -ForegroundColor White
  Write-Host ""
  Write-Host "  Cach lay GitHub Token:" -ForegroundColor Yellow
  Write-Host "    1. Vao https://github.com/settings/tokens"
  Write-Host "    2. Generate new token (classic)"
  Write-Host "    3. Tick quyen 'repo' (Full control of private repositories)"
  Write-Host "    4. Copy token (ghp_...)"
  Write-Host ""
  Write-Host "  Chuan bi repo:" -ForegroundColor Yellow
  Write-Host "    Tao 1 repo rong tren GitHub (vi du: 'brain')"
  Write-Host ""

  $script:ENV_TOKEN = Read-Host "  GITHUB_TOKEN (ghp_...)"
  $script:ENV_OWNER = Read-Host "  GITHUB_OWNER (username GitHub)"
  $repo = Read-Host "  GITHUB_REPO [brain]"
  if (-not $repo) { $repo = "brain" }
  $script:ENV_REPO = $repo

  # Ghi .env
  if (Test-Path $envExample) {
    $content = Get-Content $envExample -Raw
    if ($script:ENV_TOKEN) {
      $content = $content -replace "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", $script:ENV_TOKEN
    }
    if ($script:ENV_OWNER) {
      $content = $content -replace "yourusername", $script:ENV_OWNER
    }
    $content = $content -replace "GITHUB_REPO=brain", "GITHUB_REPO=$($script:ENV_REPO)"
    Set-Content -Path $envFile -Value $content -NoNewline
  }

  Write-Host ""
  Write-Success "Cau hinh:"
  if ($script:ENV_TOKEN) {
    Write-Host "  Token : $($script:ENV_TOKEN.Substring(0, [Math]::Min(10, $script:ENV_TOKEN.Length)))..."
  } else {
    Write-Host "  Token : (chua set — sua .env sau)" -ForegroundColor Yellow
  }
  if ($script:ENV_OWNER) {
    Write-Host "  Owner : $($script:ENV_OWNER)"
  } else {
    Write-Host "  Owner : (chua set — sua .env sau)" -ForegroundColor Yellow
  }
  Write-Host "  Repo  : $($script:ENV_REPO)"
}

# ═══════════════════════════════════════════════════════════
#  Cấu hình IDE
# ═══════════════════════════════════════════════════════════

function Write-McpJson {
  param($ConfigFile)
  $json = @{
    mcpServers = @{
      "knowledge-brain" = @{
        command = $script:NODE_BIN
        args = @($script:MCP_INDEX)
        env = @{
          GITHUB_TOKEN = $script:ENV_TOKEN
          GITHUB_OWNER = $script:ENV_OWNER
          GITHUB_REPO  = $script:ENV_REPO
        }
      }
    }
  } | ConvertTo-Json -Depth 5
  Set-Content -Path $ConfigFile -Value $json -Encoding UTF8
}

function Merge-McpJson {
  param($ConfigFile)
  $config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
  if (-not $config.mcpServers) {
    $config | Add-Member -NotePropertyName "mcpServers" -NotePropertyValue @{} -Force
  }
  $config.mcpServers | Add-Member -NotePropertyName "knowledge-brain" -NotePropertyValue @{
    command = $script:NODE_BIN
    args = @($script:MCP_INDEX)
    env = @{
      GITHUB_TOKEN = $script:ENV_TOKEN
      GITHUB_OWNER = $script:ENV_OWNER
      GITHUB_REPO  = $script:ENV_REPO
    }
  } -Force
  $config | ConvertTo-Json -Depth 5 | Set-Content -Path $ConfigFile -Encoding UTF8
}

function Write-OrMerge {
  param($File)
  $dir = Split-Path $File -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  if ((Test-Path $File) -and (Get-Item $File).Length -gt 0) {
    Merge-McpJson $File
  } else {
    Write-McpJson $File
  }
}

function Configure-ClaudeDesktop {
  Write-Info "Dang cau hinh Claude Desktop..."
  $dir = "$env:APPDATA\Claude"
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Write-OrMerge "$dir\claude_desktop_config.json"
  Write-Success "Da cau hinh Claude Desktop"
  Write-Warn "Khoi dong lai Claude Desktop de kich hoat"
}

function Configure-ClaudeCode {
  Write-Info "Dang cau hinh Claude Code..."
  if (Get-Command claude -ErrorAction SilentlyContinue) {
    claude mcp add knowledge-brain `
      -e GITHUB_TOKEN="$($script:ENV_TOKEN)" `
      -e GITHUB_OWNER="$($script:ENV_OWNER)" `
      -e GITHUB_REPO="$($script:ENV_REPO)" `
      -- "$($script:NODE_BIN)" "$($script:MCP_INDEX)" 2>$null
    Write-Success "Da cau hinh Claude Code (qua CLI)"
  } else {
    Write-OrMerge "$env:USERPROFILE\.claude.json"
    Write-Success "Da cau hinh Claude Code ($env:USERPROFILE\.claude.json)"
  }
}

function Configure-Cursor {
  Write-Info "Dang cau hinh Cursor..."
  Write-OrMerge "$env:USERPROFILE\.cursor\mcp.json"
  Write-Success "Da cau hinh Cursor"
}

function Configure-Windsurf {
  Write-Info "Dang cau hinh Windsurf..."
  Write-OrMerge "$env:USERPROFILE\.codeium\windsurf\mcp_config.json"
  Write-Success "Da cau hinh Windsurf"
}

function Configure-Augment {
  Write-Info "Dang cau hinh Augment (VS Code)..."
  $dir = "$env:APPDATA\Code\User"
  if (-not (Test-Path $dir)) { $dir = "$env:USERPROFILE\.vscode" }
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Write-OrMerge "$dir\mcp.json"
  Write-Success "Da cau hinh Augment"
}

function Configure-Codex {
  Write-Info "Dang cau hinh Codex (OpenAI)..."
  $dir = "$env:USERPROFILE\.codex"
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $tomlBlock = @"

[mcp_servers.knowledge-brain]
command = "$($script:NODE_BIN)"
args = ["$($script:MCP_INDEX)"]
env = { "GITHUB_TOKEN" = "$($script:ENV_TOKEN)", "GITHUB_OWNER" = "$($script:ENV_OWNER)", "GITHUB_REPO" = "$($script:ENV_REPO)" }
"@
  $tomlFile = "$dir\config.toml"
  if (Test-Path $tomlFile) {
    $content = Get-Content $tomlFile -Raw
    $content = $content -replace "(?s)\[mcp_servers\.knowledge-brain\].*?(?=\n\[|$)", ""
    Set-Content -Path $tomlFile -Value ($content.TrimEnd() + "`n") -NoNewline
    Add-Content -Path $tomlFile -Value $tomlBlock
  } else {
    Set-Content -Path $tomlFile -Value "# Knowledge Brain MCP Server`n$tomlBlock"
  }
  Write-Success "Da cau hinh Codex"
}

function Select-IDEs {
  Write-Host ""
  Write-Host "-- Chon IDE/Tool de cau hinh --" -ForegroundColor White
  Write-Host ""
  Write-Host "  1) Claude Desktop"
  Write-Host "  2) Claude Code (CLI)"
  Write-Host "  3) Cursor"
  Write-Host "  4) Windsurf"
  Write-Host "  5) Augment (VS Code)"
  Write-Host "  6) Codex (OpenAI)"
  Write-Host "  7) Tat ca"
  Write-Host "  0) Bo qua (cau hinh thu cong sau)"
  Write-Host ""
  $choice = Read-Host "  Chon (phan cach bang dau phay, vd: 1,2)"

  $choices = $choice -split "," | ForEach-Object { $_.Trim() }
  foreach ($c in $choices) {
    switch ($c) {
      "1" { Configure-ClaudeDesktop }
      "2" { Configure-ClaudeCode }
      "3" { Configure-Cursor }
      "4" { Configure-Windsurf }
      "5" { Configure-Augment }
      "6" { Configure-Codex }
      "7" {
        Configure-ClaudeDesktop
        Configure-ClaudeCode
        Configure-Cursor
        Configure-Windsurf
        Configure-Augment
        Configure-Codex
      }
      "0" { Write-Info "Bo qua cau hinh IDE." }
      default { Write-Warn "Lua chon khong hop le: $c" }
    }
  }
}

# ═══════════════════════════════════════════════════════════
#  Kiểm tra & Tổng kết
# ═══════════════════════════════════════════════════════════

function Verify-Install {
  Write-Host ""
  Write-Info "Dang kiem tra..."
  if (Test-Path $script:MCP_INDEX) {
    Write-Success "MCP server: $($script:MCP_INDEX)"
  } else {
    Write-Err "Khong tim thay $($script:MCP_INDEX)"
    return
  }
}

function Print-Summary {
  Write-Host ""
  Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
  Write-Host "  Cai dat hoan tat!" -ForegroundColor Green
  Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "  Node.js    : $($script:NODE_BIN)"
  Write-Host "  MCP Server : $($script:MCP_INDEX)"
  Write-Host "  Owner      : $(if ($script:ENV_OWNER) { $script:ENV_OWNER } else { 'chua set' })"
  Write-Host "  Repo       : $($script:ENV_REPO)"
  Write-Host ""
  Write-Host "  Buoc tiep theo:"
  Write-Host "  1. Khoi dong lai IDE"
  Write-Host "  2. Noi voi AI: `"Khoi tao brain cho toi`"" -ForegroundColor Green
  Write-Host "  3. Bat dau dung: them task, luu kien thuc, hoi dap..."
  if (-not $script:ENV_TOKEN -or -not $script:ENV_OWNER) {
    Write-Host ""
    Write-Host "  Chua du thong tin. Sua file:" -ForegroundColor Yellow
    Write-Host "    $($script:INSTALL_DIR)\.env"
  }
  Write-Host ""
  Write-Host "  Cap nhat sau nay:"
  Write-Host "    cd $($script:INSTALL_DIR); .\update.ps1"
  Write-Host ""
}

# ═══════════════════════════════════════════════════════════
#  Gỡ cài đặt
# ═══════════════════════════════════════════════════════════

function Uninstall-MCP {
  Print-Banner
  Write-Host "-- Go cai dat Knowledge Brain MCP --" -ForegroundColor White
  Write-Host ""

  if (Test-Path $DEFAULT_INSTALL_DIR) {
    $confirm = Read-Host "  Xoa ${DEFAULT_INSTALL_DIR}? (c/K)"
    if ($confirm -match "^[CcYy]$") {
      Remove-Item -Recurse -Force $DEFAULT_INSTALL_DIR
      Write-Success "Da xoa $DEFAULT_INSTALL_DIR"
    }
  } else {
    Write-Info "Khong tim thay $DEFAULT_INSTALL_DIR"
  }

  if (Get-Command claude -ErrorAction SilentlyContinue) {
    claude mcp remove knowledge-brain 2>$null
    Write-Success "Da xoa khoi Claude Code"
  }

  $configFiles = @(
    "$env:APPDATA\Claude\claude_desktop_config.json",
    "$env:USERPROFILE\.cursor\mcp.json",
    "$env:USERPROFILE\.codeium\windsurf\mcp_config.json",
    "$env:USERPROFILE\.claude.json"
  )

  foreach ($cf in $configFiles) {
    if (Test-Path $cf) {
      try {
        $config = Get-Content $cf -Raw | ConvertFrom-Json
        if ($config.mcpServers."knowledge-brain") {
          $config.mcpServers.PSObject.Properties.Remove("knowledge-brain")
          $config | ConvertTo-Json -Depth 5 | Set-Content -Path $cf -Encoding UTF8
          Write-Success "Da xoa khoi $(Split-Path $cf -Leaf)"
        }
      } catch {
        Write-Warn "Khong the sua $cf"
      }
    }
  }

  Write-Host ""
  Write-Success "Go cai dat hoan tat. Khoi dong lai IDE."
}

# ═══════════════════════════════════════════════════════════
#  Main
# ═══════════════════════════════════════════════════════════

function Main {
  Print-Banner

  if ($Uninstall) {
    Uninstall-MCP
    exit 0
  }

  Check-NodeJS
  Check-Npm
  Check-Git

  Install-MCP
  Collect-Env
  Select-IDEs
  Verify-Install
  Print-Summary
}

Main
