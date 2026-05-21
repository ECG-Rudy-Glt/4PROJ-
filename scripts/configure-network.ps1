Set-Location -Path "$PSScriptRoot\.."

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Configuration Reseau SUPFILE" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

function Get-LocalIP {
    $addresses = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
        ($_.IPAddress -notmatch "^127\.") -and
        ($_.IPAddress -notmatch "^169\.254\.") -and
        ($_.PrefixOrigin -ne "WellKnown")
    }
    $ip = ($addresses | Select-Object -First 1).IPAddress
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

Write-Host "Detection de votre adresse IP..." -ForegroundColor Yellow
$DetectedIP = Get-LocalIP

if ($DetectedIP) {
    Write-Host "OK Adresse IP detectee : $DetectedIP" -ForegroundColor Green
    Write-Host ""
    $UseDetected = Read-Host "Utiliser cette adresse IP ? (O/n)"

    if ($UseDetected -match "^[Nn]$") {
        $FinalIP = Read-Host "Entrez votre adresse IP manuellement"
    } else {
        $FinalIP = $DetectedIP
    }
} else {
    Write-Host "Impossible de detecter automatiquement votre IP" -ForegroundColor Yellow
    Write-Host ""
    $FinalIP = Read-Host "Entrez votre adresse IP manuellement"
}

Write-Host ""
Write-Host "Configuration avec l'IP : $FinalIP" -ForegroundColor Cyan
Write-Host ""

if (Test-Path ".env") {
    Write-Host "Mise a jour du fichier .env..." -ForegroundColor Yellow
    Copy-Item ".env" ".env.backup" -Force

    $content = Get-Content ".env"
    $content = Set-EnvValue -Key "HOST_IP" -Value $FinalIP -Content $content
    $content = Set-EnvValue -Key "API_URL" -Value "http://${FinalIP}:5001" -Content $content
    $content = Set-EnvValue -Key "FRONTEND_URL" -Value "http://${FinalIP}:3000" -Content $content
    $content = Set-EnvValue -Key "ONLYOFFICE_PUBLIC_URL" -Value "http://${FinalIP}:8080" -Content $content
    $content = Set-EnvValue -Key "VITE_API_URL" -Value "http://${FinalIP}:5001" -Content $content
    $content | Set-Content ".env"

    Write-Host "OK Fichier .env mis a jour" -ForegroundColor Green
} else {
    Write-Host "Fichier .env introuvable" -ForegroundColor Red
    Write-Host "  Pour le dev, lancez ./scripts/hot-start.sh pour creer .env depuis .env.example."
    exit 1
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Configuration terminee !" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Prochaines etapes :" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Assurez-vous que le pare-feu Windows autorise les ports 3000, 5001 et 8080"
Write-Host "   Vous pouvez le faire avec ces commandes (en tant qu'administrateur) :"
Write-Host "   netsh advfirewall firewall add rule name=`"SUPFILE Frontend`" dir=in action=allow protocol=TCP localport=3000" -ForegroundColor Gray
Write-Host "   netsh advfirewall firewall add rule name=`"SUPFILE Backend`" dir=in action=allow protocol=TCP localport=5001" -ForegroundColor Gray
Write-Host "   netsh advfirewall firewall add rule name=`"SUPFILE OnlyOffice`" dir=in action=allow protocol=TCP localport=8080" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Demarrez l'application :"
Write-Host "   Dev hot reload : ./scripts/hot-start.sh"
Write-Host "   Prod locale    : ./scripts/START.sh"
Write-Host ""
Write-Host "3. Accedez a l'application :"
Write-Host "   - Depuis cette machine : http://${FinalIP}:3000"
Write-Host "   - Depuis un autre PC du reseau : http://${FinalIP}:3000"
Write-Host "   - OnlyOffice : http://${FinalIP}:8080"
Write-Host ""

$ConfigureFirewall = Read-Host "Voulez-vous configurer automatiquement le pare-feu Windows ? (O/n)"
if ($ConfigureFirewall -notmatch "^[Nn]$") {
    Write-Host ""
    Write-Host "Configuration du pare-feu..." -ForegroundColor Yellow

    try {
        $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

        if (-not $isAdmin) {
            Write-Host "Ce script doit etre execute en tant qu'administrateur pour configurer le pare-feu" -ForegroundColor Yellow
            Write-Host "  Redemarrez PowerShell en tant qu'administrateur et reessayez" -ForegroundColor Yellow
        } else {
            Remove-NetFirewallRule -DisplayName "SUPFILE Frontend" -ErrorAction SilentlyContinue
            Remove-NetFirewallRule -DisplayName "SUPFILE Backend" -ErrorAction SilentlyContinue
            Remove-NetFirewallRule -DisplayName "SUPFILE OnlyOffice" -ErrorAction SilentlyContinue

            New-NetFirewallRule -DisplayName "SUPFILE Frontend" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow | Out-Null
            New-NetFirewallRule -DisplayName "SUPFILE Backend" -Direction Inbound -Protocol TCP -LocalPort 5001 -Action Allow | Out-Null
            New-NetFirewallRule -DisplayName "SUPFILE OnlyOffice" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow | Out-Null

            Write-Host "OK Pare-feu configure avec succes" -ForegroundColor Green
        }
    } catch {
        Write-Host "Erreur lors de la configuration du pare-feu : $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Appuyez sur une touche pour continuer..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
