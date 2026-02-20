# Clean Start Script
# Kills stale processes, rebuilds frontend, and starts the application.

Write-Host "========= GODMODE CLEAN START =========" -ForegroundColor Cyan

# 1. Kill processes on known ports
$ports = @(3005, 3050, 8080, 8081, 8082, 8083, 8084, 8085)

foreach ($port in $ports) {
    $process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "Killing process on port $port..." -ForegroundColor Yellow
        try {
            $process | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
            Write-Host "  - Port $port cleared." -ForegroundColor Green
        } catch {
            Write-Host "  - Failed to clear port $port. It might be already gone." -ForegroundColor DarkGray
        }
    } else {
        Write-Host "Port $port is free." -ForegroundColor DarkGray
    }
}

# 2. Rebuild Frontend
Write-Host "`nBuilding Frontend..." -ForegroundColor Cyan
try {
    npm run build:frontend
    if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }
    Write-Host "Frontend built successfully." -ForegroundColor Green
} catch {
    Write-Host "Frontend build failed!" -ForegroundColor Red
    exit 1
}

# 3. Start Application
Write-Host "`nStarting Application..." -ForegroundColor Cyan
# Using start-and-open.js which handles launching the browser and server
node scripts/start-and-open.js
