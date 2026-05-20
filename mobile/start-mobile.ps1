# Script de demarrage pour Expo Mobile (Windows PowerShell)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

Set-Location -Path $PSScriptRoot

function Get-LocalIP {
    # Essaye de trouver l'IP liee a la route par defaut (internet/passerelle)
    $route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($route) {
        $ip = (Get-NetIPAddress -InterfaceIndex $route.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue).IPAddress
        if ($ip) { return $ip }
    }
    
    # Fallback sur les interfaces physiques non-virtuelles
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
    return ($addresses | Select-Object -First 1).IPAddress
}

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  SUPFILE - Expo Mobile Start" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Detection de l'adresse IP reseau active..." -ForegroundColor Yellow
$DetectedIP = Get-LocalIP

if ($DetectedIP) {
    Write-Host "Adresse IP reseau active detectee : $DetectedIP" -ForegroundColor Green
    $FinalIP = $DetectedIP
} else {
    Write-Host "Attention: Impossible de detecter automatiquement votre IP active. Utilisation de localhost." -ForegroundColor Yellow
    $FinalIP = "localhost"
}

if (-not $FinalIP) {
    Write-Error "Adresse IP non valide."
    exit 1
}

# Mise a jour du fichier .env
$envFile = ".env"
$apiVal = "EXPO_PUBLIC_API_URL=http://${FinalIP}:5001/api"
Set-Content -Path $envFile -Value $apiVal
Write-Host ".env mis a jour : $apiVal" -ForegroundColor Green

# Lancement d'Expo avec la bonne variable d'environnement pour l'IP reseau
Write-Host "Lancement d'Expo sur l'IP $FinalIP..." -ForegroundColor Yellow
$env:REACT_NATIVE_PACKAGER_HOSTNAME = $FinalIP
npx expo start --clear
