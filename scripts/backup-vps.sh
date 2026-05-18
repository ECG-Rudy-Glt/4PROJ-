#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

BACKUP_DIR="${BACKUP_DIR:-backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
COMPOSE_FILES="${COMPOSE_FILES:--f docker-compose.yml -f docker-compose.vps.yml}"

if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

mkdir -p "$BACKUP_DIR"

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-supfile}"

echo "Backup PostgreSQL..."
docker compose $COMPOSE_FILES exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  > "$BACKUP_DIR/postgres-$STAMP.sql"

echo "Backup MinIO volume..."
docker run --rm \
  --volumes-from supfile-minio \
  -v "$ROOT_DIR/$BACKUP_DIR:/backup" \
  busybox:stable \
  tar czf "/backup/minio-$STAMP.tar.gz" -C /data .

echo "Backups created:"
echo "  $BACKUP_DIR/postgres-$STAMP.sql"
echo "  $BACKUP_DIR/minio-$STAMP.tar.gz"
