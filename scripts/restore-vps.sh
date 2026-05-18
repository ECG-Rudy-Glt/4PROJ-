#!/bin/sh
set -eu

if [ "${CONFIRM_RESTORE:-}" != "yes" ]; then
  echo "Refusing to restore without CONFIRM_RESTORE=yes."
  echo "Usage: CONFIRM_RESTORE=yes $0 backups/postgres.sql backups/minio.tar.gz"
  exit 1
fi

if [ "$#" -lt 2 ]; then
  echo "Usage: CONFIRM_RESTORE=yes $0 <postgres.sql> <minio.tar.gz>"
  exit 1
fi

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

POSTGRES_DUMP="$1"
MINIO_ARCHIVE="$2"
COMPOSE_FILES="${COMPOSE_FILES:--f docker-compose.yml -f docker-compose.vps.yml}"

if [ ! -f "$POSTGRES_DUMP" ]; then
  echo "PostgreSQL dump not found: $POSTGRES_DUMP"
  exit 1
fi

if [ ! -f "$MINIO_ARCHIVE" ]; then
  echo "MinIO archive not found: $MINIO_ARCHIVE"
  exit 1
fi

if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-supfile}"

echo "Stopping backend while restoring..."
docker compose $COMPOSE_FILES stop backend

echo "Restoring PostgreSQL schema..."
docker compose $COMPOSE_FILES exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
docker compose $COMPOSE_FILES exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  < "$POSTGRES_DUMP"

echo "Restoring MinIO volume..."
docker run --rm \
  --volumes-from supfile-minio \
  -v "$ROOT_DIR:/restore:ro" \
  busybox:stable \
  sh -c "rm -rf /data/* && tar xzf /restore/$MINIO_ARCHIVE -C /data"

echo "Restarting services..."
docker compose $COMPOSE_FILES up -d backend minio minio-init

echo "Restore complete."
