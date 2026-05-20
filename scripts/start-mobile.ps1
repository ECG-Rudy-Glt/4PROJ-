# =============================================================================
# SUPFILE Mobile - Expo Development Script (Windows PowerShell)
# =============================================================================
# Usage:
#   .\start-mobile.ps1              Start Expo dev server
#   .\start-mobile.ps1 -Platform android    Run on Android
#   .\start-mobile.ps1 -Platform web        Run in web browser
#   .\start-mobile.ps1 -InstallOnly         Install dependencies only
#   .\start-mobile.ps1 -Clean               Clean cache and reinstall
#   .\start-mobile.ps1 -Tunnel              Start with tunnel mode
# =============================================================================

param(
    [ValidateSet("default", "android", "web")]
    [string]$Platform = "default",
    [switch]$InstallOnly,
    [switch]$Clean,
    [switch]$Tunnel,
    [int]$Port = 8081
)

$ErrorActionPreference = "Stop"

# Disable Expo telemetry prompts (anonymous mode question)
$env:EXPO_NO_TELEMETRY = "1"
$env:CI = "0"

# Navigate to project root
Set-Location -Path "$PSScriptRoot\.."
$ProjectRoot = Get-Location
$MobileDir = Join-Path $ProjectRoot "mobile"

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  SUPFILE Mobile - Expo Development" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# -----------------------------------------------------------------------------
# Prerequisites Check
# -----------------------------------------------------------------------------
function Test-Prerequisites {
    Write-Host "Checking prerequisites..." -ForegroundColor Yellow

    # Check Node.js
    $nodeVersion = $null
    try {
        $nodeVersion = node --version 2>$null
    } catch {}

    if (-not $nodeVersion) {
        Write-Host ""
        Write-Host "ERROR: Node.js is not installed!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please install Node.js from: https://nodejs.org/" -ForegroundColor Yellow
        Write-Host "Recommended version: LTS (v20+)" -ForegroundColor Yellow
        Write-Host ""
        exit 1
    }
    Write-Host "  Node.js: $nodeVersion" -ForegroundColor Green

    # Check npm
    $npmVersion = $null
    try {
        $npmVersion = npm --version 2>$null
    } catch {}

    if (-not $npmVersion) {
        Write-Host ""
        Write-Host "ERROR: npm is not installed!" -ForegroundColor Red
        Write-Host ""
        exit 1
    }
    Write-Host "  npm: v$npmVersion" -ForegroundColor Green

    # Check if mobile directory exists
    if (-not (Test-Path $MobileDir)) {
        Write-Host ""
        Write-Host "ERROR: Mobile directory not found at $MobileDir" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Mobile directory: OK" -ForegroundColor Green
    Write-Host ""
}

# -----------------------------------------------------------------------------
# Port Management
# -----------------------------------------------------------------------------
function Test-PortInUse {
    param([int]$Port)
    $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    return $null -ne $connection
}

function Stop-ProcessOnPort {
    param([int]$PortNum)
    $connections = Get-NetTCPConnection -LocalPort $PortNum -ErrorAction SilentlyContinue
    if ($connections) {
        $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($procId in $processIds) {
            try {
                $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
                if ($proc) {
                    Write-Host "  Killing process $($proc.ProcessName) (PID: $procId) on port $PortNum" -ForegroundColor Yellow
                    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                }
            } catch {}
        }
        Start-Sleep -Milliseconds 500
    }
}

function Get-AvailablePort {
    param([int]$StartPort = 8081)
    $port = $StartPort
    while ($port -lt ($StartPort + 10)) {
        if (-not (Test-PortInUse -Port $port)) {
            return $port
        }
        $port++
    }
    return $StartPort
}

# -----------------------------------------------------------------------------
# IP Detection
# -----------------------------------------------------------------------------
function Get-LocalIP {
    # Try resolving via default internet gateway route first to get the active internet interface
    try {
        $route = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($route) {
            $ip = (Get-NetIPAddress -InterfaceIndex $route.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1).IPAddress
            if ($ip) {
                return $ip
            }
        }
    } catch {}

    $addresses = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
        ($_.IPAddress -notmatch "^127\.") -and
        ($_.IPAddress -notmatch "^169\.254\.") -and
        ($_.PrefixOrigin -ne "WellKnown")
    }
    $ip = ($addresses | Select-Object -First 1).IPAddress
    if (-not $ip) {
        $ipconfig = ipconfig.exe 2>$null | Select-String "IPv4" | Select-Object -First 1
        if ($ipconfig) {
            $ip = ($ipconfig -split ":")[-1].Trim()
        }
    }
    return $ip
}

