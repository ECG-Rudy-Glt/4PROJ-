#!/bin/bash
# ============================================================
#  SUPFile Landing Page — Setup complet VPS vierge
#  Compatible : Ubuntu 20/22/24/25, Debian 11/12
#  Usage : bash setup-vps.sh (auto-sudo si besoin)
# ============================================================

set -e

# Auto-escalade en sudo si pas root
if [ "$EUID" -ne 0 ]; then
    echo "→ Relancement avec sudo..."
    exec sudo bash "$0" "$@"
fi

DOMAIN="supfile.tech"
EMAIL="contact@supfile.tech"   # ← Change avec ton vrai email pour Let's Encrypt
DEPLOY_DIR="/opt/supfile-landing"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   SUPFile Landing — Installation VPS complète       ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── 1. Mise à jour système ──
echo "➜ [1/6] Mise à jour du système..."
apt update -y && apt upgrade -y

# ── 2. Installer Docker ──
echo "➜ [2/6] Installation de Docker..."
if command -v docker &> /dev/null; then
    echo "  ✓ Docker déjà installé ($(docker --version))"
else
    # Installer les dépendances
    apt install -y ca-certificates curl gnupg lsb-release

    # Ajouter le repo Docker officiel
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/$(. /etc/os-release && echo "$ID")/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$(. /etc/os-release && echo "$ID") \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt update -y
    apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Activer Docker au démarrage
    systemctl enable docker
    systemctl start docker

    echo "  ✓ Docker installé ($(docker --version))"
fi

# ── 3. Installer Certbot pour SSL ──
echo "➜ [3/6] Installation de Certbot..."
if command -v certbot &> /dev/null; then
    echo "  ✓ Certbot déjà installé"
else
    apt install -y certbot
    echo "  ✓ Certbot installé"
fi

# ── 4. Obtenir le certificat SSL ──
echo "➜ [4/6] Obtention du certificat SSL pour $DOMAIN..."

# S'assurer que rien n'écoute sur le port 80
systemctl stop nginx 2>/dev/null || true
systemctl stop apache2 2>/dev/null || true
docker stop supfile-landing 2>/dev/null || true

if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo "  ✓ Certificat SSL déjà existant"
else
    echo "  → Lancement de Certbot (standalone)..."
    echo "  → Assure-toi que le DNS de $DOMAIN pointe bien vers cette IP !"
    echo ""
    certbot certonly \
        --standalone \
        -d "$DOMAIN" \
        -d "www.$DOMAIN" \
        --agree-tos \
        --email "$EMAIL" \
        --non-interactive
    echo "  ✓ Certificat SSL obtenu"
fi

# ── 5. Préparer les fichiers ──
echo "➜ [5/6] Préparation des fichiers..."
mkdir -p "$DEPLOY_DIR/html"
mkdir -p "$DEPLOY_DIR/certbot"

# Vérifier que les fichiers sont présents
if [ ! -f "$DEPLOY_DIR/docker-compose.yml" ]; then
    echo ""
    echo "  ⚠  ERREUR : Les fichiers du site ne sont pas encore sur le VPS !"
    echo ""
    echo "  Tu dois d'abord transférer les fichiers depuis ton PC :"
    echo ""
    echo "  Depuis PowerShell sur ton PC Windows :"
    echo "    scp -r landing-deploy/* root@<IP_VPS>:$DEPLOY_DIR/"
    echo ""
    echo "  Puis relance ce script."
    exit 1
fi

echo "  ✓ Fichiers en place"

# ── 6. Lancer le container ──
echo "➜ [6/6] Lancement du container nginx..."
cd "$DEPLOY_DIR"
docker compose down 2>/dev/null || true
docker compose up -d

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   ✅  Installation terminée !                       ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║                                                      ║"
echo "║  Ton site est en ligne :                             ║"
echo "║    → https://$DOMAIN                         ║"
echo "║                                                      ║"
echo "║  Prochaine étape CRITIQUE :                          ║"
echo "║    → Soumets ton site dans Google Search Console     ║"
echo "║    → https://search.google.com/search-console        ║"
echo "║                                                      ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Vérification rapide
echo "── Vérification ──"
sleep 2
if curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:80" | grep -q "301"; then
    echo "  ✓ HTTP → HTTPS redirect fonctionne"
else
    echo "  ⚠ La redirection HTTP pourrait ne pas fonctionner (vérifie manuellement)"
fi

docker ps --filter name=supfile-landing --format "  ✓ Container: {{.Names}} — Status: {{.Status}}"
echo ""

# ── Setup renouvellement auto SSL ──
echo "── Configuration du renouvellement SSL automatique ──"
# Cron pour renouveler le cert et redémarrer nginx
(crontab -l 2>/dev/null; echo "0 3 * * 1 certbot renew --quiet --pre-hook 'docker stop supfile-landing' --post-hook 'docker start supfile-landing'") | sort -u | crontab -
echo "  ✓ Cron de renouvellement SSL configuré (tous les lundis 3h)"
echo ""
echo "Done! 🚀"
