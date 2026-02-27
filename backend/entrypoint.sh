#!/bin/sh
set -e

echo "[entrypoint] Running Prisma migrations..."
MIGRATE_OUTPUT=$(npx prisma migrate deploy 2>&1) || MIGRATE_EXIT=$?

echo "$MIGRATE_OUTPUT"

if echo "$MIGRATE_OUTPUT" | grep -q "P3009"; then
  echo "[entrypoint] Detected failed migration (P3009), attempting auto-resolve..."

  FAILED_MIGRATION=$(echo "$MIGRATE_OUTPUT" | grep -oE 'The `[^`]+` migration' | head -1 | sed "s/The \`//;s/\` migration//")

  if [ -n "$FAILED_MIGRATION" ]; then
    echo "[entrypoint] Marking '$FAILED_MIGRATION' as rolled back..."
    npx prisma migrate resolve --rolled-back "$FAILED_MIGRATION"

    echo "[entrypoint] Retrying migrations..."
    npx prisma migrate deploy
  else
    echo "[entrypoint] Could not extract migration name, exiting."
    exit 1
  fi
elif [ -n "$MIGRATE_EXIT" ]; then
  echo "[entrypoint] Migration failed with unknown error, exiting."
  exit $MIGRATE_EXIT
fi

echo "[entrypoint] Migrations OK, starting server..."
exec npm start
