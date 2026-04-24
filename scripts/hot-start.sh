#!/bin/bash
set -euo pipefail

echo "========================================="
echo "  SUPFILE - Hot Reload Dev Start"
echo "========================================="
echo ""

# ── 1. Check Docker ──────────────────────────────────────────────────────────
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker first."
  exit 1
fi

if docker compose version > /dev/null 2>&1; then
  DOCKER_COMPOSE="docker compose"
elif command -v docker-compose > /dev/null 2>&1; then
  DOCKER_COMPOSE="docker-compose"
else
  echo "❌ Docker Compose is not installed."
  exit 1
fi

# ── 2. Network configuration ─────────────────────────────────────────────────
detect_ip() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    IP=$(hostname -I | awk '{print $1}')
  else
    IP=$(ipconfig.exe 2>/dev/null | grep -i "IPv4" | head -n 1 | awk '{print $NF}' | tr -d '\r')
  fi
  echo "$IP"
}

echo "Détection de votre adresse IP..."
DETECTED_IP=$(detect_ip)

if [ -n "$DETECTED_IP" ]; then
  echo "✓ Adresse IP détectée : $DETECTED_IP"
  echo ""
  read -p "Utiliser cette adresse IP ? (O/n) : " USE_DETECTED

  if [[ "$USE_DETECTED" =~ ^[Nn]$ ]]; then
    read -p "Entrez votre adresse IP manuellement : " CUSTOM_IP
    FINAL_IP="$CUSTOM_IP"
  else
    FINAL_IP="$DETECTED_IP"
  fi
else
  echo "⚠ Impossible de détecter automatiquement votre IP"
  echo ""
  read -p "Entrez votre adresse IP manuellement : " CUSTOM_IP
  FINAL_IP="$CUSTOM_IP"
fi

if [ ! -f ".env" ]; then
  echo "✗ Fichier .env introuvable"
  exit 1
fi

cp .env .env.backup
sed -i.tmp "s|HOST_IP=.*|HOST_IP=$FINAL_IP|" .env
sed -i.tmp "s|API_URL=.*|API_URL=http://$FINAL_IP:5001|" .env
sed -i.tmp "s|FRONTEND_URL=.*|FRONTEND_URL=http://$FINAL_IP:3000|" .env
sed -i.tmp "s|ONLYOFFICE_PUBLIC_URL=.*|ONLYOFFICE_PUBLIC_URL=http://$FINAL_IP:8080|" .env
sed -i.tmp "s|VITE_API_URL=.*|VITE_API_URL=http://$FINAL_IP:5001|" .env
rm -f .env.tmp
echo "✓ Fichier .env mis à jour avec l'IP : $FINAL_IP"
echo ""

# ── 3. Start with hot reload ──────────────────────────────────────────────────
echo "🔥 Démarrage en mode hot reload..."
echo ""

# Stop and remove all supfile containers to free ports
$DOCKER_COMPOSE -f docker-compose.dev.yml down --remove-orphans 2>/dev/null || true
$DOCKER_COMPOSE down --remove-orphans 2>/dev/null || true
docker rm -f supfile-frontend supfile-backend supfile-postgres supfile-onlyoffice 2>/dev/null || true

if ! $DOCKER_COMPOSE -f docker-compose.dev.yml up -d --build; then
  echo ""
  echo "❌ Échec du démarrage. Logs :"
  echo "   $DOCKER_COMPOSE -f docker-compose.dev.yml logs --tail=200"
  exit 1
fi

echo ""
echo "✅ SUPFILE est démarré en mode hot reload !"
echo ""
echo "🌐 Accès :"
echo "   Frontend : http://localhost:3000  (ou http://$FINAL_IP:3000)"
echo "   Backend  : http://localhost:5001  (ou http://$FINAL_IP:5001)"
echo "   OnlyOffice: http://localhost:8080"
echo ""
echo "🔁 Hot reload actif :"
echo "   Backend  → tsx watch (redémarre à chaque modif dans backend/src/)"
echo "   Frontend → Vite HMR  (applique les modifs sans rechargement de page)"
echo ""
echo "📝 Logs en direct :"
echo "   $DOCKER_COMPOSE -f docker-compose.dev.yml logs -f"
echo ""
echo "🛑 Arrêter :"
echo "   $DOCKER_COMPOSE -f docker-compose.dev.yml down"
echo ""