# -----------------------------------------------------------------------------
# Environment Setup
# -----------------------------------------------------------------------------
function Set-MobileEnv {
    param([string]$IP)

    $envFile = Join-Path $MobileDir ".env"
    $envExampleFile = Join-Path $MobileDir ".env.example"

    # Create .env if it doesn't exist
    if (-not (Test-Path $envFile)) {
        if (Test-Path $envExampleFile) {
            Copy-Item $envExampleFile $envFile
            Write-Host "Created mobile/.env from .env.example" -ForegroundColor Green
        } else {
            # Create minimal .env
            "" | Set-Content $envFile
        }
    }

    # Update EXPO_PUBLIC_API_URL
    $content = Get-Content $envFile -Raw
    $apiUrl = "http://${IP}:5001/api"

    if ($content -match "EXPO_PUBLIC_API_URL=") {
        $content = $content -replace "EXPO_PUBLIC_API_URL=.*", "EXPO_PUBLIC_API_URL=$apiUrl"
    } else {
        $content = $content.TrimEnd() + "`nEXPO_PUBLIC_API_URL=$apiUrl`n"
    }

    $content | Set-Content $envFile -NoNewline
    Write-Host "Updated mobile/.env with API URL: $apiUrl" -ForegroundColor Green
}

# -----------------------------------------------------------------------------
# Dependency Installation
# -----------------------------------------------------------------------------
function Install-Dependencies {
    param([bool]$Force = $false)

    $nodeModulesDir = Join-Path $MobileDir "node_modules"
    $packageLockFile = Join-Path $MobileDir "package-lock.json"

    $needsInstall = $Force -or (-not (Test-Path $nodeModulesDir))

    if (-not $needsInstall) {
        # Check if package.json is newer than node_modules
        $packageJsonFile = Join-Path $MobileDir "package.json"
        if ((Test-Path $packageJsonFile) -and (Test-Path $nodeModulesDir)) {
            $packageJsonTime = (Get-Item $packageJsonFile).LastWriteTime
            $nodeModulesTime = (Get-Item $nodeModulesDir).LastWriteTime
            if ($packageJsonTime -gt $nodeModulesTime) {
                $needsInstall = $true
                Write-Host "package.json has changed, reinstalling dependencies..." -ForegroundColor Yellow
            }
        }
    }

    if ($needsInstall) {
        Write-Host "Installing mobile dependencies..." -ForegroundColor Yellow
        Write-Host "This may take a few minutes on first install." -ForegroundColor Gray
        Write-Host ""

        Push-Location $MobileDir
        try {
            npm install
            if ($LASTEXITCODE -ne 0) {
                Write-Host "ERROR: npm install failed!" -ForegroundColor Red
                exit 1
            }
            Write-Host ""
            Write-Host "Dependencies installed successfully!" -ForegroundColor Green
        } finally {
            Pop-Location
        }
    } else {
        Write-Host "Dependencies already installed." -ForegroundColor Green
    }
}

# -----------------------------------------------------------------------------
# Clean Cache
# -----------------------------------------------------------------------------
function Clear-MobileCache {
    Write-Host "Cleaning mobile cache..." -ForegroundColor Yellow

    Push-Location $MobileDir
    try {
        # Remove node_modules
        $nodeModulesDir = Join-Path $MobileDir "node_modules"
        if (Test-Path $nodeModulesDir) {
            Write-Host "  Removing node_modules..." -ForegroundColor Gray
            Remove-Item -Recurse -Force $nodeModulesDir
        }

        # Remove .expo
        $expoDir = Join-Path $MobileDir ".expo"
        if (Test-Path $expoDir) {
            Write-Host "  Removing .expo cache..." -ForegroundColor Gray
            Remove-Item -Recurse -Force $expoDir
        }

        # Clear npm cache
        Write-Host "  Clearing npm cache..." -ForegroundColor Gray
        npm cache clean --force 2>$null

        Write-Host "Cache cleared!" -ForegroundColor Green
        Write-Host ""
    } finally {
        Pop-Location
    }
}

