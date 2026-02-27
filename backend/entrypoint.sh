#!/bin/sh

echo "[entrypoint] Running Prisma migrations..."
MIGRATE_OUTPUT=$(npx prisma migrate deploy 2>&1)
MIGRATE_EXIT=$?

echo "$MIGRATE_OUTPUT"

if [ $MIGRATE_EXIT -ne 0 ]; then
  if echo "$MIGRATE_OUTPUT" | grep -q "P3009"; then
    echo "[entrypoint] Detected failed migration (P3009), attempting auto-resolve..."

    FAILED_MIGRATION=$(echo "$MIGRATE_OUTPUT" | grep -oE 'The `[^`]+` migration' | head -1 | sed "s/The \`//;s/\` migration//")

    if [ -n "$FAILED_MIGRATION" ]; then
      echo "[entrypoint] Marking '$FAILED_MIGRATION' as rolled back..."
      npx prisma migrate resolve --rolled-back "$FAILED_MIGRATION"

      echo "[entrypoint] Retrying migrations..."
      npx prisma migrate deploy || exit 1
    else
      echo "[entrypoint] Could not extract migration name, exiting."
      exit 1
    fi
  else
    echo "[entrypoint] Migration failed with unknown error, exiting."
    exit $MIGRATE_EXIT
  fi
fi

echo "[entrypoint] Migrations OK, starting server..."
exec npm start
