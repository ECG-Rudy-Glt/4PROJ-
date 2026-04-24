# Script de configuration réseau pour SUPFILE (Windows PowerShell)
# Ce script aide à configurer l'application pour l'accès réseau local

# Se placer à la racine du projet
Set-Location -Path "$PSScriptRoot\.."

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Configuration Réseau SUPFILE" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Fonction pour détecter l'IP de la machine
function Get-LocalIP {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
        $_.IPAddress -notmatch "^127\." -and
        $_.IPAddress -notmatch "^169\.254\." -and
        $_.PrefixOrigin -ne "WellKnown"
    } | Select-Object -First 1).IPAddress
    return $ip
}

Write-Host "Détection de votre adresse IP..." -ForegroundColor Yellow
$DetectedIP = Get-LocalIP

if ($DetectedIP) {
    Write-Host "✓ Adresse IP détectée : $DetectedIP" -ForegroundColor Green
    Write-Host ""
    $UseDetected = Read-Host "Utiliser cette adresse IP ? (O/n)"

    if ($UseDetected -match "^[Nn]$") {
        $CustomIP = Read-Host "Entrez votre adresse IP manuellement"
        $FinalIP = $CustomIP
    } else {
        $FinalIP = $DetectedIP
    }
} else {
    Write-Host "⚠ Impossible de détecter automatiquement votre IP" -ForegroundColor Yellow
    Write-Host ""
    $CustomIP = Read-Host "Entrez votre adresse IP manuellement"
    $FinalIP = $CustomIP
}

Write-Host ""
Write-Host "Configuration avec l'IP : $FinalIP" -ForegroundColor Cyan
Write-Host ""

# Mise à jour du fichier .env
if (Test-Path ".env") {
    Write-Host "Mise à jour du fichier .env..." -ForegroundColor Yellow

    # Backup de l'ancien fichier
    Copy-Item ".env" ".env.backup" -Force

    # Lecture du contenu
    $content = Get-Content ".env"

    # Mise à jour des variables
    $content = $content -replace "HOST_IP=.*", "HOST_IP=$FinalIP"
    $content = $content -replace "API_URL=.*", "API_URL=http://${FinalIP}:5001"
    $content = $content -replace "FRONTEND_URL=.*", "FRONTEND_URL=http://${FinalIP}:3000"

    # Écriture du contenu mis à jour
    $content | Set-Content ".env"

    Write-Host "✓ Fichier .env mis à jour" -ForegroundColor Green
} else {
    Write-Host "✗ Fichier .env introuvable" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Configuration terminée !" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Prochaines étapes :" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Assurez-vous que le pare-feu Windows autorise les ports 3000 et 5001"
Write-Host "   Vous pouvez le faire avec ces commandes (en tant qu'administrateur) :"
Write-Host "   netsh advfirewall firewall add rule name=`"SUPFILE Frontend`" dir=in action=allow protocol=TCP localport=3000" -ForegroundColor Gray
Write-Host "   netsh advfirewall firewall add rule name=`"SUPFILE Backend`" dir=in action=allow protocol=TCP localport=5001" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Démarrez l'application avec :"
Write-Host "   docker compose down"
Write-Host "   docker compose up -d --build"
Write-Host ""
Write-Host "3. Accédez à l'application :"
Write-Host "   - Depuis cette machine : http://${FinalIP}:3000"
Write-Host "   - Depuis un autre PC du réseau : http://${FinalIP}:3000"
Write-Host ""
Write-Host "Pour plus d'informations, consultez CONFIGURATION_RESEAU.md" -ForegroundColor Cyan
Write-Host ""

# Demander si l'utilisateur veut configurer le pare-feu automatiquement
$ConfigureFirewall = Read-Host "Voulez-vous configurer automatiquement le pare-feu Windows ? (O/n)"
if ($ConfigureFirewall -notmatch "^[Nn]$") {
    Write-Host ""
    Write-Host "Configuration du pare-feu..." -ForegroundColor Yellow

    try {
        # Vérifier si le script est exécuté en tant qu'administrateur
        $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

        if (-not $isAdmin) {
            Write-Host "⚠ Ce script doit être exécuté en tant qu'administrateur pour configurer le pare-feu" -ForegroundColor Yellow
            Write-Host "  Redémarrez PowerShell en tant qu'administrateur et réessayez" -ForegroundColor Yellow
        } else {
            # Supprimer les règles existantes si elles existent
            Remove-NetFirewallRule -DisplayName "SUPFILE Frontend" -ErrorAction SilentlyContinue
            Remove-NetFirewallRule -DisplayName "SUPFILE Backend" -ErrorAction SilentlyContinue

            # Créer les nouvelles règles
            New-NetFirewallRule -DisplayName "SUPFILE Frontend" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow | Out-Null
            New-NetFirewallRule -DisplayName "SUPFILE Backend" -Direction Inbound -Protocol TCP -LocalPort 5001 -Action Allow | Out-Null

            Write-Host "✓ Pare-feu configuré avec succès" -ForegroundColor Green
        }
    } catch {
        Write-Host "✗ Erreur lors de la configuration du pare-feu : $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Appuyez sur une touche pour continuer..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
