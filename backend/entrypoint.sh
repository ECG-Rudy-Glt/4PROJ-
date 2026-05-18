#!/bin/sh

# Fix uploads directory permissions on volume mount (volume may be owned by root)
mkdir -p /app/uploads/avatars /app/uploads/files /app/uploads/thumbnails
chown -R node:node /app/uploads 2>/dev/null || true

echo "[entrypoint] Syncing database schema..."
MAX_RETRIES=30
RETRY=0
until npx prisma db push --accept-data-loss; do
  RETRY=$((RETRY + 1))
  if [ "$RETRY" -ge "$MAX_RETRIES" ]; then
    echo "[entrypoint] Schema sync failed after ${MAX_RETRIES} attempts, exiting."
    exit 1
  fi
  echo "[entrypoint] Database not ready, retrying in 3s... ($RETRY/$MAX_RETRIES)"
  sleep 3
done
npx prisma generate

echo "[entrypoint] Database ready, starting server..."
exec su-exec node npm start
