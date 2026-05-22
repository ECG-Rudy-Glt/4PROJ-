#!/bin/bash
set -euo pipefail

# =============================================================================
#  SUPFile — Installation initiale du VPS de production
#  Usage : ssh root@supfile.tech 'bash -s' < scripts/setup-vps.sh
# =============================================================================

if [ "$EUID" -ne 0 ]; then
    echo "Relancement avec sudo..."
    exec sudo bash "$0" "$@"
fi

DOMAIN="supfile.tech"
EMAIL="contact@supfile.tech"
DEPLOY_DIR="/opt/supfile"

echo ""
echo "========================================================"
echo "  SUPFile — Installation VPS Production"
echo "========================================================"
echo ""

# ------------------------------------------------------------------
# 1. Mise à jour système
# ------------------------------------------------------------------
echo "[1/7] Mise à jour du système..."
apt update -y && apt upgrade -y

# ------------------------------------------------------------------
# 2. Installation de Docker
# ------------------------------------------------------------------
echo "[2/7] Installation de Docker..."
if command -v docker &> /dev/null; then
    echo "  Docker déjà installé ($(docker --version))"
else
    apt install -y ca-certificates curl gnupg lsb-release
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL "https://download.docker.com/linux/$(. /etc/os-release && echo "$ID")/gpg" \
        | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$(. /etc/os-release && echo "$ID") \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt update -y
    apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    echo "  Docker installé ($(docker --version))"
fi

# ------------------------------------------------------------------
# 3. Installation de Certbot
# ------------------------------------------------------------------
echo "[3/7] Installation de Certbot..."
if command -v certbot &> /dev/null; then
    echo "  Certbot déjà installé"
else
    apt install -y certbot
    echo "  Certbot installé"
fi

# ------------------------------------------------------------------
# 4. Certificat SSL Let's Encrypt
# ------------------------------------------------------------------
echo "[4/7] Obtention du certificat SSL pour $DOMAIN..."

# Arrêter tout ce qui écoute sur le port 80/443
systemctl stop nginx 2>/dev/null || true
systemctl stop apache2 2>/dev/null || true
docker stop supfile-vps-proxy 2>/dev/null || true
docker stop supfile-landing 2>/dev/null || true

if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo "  Certificat SSL déjà existant — vérification de la validité..."
    if certbot certificates -d "$DOMAIN" 2>/dev/null | grep -q "VALID"; then
        echo "  Certificat valide"
    else
        echo "  Renouvellement du certificat..."
        certbot renew --force-renewal
    fi
else
    echo "  Lancement de Certbot (standalone)..."
    certbot certonly \
        --standalone \
        -d "$DOMAIN" \
        --agree-tos \
        --email "$EMAIL" \
        --non-interactive
    echo "  Certificat SSL obtenu"
fi

# ------------------------------------------------------------------
# 5. Création du répertoire de déploiement
# ------------------------------------------------------------------
echo "[5/7] Préparation du répertoire de déploiement..."
mkdir -p "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR/postgres/init"
mkdir -p "$DEPLOY_DIR/backups"
mkdir -p /var/www/certbot

echo "  Répertoire : $DEPLOY_DIR"

# ------------------------------------------------------------------
# 6. Renouvellement SSL automatique (cron)
# ------------------------------------------------------------------
echo "[6/7] Configuration du renouvellement SSL automatique..."

CRON_CMD="0 3 * * * certbot renew --quiet --deploy-hook 'docker restart supfile-vps-proxy 2>/dev/null || true'"
if crontab -l 2>/dev/null | grep -q "certbot renew"; then
    echo "  Cron de renouvellement déjà configuré"
else
    (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
    echo "  Cron ajouté : renouvellement SSL quotidien à 3h du matin"
fi

# ------------------------------------------------------------------
# 7. Firewall (ufw)
# ------------------------------------------------------------------
echo "[7/7] Configuration du firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp   comment 'SSH'       2>/dev/null || true
    ufw allow 80/tcp   comment 'HTTP'      2>/dev/null || true
    ufw allow 443/tcp  comment 'HTTPS'     2>/dev/null || true
    ufw --force enable 2>/dev/null || true
    echo "  Firewall configuré (SSH, HTTP, HTTPS)"
else
    echo "  ufw non installé — pensez à configurer le firewall manuellement"
fi

echo ""
echo "========================================================"
echo "  Installation terminée !"
echo "========================================================"
echo ""
echo "  Répertoire de déploiement : $DEPLOY_DIR"
echo "  Certificat SSL            : /etc/letsencrypt/live/$DOMAIN/"
echo ""
echo "  Prochaines étapes :"
echo "    1. Configurer les GitHub Secrets/Variables (voir README)"
echo "    2. Pousser sur la branche main pour déclencher le déploiement"
echo "    3. Vérifier : https://$DOMAIN"
echo ""
