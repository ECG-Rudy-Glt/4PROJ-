#!/bin/bash
set -euo pipefail

# Se placer à la racine du projet
cd "$(dirname "$0")/.."

COMPOSE_FILE="docker-compose.yml"

echo "========================================="
echo "  SUPFILE - Production Locale"
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

get_env_value() {
  local key="$1"
  grep -E "^${key}=" .env | tail -n 1 | cut -d '=' -f 2-
}

require_env() {
  local key="$1"
  local value
  value="$(get_env_value "$key" || true)"
  if [ -z "$value" ]; then
    echo "Error: Variable .env requise manquante ou vide: $key"
    exit 1
  fi
}

if [ ! -f ".env" ]; then
  echo "Error: Fichier .env introuvable."
  echo "   Copiez .env.example vers .env puis renseignez les secrets de production locale."
  exit 1
fi

require_env "POSTGRES_PASSWORD"
require_env "POSTGRES_APP_PASSWORD"
require_env "MINIO_ROOT_USER"
require_env "MINIO_ROOT_PASSWORD"
require_env "MINIO_APP_ACCESS_KEY"
require_env "MINIO_APP_SECRET_KEY"
require_env "JWT_SECRET"
require_env "JWT_MFA_SECRET"
require_env "DEK_WRAP_SECRET"
require_env "FILE_ENCRYPTION_KEY"
require_env "ONLYOFFICE_JWT_SECRET"
require_env "MFA_ENCRYPTION_KEY"

MFA_ENCRYPTION_KEY="$(get_env_value "MFA_ENCRYPTION_KEY")"
if ! [[ "$MFA_ENCRYPTION_KEY" =~ ^[0-9a-fA-F]{64}$ ]]; then
  echo "Error: MFA_ENCRYPTION_KEY doit être une chaîne hexadécimale de 64 caractères."
  echo "   Génération suggérée: openssl rand -hex 32"
  exit 1
fi

FRONTEND_PORT="${FRONTEND_PORT:-$(get_env_value FRONTEND_PORT || true)}"
BACKEND_PORT="${BACKEND_PORT:-$(get_env_value BACKEND_PORT || true)}"
ONLYOFFICE_PORT="${ONLYOFFICE_PORT:-$(get_env_value ONLYOFFICE_PORT || true)}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-5001}"
ONLYOFFICE_PORT="${ONLYOFFICE_PORT:-8080}"

PROFILE_ARG=""
if [ "${AI:-0}" = "1" ] || [ "${1:-}" = "--ai" ]; then
  PROFILE_ARG="--profile ai"
  echo "Activation du profil AI..."
fi

echo "Build et démarrage avec ${COMPOSE_FILE}..."
echo ""

if ! $DOCKER_COMPOSE -f "$COMPOSE_FILE" $PROFILE_ARG up -d --build; then
  echo ""
  echo "Error: Échec du démarrage. Logs :"
  echo "   $DOCKER_COMPOSE -f $COMPOSE_FILE $PROFILE_ARG logs --tail=200"
  exit 1
fi

echo ""
echo "Attente courte du démarrage des services..."
sleep 10

echo ""
echo "SUPFILE est démarré en production locale."
echo ""
echo "Accès :"
echo "   Frontend   : http://localhost:${FRONTEND_PORT}"
echo "   Backend API: http://localhost:${BACKEND_PORT}"
echo "   OnlyOffice : http://localhost:${ONLYOFFICE_PORT}"
echo ""
echo "Logs :"
echo "   $DOCKER_COMPOSE -f $COMPOSE_FILE logs -f"
echo ""
echo "Arrêter :"
echo "   $DOCKER_COMPOSE -f $COMPOSE_FILE down"
echo ""
