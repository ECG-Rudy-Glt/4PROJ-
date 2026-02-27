#!/bin/sh

echo "[entrypoint] Running Prisma migrations..."
MIGRATE_OUTPUT=$(npx prisma migrate deploy 2>&1)
MIGRATE_EXIT=$?
echo "$MIGRATE_OUTPUT"

if [ $MIGRATE_EXIT -eq 0 ]; then
  echo "[entrypoint] Migrations applied successfully."

elif echo "$MIGRATE_OUTPUT" | grep -q "P3009"; then
  # Failed migration in history -> mark as rolled back and retry
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

elif echo "$MIGRATE_OUTPUT" | grep -qE "P3018|does not exist"; then
  # Fresh database (no base tables) -> push full schema then mark migrations as applied
  echo "[entrypoint] Fresh database detected (P3018/missing tables), pushing full schema..."
  npx prisma db push || exit 1
  echo "[entrypoint] Marking all migrations as applied..."
  for migration in prisma/migrations/*/; do
    name=$(basename "$migration")
    if [ "$name" != "*" ]; then
      echo "[entrypoint] Marking $name as applied..."
      npx prisma migrate resolve --applied "$name" 2>/dev/null || true
    fi
  done

else
  echo "[entrypoint] Unknown migration error, exiting."
  exit $MIGRATE_EXIT
fi

echo "[entrypoint] Database ready, starting server..."
exec npm start
