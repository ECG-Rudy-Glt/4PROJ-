#!/bin/bash

echo "🚀 Starting SUPFILE Application..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker first."
  exit 1
fi

# Check if Docker Compose is available
if ! command -v docker compose &> /dev/null && ! command -v docker-compose &> /dev/null; then
  echo "❌ Docker Compose is not installed."
  exit 1
fi

# Use docker compose or docker-compose based on what's available
if command -v docker compose &> /dev/null; then
  DOCKER_COMPOSE="docker compose"
else
  DOCKER_COMPOSE="docker-compose"
fi

echo "📦 Building and starting containers..."
echo ""

$DOCKER_COMPOSE up -d --build

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

echo ""
echo "✅ SUPFILE is now running!"
echo ""
echo "🌐 Access the application:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:5000"
echo "   Database: localhost:5432"
echo ""
echo "📝 To view logs:"
echo "   $DOCKER_COMPOSE logs -f"
echo ""
echo "🛑 To stop:"
echo "   $DOCKER_COMPOSE down"
echo ""