# -----------------------------------------------------------------------------
# Start Expo
# -----------------------------------------------------------------------------
function Start-Expo {
    param(
        [string]$IP,
        [string]$Platform,
        [bool]$UseTunnel,
        [int]$ExpoPort = 8081
    )

    Push-Location $MobileDir
    try {
        # Set environment variable for React Native packager
        $env:REACT_NATIVE_PACKAGER_HOSTNAME = $IP

        # Build expo command
        $expoArgs = @("expo", "start", "--clear", "--port", $ExpoPort)

        if ($UseTunnel) {
            $expoArgs += "--tunnel"
        }

        switch ($Platform) {
            "android" { $expoArgs += "--android" }
            "web" { $expoArgs += "--web" }
        }

        Write-Host ""
        Write-Host "=========================================" -ForegroundColor Cyan
        Write-Host "  Starting Expo Development Server" -ForegroundColor Cyan
        Write-Host "=========================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  Local IP: $IP" -ForegroundColor White
        Write-Host "  Port:     $ExpoPort" -ForegroundColor White
        Write-Host "  Backend:  http://${IP}:5001" -ForegroundColor White
        if ($UseTunnel) {
            Write-Host "  Mode:     Tunnel (for external access)" -ForegroundColor White
        }
        Write-Host ""
        Write-Host "  Press 'a' for Android, 'w' for Web, 'r' to reload" -ForegroundColor Gray
        Write-Host "  Press 'q' or Ctrl+C to quit" -ForegroundColor Gray
        Write-Host ""

        # Run Expo
        & npx $expoArgs
    } finally {
        Pop-Location
    }
}

# =============================================================================
# Main Execution
# =============================================================================

# Check prerequisites
Test-Prerequisites

# Handle clean mode
if ($Clean) {
    Clear-MobileCache
    Install-Dependencies -Force $true
    if (-not $InstallOnly) {
        # Continue to start Expo after clean install
    } else {
        Write-Host ""
        Write-Host "Mobile dependencies reinstalled successfully!" -ForegroundColor Green
        exit 0
    }
}

# Detect IP
Write-Host "Detecting local IP address..." -ForegroundColor Yellow
$DetectedIP = Get-LocalIP

if ($DetectedIP) {
    Write-Host "IP detected: $DetectedIP" -ForegroundColor Green
    $FinalIP = $DetectedIP
} else {
    Write-Host "Could not auto-detect IP, using localhost" -ForegroundColor Yellow
    $FinalIP = "localhost"
}

Write-Host ""

# Handle port
Write-Host "Checking port $Port..." -ForegroundColor Yellow
if (Test-PortInUse -Port $Port) {
    Write-Host "Port $Port is in use, killing existing process..." -ForegroundColor Yellow
    Stop-ProcessOnPort -Port $Port
    Start-Sleep -Milliseconds 500

    # Recheck if port is now free
    if (Test-PortInUse -Port $Port) {
        $Port = Get-AvailablePort -StartPort ($Port + 1)
        Write-Host "Using alternative port: $Port" -ForegroundColor Yellow
    } else {
        Write-Host "Port $Port is now available" -ForegroundColor Green
    }
} else {
    Write-Host "Port $Port is available" -ForegroundColor Green
}

Write-Host ""

# Setup environment
Set-MobileEnv -IP $FinalIP

# Install dependencies if needed
Install-Dependencies

# Exit if install-only mode
if ($InstallOnly) {
    Write-Host ""
    Write-Host "Mobile dependencies installed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "To start the development server, run:" -ForegroundColor Gray
    Write-Host "  make mobile" -ForegroundColor White
    exit 0
}

# Start Expo
Start-Expo -IP $FinalIP -Platform $Platform -UseTunnel $Tunnel.IsPresent -ExpoPort $Port
