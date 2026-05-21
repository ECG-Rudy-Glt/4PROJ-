# Script de demarrage avec Hot Reload pour SUPFILE (Windows PowerShell)

Set-Location -Path "$PSScriptRoot\.."

$ComposeFile = "docker-compose.dev.yml"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  SUPFILE - Hot Reload Dev Start" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker is not running. Please start Docker first."
    exit 1
}

function Get-LocalIP {
    $route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($route) {
        $ip = (Get-NetIPAddress -InterfaceIndex $route.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue).IPAddress
        if ($ip) { return $ip }
    }
    
    $addresses = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
        ($_.IPAddress -notmatch "^127\.") -and
        ($_.IPAddress -notmatch "^169\.254\.") -and
        ($_.InterfaceAlias -notmatch "VMware") -and
        ($_.InterfaceAlias -notmatch "WSL") -and
        ($_.InterfaceAlias -notmatch "vEthernet") -and
        ($_.InterfaceAlias -notmatch "Virtual") -and
        ($_.InterfaceAlias -notmatch "Loopback") -and
        ($_.InterfaceAlias -notmatch "Bluetooth")
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

function Set-EnvValue {
    param(
        [string]$Key,
        [string]$Value,
        [string[]]$Content
    )
    $pattern = "^$([regex]::Escape($Key))=.*"
    if ($Content -match $pattern) {
        return $Content -replace $pattern, "$Key=$Value"
    }
    return @($Content + "$Key=$Value")
}

function Get-EnvValue {
    param([string]$Key)
    $line = Get-Content .env -ErrorAction SilentlyContinue | Where-Object { $_ -match "^$Key=" } | Select-Object -Last 1
    if ($line) { return $line.Substring($Key.Length + 1) }
    return $null
}

function Generate-HexKey {
    $bytes = New-Object Byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return ($bytes | ForEach-Object { "{0:x2}" -f $_ }) -join ""
}

Write-Host "Detection de votre adresse IP..." -ForegroundColor Yellow
$DetectedIP = Get-LocalIP

if ($DetectedIP) {
    Write-Host "Adresse IP detectee : $DetectedIP" -ForegroundColor Green
    Write-Host ""
    $UseDetected = Read-Host "Utiliser cette adresse IP ? (O/n)"
    if ($UseDetected -match "^[Nn]$") {
        $FinalIP = Read-Host "Entrez votre adresse IP manuellement"
    } else {
        $FinalIP = $DetectedIP
    }
} else {
    Write-Host "Attention: Impossible de detecter automatiquement votre IP" -ForegroundColor Yellow
    Write-Host ""
    $FinalIP = Read-Host "Entrez votre adresse IP manuellement"
}

if (-not (Test-Path ".env")) {
    if (-not (Test-Path ".env.example")) {
        Write-Error "Error: Fichier .env.example introuvable"
        exit 1
    }
    Copy-Item ".env.example" ".env"
    Write-Host "Fichier .env cree depuis .env.example" -ForegroundColor Green
}

Copy-Item ".env" ".env.backup" -Force
$content = Get-Content ".env"
$content = Set-EnvValue -Key "HOST_IP" -Value $FinalIP -Content $content
$content = Set-EnvValue -Key "API_URL" -Value "http://${FinalIP}:5001" -Content $content
$content = Set-EnvValue -Key "FRONTEND_URL" -Value "http://${FinalIP}:3000" -Content $content
$content = Set-EnvValue -Key "ONLYOFFICE_PUBLIC_URL" -Value "http://${FinalIP}:8080" -Content $content
$content = Set-EnvValue -Key "VITE_API_URL" -Value "http://${FinalIP}:5001" -Content $content

$mfaKey = Get-EnvValue "MFA_ENCRYPTION_KEY"
if ($mfaKey -notmatch '^[0-9a-fA-F]{64}$') {
    $newMfaKey = Generate-HexKey
    $content = Set-EnvValue -Key "MFA_ENCRYPTION_KEY" -Value $newMfaKey -Content $content
    Write-Host "MFA_ENCRYPTION_KEY dev generee" -ForegroundColor Green
}

$content | Set-Content ".env"
Write-Host "Fichier .env mis a jour avec l'IP : $FinalIP" -ForegroundColor Green
Write-Host ""

Write-Host "Nettoyage des conteneurs existants..." -ForegroundColor Yellow
docker compose -f $ComposeFile down --remove-orphans -v 2>$null
docker compose -f docker-compose.yml down --remove-orphans -v 2>$null
docker rm -f supfile-frontend supfile-backend supfile-postgres supfile-onlyoffice supfile-minio supfile-minio-init supfile-minio-permissions supfile-brain supfile-ollama 2>$null

Write-Host "Demarrage en mode hot reload..." -ForegroundColor Yellow
docker compose -f $ComposeFile up -d --build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Echec du demarrage. Consultez les logs: docker compose -f $ComposeFile logs --tail=200"
    exit 1
}

Write-Host "Attente du demarrage des services..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "Synchronisation du schema de base de donnees (Prisma)..." -ForegroundColor Yellow
docker compose -f $ComposeFile exec backend npx prisma db push
if ($LASTEXITCODE -ne 0) {
    Write-Warning "La synchronisation Prisma a echoue. La base de donnees n'est peut-etre pas encore prete. Vous pourrez reessayer plus tard avec 'make db-push'"
}

Write-Host ""
Write-Host "SUPFILE est demarre en mode hot reload !" -ForegroundColor Green
Write-Host ""
Write-Host "Acces :"
Write-Host "   Frontend  : http://localhost:3000  (ou http://${FinalIP}:3000)"
Write-Host "   Backend   : http://localhost:5001  (ou http://${FinalIP}:5001)"
Write-Host "   OnlyOffice: http://localhost:8080  (ou http://${FinalIP}:8080)"
Write-Host "   MinIO     : http://localhost:9001"
Write-Host ""
Write-Host "Hot reload actif :"
Write-Host "   Backend  -> tsx watch (redemarre a chaque modif dans backend/src/)"
Write-Host "   Frontend -> Vite HMR  (applique les modifs sans rechargement de page)"
Write-Host ""
Write-Host "Logs en direct :"
Write-Host "   docker compose -f $ComposeFile logs -f"
Write-Host ""
Write-Host "Arreter :"
Write-Host "   docker compose -f $ComposeFile down"
Write-Host ""
