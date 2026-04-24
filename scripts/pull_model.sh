#!/bin/bash
# Pull the Ollama model into the running Ollama container.
# Defaults to the hot-reload dev stack:
#   ./scripts/pull_model.sh
# Or specify a different model:
#   ./scripts/pull_model.sh qwen2.5:0.5b
# To target another stack:
#   COMPOSE_FILE=docker-compose.yml ./scripts/pull_model.sh

set -euo pipefail

# Se placer à la racine du projet
cd "$(dirname "$0")/.."

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"
MODEL="${1:-gemma2:2b}"

if docker compose version > /dev/null 2>&1; then
  DOCKER_COMPOSE="docker compose"
elif command -v docker-compose > /dev/null 2>&1; then
  DOCKER_COMPOSE="docker-compose"
else
  echo "❌ Docker Compose is not installed."
  exit 1
fi

echo "Pulling model '$MODEL' into the Ollama container using $COMPOSE_FILE..."
$DOCKER_COMPOSE -f "$COMPOSE_FILE" exec ollama ollama pull "$MODEL"
echo "Done. Bobby is ready."
