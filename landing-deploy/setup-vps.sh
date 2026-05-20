#!/bin/bash
set -e

if [ "$EUID" -ne 0 ]; then
    echo "Relancement avec sudo..."
    exec sudo bash "$0" "$@"
fi

DOMAIN="supfile.tech"
EMAIL="contact@supfile.tech"
DEPLOY_DIR="/opt/supfile-landing"

echo ""
echo "========================================================"
echo "  SUPFile Landing - Installation VPS"
echo "========================================================"
echo ""

echo "[1/6] Mise a jour du systeme..."
apt update -y && apt upgrade -y

echo "[2/6] Installation de Docker..."
if command -v docker &> /dev/null; then
    echo "Docker deja installe ($(docker --version))"
else
    apt install -y ca-certificates curl gnupg lsb-release
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/$(. /etc/os-release && echo "$ID")/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$(. /etc/os-release && echo "$ID") \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt update -y
    apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    echo "Docker installe ($(docker --version))"
fi

echo "[3/6] Installation de Certbot..."
if command -v certbot &> /dev/null; then
    echo "Certbot deja installe"
else
    apt install -y certbot
    echo "Certbot installe"
fi

echo "[4/6] Obtention du certificat SSL pour $DOMAIN..."
systemctl stop nginx 2>/dev/null || true
systemctl stop apache2 2>/dev/null || true
docker stop supfile-landing 2>/dev/null || true

if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo "Certificat SSL deja existant"
else
    echo "Lancement de Certbot (standalone)..."
    certbot certonly \
        --standalone \
        -d "$DOMAIN" \
        -d "www.$DOMAIN" \
        --agree-tos \
        --email "$EMAIL" \
        --non-interactive
    echo "Certificat SSL obtenu"
fi

echo "[5/6] Preparation des fichiers..."
mkdir -p "$DEPLOY_DIR/html"
mkdir -p "$DEPLOY_DIR/certbot"

if [ ! -f "$DEPLOY_DIR/docker-compose.yml" ]; then
    echo ""
    echo "ERREUR : Les fichiers du site ne sont pas encore sur le VPS"
    echo ""
    echo "Transferer les fichiers depuis ton PC :"
    echo "  scp -r landing-deploy/* root@<IP_VPS>:$DEPLOY_DIR/"
    echo ""
    echo "Puis relance ce script."
    exit 1
fi

echo "Fichiers en place"

echo "[6/6] Lancement du container nginx..."
cd "$DEPLOY_DIR"
docker compose down 2>/dev/null || true
docker compose up -d

echo ""
echo "========================================================"
echo "  Installation terminee"
echo "========================================================"
echo ""
echo "  Site en ligne : https://$DOMAIN"
echo ""
echo "  Prochaine etape :"
echo "    Soumettre le site dans Google Search Console"
echo "    https://search.google.com/search-console"
echo ""

echo "Verification..."
sleep 2
if curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:80" | grep -q "301"; then
    echo "HTTP -> HTTPS redirect fonctionne"
else
    echo "La redirection HTTP pourrait ne pas fonctionner (verifier manuellement)"
fi

docker ps --filter name=supfile-landing --format "Container: {{.Names}} - Status: {{.Status}}"
echo ""

echo "Configuration du renouvellement SSL automatique..."
(crontab -l 2>/dev/null; echo "0 3 * * 1 certbot renew --quiet --pre-hook 'docker stop supfile-landing' --post-hook 'docker start supfile-landing'") | sort -u | crontab -
echo "Cron de renouvellement SSL configure (tous les lundis 3h)"
echo ""
echo "Done!"
