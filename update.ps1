# ═══════════════════════════════════════════════════════════
#  Knowledge Brain MCP Server - Cap nhat (Windows)
#
#  Dung:
#    .\update.ps1
#    .\update.ps1 -Path "C:\path\to\mcp"
# ═══════════════════════════════════════════════════════════

param(
  [string]$Path
)

$ErrorActionPreference = "Stop"

function Write-Info    { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Blue }
function Write-Success { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn    { param($msg) Write-Host "[CANH BAO] $msg" -ForegroundColor Yellow }
function Write-Err     { param($msg) Write-Host "[LOI] $msg" -ForegroundColor Red }

$DEFAULT_INSTALL_DIR = "$env:USERPROFILE\.knowledge-brain-mcp"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Knowledge Brain MCP Server - Cap nhat (Windows) ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Tim thu muc cai dat ──

$INSTALL_DIR = $Path

if (-not $INSTALL_DIR) {
  if ((Test-Path ".\package.json") -and (Select-String -Path ".\package.json" -Pattern "knowledge-mcp" -Quiet)) {
    $INSTALL_DIR = (Get-Location).Path
  }
  elseif ((Test-Path $DEFAULT_INSTALL_DIR) -and (Test-Path "$DEFAULT_INSTALL_DIR\dist\index.js")) {
    $INSTALL_DIR = $DEFAULT_INSTALL_DIR
  }
  else {
    Write-Err "Khong tim thay MCP server."
    Write-Host ""
    Write-Host "  Cach dung: .\update.ps1 -Path <duong-dan>"
    Write-Host "  Vi du:     .\update.ps1 -Path `"$DEFAULT_INSTALL_DIR`""
    Write-Host ""
    exit 1
  }
}

if (-not (Test-Path "$INSTALL_DIR\package.json")) {
  Write-Err "Khong tim thay MCP server tai $INSTALL_DIR"
  exit 1
}

Write-Info "Tim thay MCP server tai $INSTALL_DIR"

# ── Luu phien ban hien tai ──

Push-Location $INSTALL_DIR

$CURRENT_COMMIT = "unknown"
if (Test-Path ".git") {
  try {
    $CURRENT_COMMIT = (git rev-parse --short HEAD 2>$null)
    Write-Info "Phien ban hien tai: $CURRENT_COMMIT"
  } catch {
    $CURRENT_COMMIT = "unknown"
  }
}

# ── Pull ban moi nhat ──

if (Test-Path ".git") {
  Write-Info "Dang tai ban moi nhat..."

  # Kiem tra thay doi local
  $diff = git diff --quiet 2>$null; $hasChanges = $LASTEXITCODE -ne 0
  if ($hasChanges) {
    Write-Warn "Phat hien thay doi local"
    Write-Host ""
    Write-Host "  1) Luu tam (stash) va cap nhat"
    Write-Host "  2) Ghi de (bo thay doi local)"
    Write-Host "  3) Huy"
    Write-Host ""
    $choice = Read-Host "  Chon [1]"
    if (-not $choice) { $choice = "1" }

    switch ($choice) {
      "1" {
        git stash
        Write-Success "Da luu tam (khoi phuc bang: git stash pop)"
      }
      "2" {
        git checkout .
        Write-Success "Da bo thay doi local"
      }
      "3" {
        Write-Info "Da huy cap nhat."
        Pop-Location
        exit 0
      }
      default {
        Write-Err "Lua chon khong hop le"
        Pop-Location
        exit 1
      }
    }
  }

  try {
    git pull origin main 2>$null
  } catch {
    try { git pull 2>$null } catch {}
  }

  $NEW_COMMIT = "unknown"
  try { $NEW_COMMIT = (git rev-parse --short HEAD 2>$null) } catch {}

  if ($CURRENT_COMMIT -eq $NEW_COMMIT) {
    Write-Success "Da la ban moi nhat ($NEW_COMMIT)"
  } else {
    Write-Success "Da cap nhat: $CURRENT_COMMIT -> $NEW_COMMIT"

    if ($CURRENT_COMMIT -ne "unknown" -and $NEW_COMMIT -ne "unknown") {
      Write-Host ""
      Write-Info "Thay doi:"
      try {
        $logs = git log --oneline "$CURRENT_COMMIT..$NEW_COMMIT" 2>$null | Select-Object -First 20
        foreach ($line in $logs) {
          Write-Host "  $line"
        }
      } catch {}
    }
  }
} else {
  Write-Warn "Khong phai git repo — khong the pull."
  Write-Host "  De cap nhat, cai lai:"
  Write-Host "  Invoke-WebRequest -Uri https://raw.githubusercontent.com/vuluu2k/knowledge_mcp/main/install.ps1 -OutFile install.ps1; .\install.ps1"
  Pop-Location
  exit 1
}

# ── Cai lai dependencies ──

Write-Host ""
Write-Info "Dang cai dependencies..."
try {
  npm install 2>$null | Select-Object -Last 1
  Write-Success "Da cap nhat dependencies"
} catch {
  Write-Warn "npm install that bai, thu clean cache..."
  npm cache clean --force 2>$null
  try {
    npm install
    Write-Success "Da cap nhat dependencies"
  } catch {
    Write-Err "npm install that bai!"
    Write-Host "  Thu chay thu cong: cd $INSTALL_DIR; npm install"
    Pop-Location
    exit 1
  }
}

# ── Rebuild TypeScript ──

Write-Info "Dang build TypeScript..."
if (Test-Path "dist") {
  Remove-Item -Recurse -Force "dist"
}
try {
  npm run build 2>$null
  Write-Success "Build hoan tat"
} catch {
  Write-Err "npm run build that bai!"
  Write-Host "  Thu chay thu cong: cd $INSTALL_DIR; npm run build"
  Pop-Location
  exit 1
}

# ── Kiem tra .env moi ──

if ((Test-Path ".env") -and (Test-Path ".env.example")) {
  $envContent = Get-Content ".env" -Raw
  $missing = @()
  Get-Content ".env.example" | ForEach-Object {
    if ($_ -match "^([A-Z_]+)=") {
      $key = $Matches[1]
      if ($envContent -notmatch "(?m)^$key=") {
        $missing += $key
      }
    }
  }
  if ($missing.Count -gt 0) {
    Write-Host ""
    Write-Warn "Bien moi truong moi trong .env.example:"
    foreach ($m in $missing) {
      Write-Host "  $m"
    }
    Write-Host "  Them vao file .env"
  } else {
    Write-Success ".env day du"
  }
}

# ── Kiem tra ──

Write-Host ""
Write-Info "Dang kiem tra..."
if (Test-Path "$INSTALL_DIR\dist\index.js") {
  Write-Success "MCP server: $INSTALL_DIR\dist\index.js"
} else {
  Write-Err "Khong tim thay dist\index.js — build co the that bai"
}

# ── Hoan tat ──

Pop-Location

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Cap nhat hoan tat!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Khoi dong lai IDE de su dung ban moi."
Write-Host ""
