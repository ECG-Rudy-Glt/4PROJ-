#Requires -Version 5.1
param(
    [switch]$Ai
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

Set-Location -Path "$PSScriptRoot\.."

$ComposeFile = "docker-compose.yml"

Write-Host "SUPFILE - Production Locale"

$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker is not running. Please start Docker first."
    exit 1
}

if (docker compose version 2>&1 | Select-String -Quiet 'version') {
    $DockerCompose = 'docker compose'
} elseif (Get-Command docker-compose -ErrorAction SilentlyContinue) {
    $DockerCompose = 'docker-compose'
} else {
    Write-Error "Docker Compose is not installed."
    exit 1
}

function Get-EnvValue {
    param([string]$Key)
    $line = Get-Content .env | Where-Object { $_ -match "^$Key=" } | Select-Object -Last 1
    if ($line) { return $line.Substring($Key.Length + 1) }
    return $null
}

function Require-Env {
    param([string]$Key)
    $value = Get-EnvValue $Key
    if (-not $value) {
        Write-Error "Variable .env requise manquante ou vide: $Key"
        exit 1
    }
}

if (-not (Test-Path ".env")) {
    Write-Error "Fichier .env introuvable. Copiez .env.example vers .env puis renseignez les secrets."
    exit 1
}

@(
    'POSTGRES_PASSWORD', 'POSTGRES_APP_PASSWORD',
    'MINIO_ROOT_USER', 'MINIO_ROOT_PASSWORD',
    'MINIO_APP_ACCESS_KEY', 'MINIO_APP_SECRET_KEY',
    'JWT_SECRET', 'JWT_MFA_SECRET',
    'DEK_WRAP_SECRET', 'FILE_ENCRYPTION_KEY',
    'ONLYOFFICE_JWT_SECRET', 'MFA_ENCRYPTION_KEY'
) | ForEach-Object { Require-Env $_ }

$mfaKey = Get-EnvValue 'MFA_ENCRYPTION_KEY'
if ($mfaKey -notmatch '^[0-9a-fA-F]{64}$') {
    Write-Error "MFA_ENCRYPTION_KEY doit etre une chaine hexadecimale de 64 caracteres. Generation: openssl rand -hex 32"
    exit 1
}

$frontendPort = Get-EnvValue 'FRONTEND_PORT'
$backendPort  = Get-EnvValue 'BACKEND_PORT'
$onlyofficePort = Get-EnvValue 'ONLYOFFICE_PORT'
if (-not $frontendPort)   { $frontendPort   = '3000' }
if (-not $backendPort)    { $backendPort    = '5001' }
if (-not $onlyofficePort) { $onlyofficePort = '8080' }

Write-Host "Build et demarrage..."

$composeArgs = @('-f', $ComposeFile)
if ($Ai -or $env:AI -eq "1") {
    $composeArgs += @('--profile', 'ai')
    Write-Host "Activation du profil AI..." -ForegroundColor Green
}
$composeArgs += @('up', '-d', '--build')
& docker compose @composeArgs
if ($LASTEXITCODE -ne 0) {
    Write-Error "Echec du demarrage. Consultez les logs: docker compose -f $ComposeFile logs --tail=200"
    exit 1
}

Start-Sleep -Seconds 10

Write-Host ""
Write-Host "SUPFILE est demarre en production locale."
Write-Host ""
Write-Host "Acces:"
Write-Host "  Frontend   : http://localhost:$frontendPort"
Write-Host "  Backend API: http://localhost:$backendPort"
Write-Host "  OnlyOffice : http://localhost:$onlyofficePort"
Write-Host ""
Write-Host "Logs:"
Write-Host "  docker compose -f $ComposeFile logs -f"
Write-Host ""
Write-Host "Arreter:"
Write-Host "  docker compose -f $ComposeFile down"
