#!/bin/bash
set -euo pipefail

# Se placer à la racine du projet
cd "$(dirname "$0")/.."

COMPOSE_FILE="docker-compose.dev.yml"

echo "========================================="
echo "  SUPFILE - Hot Reload Dev Start"
echo "========================================="
echo ""

if ! docker info > /dev/null 2>&1; then
  echo "Error: Docker is not running. Please start Docker first."
  exit 1
fi

if docker compose version > /dev/null 2>&1; then
  DOCKER_COMPOSE="docker compose"
elif command -v docker-compose > /dev/null 2>&1; then
  DOCKER_COMPOSE="docker-compose"
else
  echo "Error: Docker Compose is not installed."
  exit 1
fi

detect_ip() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    hostname -I | awk '{print $1}'
  else
    ipconfig.exe 2>/dev/null | grep -i "IPv4" | head -n 1 | awk '{print $NF}' | tr -d '\r'
  fi
}

set_env_value() {
  local key="$1"
  local value="$2"

  if grep -qE "^${key}=" .env; then
    sed -i.tmp "s|^${key}=.*|${key}=${value}|" .env
  else
    printf "\n%s=%s\n" "$key" "$value" >> .env
  fi
}

get_env_value() {
  local key="$1"
  grep -E "^${key}=" .env | tail -n 1 | cut -d '=' -f 2-
}

generate_hex_key() {
  if command -v openssl > /dev/null 2>&1; then
    openssl rand -hex 32
  else
    python3 -c 'import secrets; print(secrets.token_hex(32))'
  fi
}

echo "Détection de votre adresse IP..."
DETECTED_IP="$(detect_ip || true)"

if [ -n "$DETECTED_IP" ]; then
  echo "Adresse IP détectée : $DETECTED_IP"
  echo ""
  read -r -p "Utiliser cette adresse IP ? (O/n) : " USE_DETECTED

  if [[ "$USE_DETECTED" =~ ^[Nn]$ ]]; then
    read -r -p "Entrez votre adresse IP manuellement : " CUSTOM_IP
    FINAL_IP="$CUSTOM_IP"
  else
    FINAL_IP="$DETECTED_IP"
  fi
else
  echo "Attention: Impossible de détecter automatiquement votre IP"
  echo ""
  read -r -p "Entrez votre adresse IP manuellement : " CUSTOM_IP
  FINAL_IP="$CUSTOM_IP"
fi

if [ ! -f ".env" ]; then
  if [ ! -f ".env.example" ]; then
    echo "Error: Fichier .env introuvable et .env.example absent"
    exit 1
  fi
  cp .env.example .env
  echo "Fichier .env créé depuis .env.example"
fi

cp .env .env.backup
set_env_value "HOST_IP" "$FINAL_IP"
set_env_value "API_URL" "http://$FINAL_IP:5001"
set_env_value "FRONTEND_URL" "http://$FINAL_IP:3000"
set_env_value "ONLYOFFICE_PUBLIC_URL" "http://$FINAL_IP:8080"
set_env_value "VITE_API_URL" "http://$FINAL_IP:5001"

MFA_ENCRYPTION_KEY="$(get_env_value "MFA_ENCRYPTION_KEY" || true)"
if ! [[ "$MFA_ENCRYPTION_KEY" =~ ^[0-9a-fA-F]{64}$ ]]; then
  set_env_value "MFA_ENCRYPTION_KEY" "$(generate_hex_key)"
  echo "MFA_ENCRYPTION_KEY dev générée"
fi

rm -f .env.tmp
echo "Fichier .env mis à jour avec l'IP : $FINAL_IP"
echo ""

echo "Démarrage en mode hot reload..."
echo ""

$DOCKER_COMPOSE -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
$DOCKER_COMPOSE -f docker-compose.yml down --remove-orphans 2>/dev/null || true
docker rm -f \
  supfile-frontend \
  supfile-backend \
  supfile-postgres \
  supfile-onlyoffice \
  supfile-minio \
  supfile-minio-init \
  supfile-minio-permissions \
  supfile-brain \
  supfile-ollama \
  2>/dev/null || true

if ! $DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d --build; then
  echo ""
  echo "Error: Échec du démarrage. Logs :"
  echo "   $DOCKER_COMPOSE -f $COMPOSE_FILE logs --tail=200"
  exit 1
fi

echo "Synchronizing database schema..."
$DOCKER_COMPOSE -f "$COMPOSE_FILE" exec backend npx prisma db push

echo ""
echo "SUPFILE est démarré en mode hot reload !"
echo ""
echo "Accès :"
echo "   Frontend  : http://localhost:3000  (ou http://$FINAL_IP:3000)"
echo "   Backend   : http://localhost:5001  (ou http://$FINAL_IP:5001)"
echo "   OnlyOffice: http://localhost:8080  (ou http://$FINAL_IP:8080)"
echo "   MinIO     : http://localhost:9001"
echo ""
echo "Hot reload actif :"
echo "   Backend  → tsx watch (redémarre à chaque modif dans backend/src/)"
echo "   Frontend → Vite HMR  (applique les modifs sans rechargement de page)"
echo ""
echo "Logs en direct :"
echo "   $DOCKER_COMPOSE -f $COMPOSE_FILE logs -f"
echo ""
echo "Arrêter :"
echo "   $DOCKER_COMPOSE -f $COMPOSE_FILE down"
echo ""
