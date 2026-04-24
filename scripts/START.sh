#!/bin/bash
set -euo pipefail

# Se placer à la racine du projet
cd "$(dirname "$0")/.."

echo "🚀 Starting SUPFILE Application..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker first."
  exit 1
fi

# Check if Docker Compose is available
if ! docker compose version > /dev/null 2>&1 && ! command -v docker-compose > /dev/null 2>&1; then
  echo "❌ Docker Compose is not installed."
  exit 1
fi

# Use docker compose or docker-compose based on what's available
if docker compose version > /dev/null 2>&1; then
  DOCKER_COMPOSE="docker compose"
else
  DOCKER_COMPOSE="docker-compose"
fi

FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-5001}"
POSTGRES_PORT="${POSTGRES_PORT:-5433}"

echo "📦 Building and starting containers..."
echo ""

if ! $DOCKER_COMPOSE up -d --build; then
  echo ""
  echo "❌ Failed to start containers. Check compose logs:"
  echo "   $DOCKER_COMPOSE logs --tail=200"
  exit 1
fi

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

echo ""
echo "✅ SUPFILE is now running!"
echo ""
echo "🌐 Access the application:"
echo "   Frontend: http://localhost:${FRONTEND_PORT}"
echo "   Backend API: http://localhost:${BACKEND_PORT}"
echo "   Database: localhost:${POSTGRES_PORT}"
echo ""
echo "📝 To view logs:"
echo "   $DOCKER_COMPOSE logs -f"
echo ""
echo "🛑 To stop:"
echo "   $DOCKER_COMPOSE down"
echo ""
