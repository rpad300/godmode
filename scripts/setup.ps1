# =============================================================================
# GodMode - Windows Setup Script (PowerShell)
# =============================================================================
# Run this script to set up the project on Windows
# Usage: .\scripts\setup.ps1
# =============================================================================

param(
    [switch]$SkipNodeModules,
    [switch]$SkipOllama,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  GodMode - Setup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# -----------------------------------------------------------------------------
# Check Prerequisites
# -----------------------------------------------------------------------------

Write-Host "[1/6] Checking prerequisites..." -ForegroundColor Yellow

# Check Node.js
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        $versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
        if ($versionNumber -ge 18) {
            Write-Host "  [OK] Node.js $nodeVersion" -ForegroundColor Green
        } else {
            Write-Host "  [WARN] Node.js $nodeVersion found, but v18+ recommended" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "  [ERROR] Node.js not found. Please install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version 2>$null
    Write-Host "  [OK] npm v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] npm not found" -ForegroundColor Red
    exit 1
}

# Check Git (optional)
try {
    $gitVersion = git --version 2>$null
    Write-Host "  [OK] $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "  [INFO] Git not found (optional)" -ForegroundColor Gray
}

# Check Docker (optional)
try {
    $dockerVersion = docker --version 2>$null
    Write-Host "  [OK] $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "  [INFO] Docker not found (optional, for containerized services)" -ForegroundColor Gray
}

# Check Ollama (optional)
if (-not $SkipOllama) {
    try {
        $ollamaVersion = ollama --version 2>$null
        Write-Host "  [OK] Ollama installed" -ForegroundColor Green
    } catch {
        Write-Host "  [INFO] Ollama not found - Install from https://ollama.ai for local AI" -ForegroundColor Yellow
    }
}

# -----------------------------------------------------------------------------
# Install Dependencies
# -----------------------------------------------------------------------------

Write-Host ""
Write-Host "[2/6] Installing Node.js dependencies..." -ForegroundColor Yellow

if (-not $SkipNodeModules -or $Force) {
    if (Test-Path "node_modules") {
        if ($Force) {
            Write-Host "  Removing existing node_modules..." -ForegroundColor Gray
            Remove-Item -Recurse -Force "node_modules"
        } else {
            Write-Host "  [OK] node_modules exists (use -Force to reinstall)" -ForegroundColor Green
        }
    }
    
    if (-not (Test-Path "node_modules")) {
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  [ERROR] npm install failed" -ForegroundColor Red
            exit 1
        }
        Write-Host "  [OK] Dependencies installed" -ForegroundColor Green
    }
} else {
    Write-Host "  [SKIP] Skipping npm install" -ForegroundColor Gray
}

# -----------------------------------------------------------------------------
# Setup Environment File
# -----------------------------------------------------------------------------

Write-Host ""
Write-Host "[3/6] Setting up environment..." -ForegroundColor Yellow

if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "  [OK] Created .env from .env.example" -ForegroundColor Green
        Write-Host "  [ACTION] Edit .env to add your API keys" -ForegroundColor Yellow
    } else {
        Write-Host "  [WARN] .env.example not found" -ForegroundColor Yellow
    }
} else {
    Write-Host "  [OK] .env already exists" -ForegroundColor Green
}

# Also check src/.env for legacy support
if (-not (Test-Path "src/.env") -and (Test-Path ".env")) {
    Copy-Item ".env" "src/.env"
    Write-Host "  [OK] Copied .env to src/.env for compatibility" -ForegroundColor Green
}

# -----------------------------------------------------------------------------
# Create Data Directories
# -----------------------------------------------------------------------------

Write-Host ""
Write-Host "[4/6] Creating data directories..." -ForegroundColor Yellow

$directories = @(
    "data",
    "data/projects",
    "temp"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  [OK] Created $dir" -ForegroundColor Green
    } else {
        Write-Host "  [OK] $dir exists" -ForegroundColor Green
    }
}

# -----------------------------------------------------------------------------
# Build Frontend
# -----------------------------------------------------------------------------

Write-Host ""
Write-Host "[5/6] Building frontend..." -ForegroundColor Yellow

try {
    npm run build:frontend
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [WARN] Frontend build failed - app may still work in dev mode" -ForegroundColor Yellow
    } else {
        Write-Host "  [OK] Frontend built successfully" -ForegroundColor Green
    }
} catch {
    Write-Host "  [WARN] Frontend build failed - app may still work in dev mode" -ForegroundColor Yellow
}

# -----------------------------------------------------------------------------
# Verify Installation
# -----------------------------------------------------------------------------

Write-Host ""
Write-Host "[6/6] Verifying installation..." -ForegroundColor Yellow

$checks = @{
    "package.json" = "Project manifest"
    "node_modules" = "Dependencies"
    ".env" = "Environment config"
    "src/server.js" = "Server entry point"
}

$allOk = $true
foreach ($file in $checks.Keys) {
    if (Test-Path $file) {
        Write-Host "  [OK] $($checks[$file])" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] $($checks[$file]) missing ($file)" -ForegroundColor Red
        $allOk = $false
    }
}

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($allOk) {
    Write-Host "Next steps:" -ForegroundColor White
    Write-Host ""
    Write-Host "  1. Edit .env to add your API keys (optional for Ollama-only use)" -ForegroundColor Gray
    Write-Host "  2. Install Ollama from https://ollama.ai (if not installed)" -ForegroundColor Gray
    Write-Host "  3. Pull AI models:" -ForegroundColor Gray
    Write-Host "       ollama pull qwen3:14b" -ForegroundColor Cyan
    Write-Host "       ollama pull snowflake-arctic-embed:l" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  4. Start the application:" -ForegroundColor Gray
    Write-Host "       npm start" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  5. Open in browser:" -ForegroundColor Gray
    Write-Host "       http://localhost:3005" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host "[WARN] Some checks failed. Please review the errors above." -ForegroundColor Yellow
}
