# AeroGlide - PowerShell Launcher
Clear-Host
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "  AeroGlide - Flight Path Animator Launcher" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Python is installed
try {
    $ver = python --version 2>&1
    Write-Host "[INFO] Found Python: $ver" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Python is not installed or not in PATH." -ForegroundColor Red
    Read-Host "Press Enter to exit..."
    exit 1
}

# Create virtual environment if it doesn't exist
if (-not (Test-Path "venv")) {
    Write-Host "[INFO] Creating Python virtual environment (venv)..." -ForegroundColor Yellow
    python -m venv venv
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to create virtual environment." -ForegroundColor Red
        Read-Host "Press Enter to exit..."
        exit 1
    }
    Write-Host "[INFO] Virtual environment created successfully." -ForegroundColor Green
}

# Activate venv and install/upgrade dependencies
Write-Host "[INFO] Installing/upgrading dependencies in virtual environment..." -ForegroundColor Yellow
& .\venv\Scripts\python.exe -m pip install --upgrade pip
& .\venv\Scripts\python.exe -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to install dependencies from requirements.txt." -ForegroundColor Red
    Read-Host "Press Enter to exit..."
    exit 1
}
Write-Host "[INFO] Dependencies installed successfully." -ForegroundColor Green

# Open default browser to the app
Write-Host "[INFO] Launching default web browser to http://127.0.0.1:5000 ..." -ForegroundColor Yellow
Start-Process "http://127.0.0.1:5000"

# Start the Flask app
Write-Host "[INFO] Starting Flask server..." -ForegroundColor Green
& .\venv\Scripts\python.exe app.py
