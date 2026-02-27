#!/bin/sh

run_migrations() {
  MIGRATE_OUTPUT=$(npx prisma migrate deploy 2>&1)
  MIGRATE_EXIT=$?
  echo "$MIGRATE_OUTPUT"

  if [ $MIGRATE_EXIT -eq 0 ]; then
    return 0
  fi

  if echo "$MIGRATE_OUTPUT" | grep -q "P3009"; then
    echo "[entrypoint] Detected failed migration (P3009), attempting auto-resolve..."
    FAILED_MIGRATION=$(echo "$MIGRATE_OUTPUT" | grep -oE 'The `[^`]+` migration' | head -1 | sed "s/The \`//;s/\` migration//")
    if [ -n "$FAILED_MIGRATION" ]; then
      echo "[entrypoint] Marking '$FAILED_MIGRATION' as rolled back..."
      npx prisma migrate resolve --rolled-back "$FAILED_MIGRATION"
      echo "[entrypoint] Retrying migrations after P3009 resolve..."
      MIGRATE_OUTPUT=$(npx prisma migrate deploy 2>&1)
      MIGRATE_EXIT=$?
      echo "$MIGRATE_OUTPUT"
      [ $MIGRATE_EXIT -eq 0 ] && return 0
    fi
  fi

  if echo "$MIGRATE_OUTPUT" | grep -qE "P3018|does not exist"; then
    echo "[entrypoint] Fresh/broken database detected, pushing full schema..."
    npx prisma db push || return 1
    echo "[entrypoint] Marking all migrations as applied..."
    for migration in prisma/migrations/*/; do
      name=$(basename "$migration")
      [ "$name" != "*" ] && npx prisma migrate resolve --applied "$name" 2>/dev/null || true
    done
    return 0
  fi

  echo "[entrypoint] Unknown migration error (exit $MIGRATE_EXIT), exiting."
  return 1
}

echo "[entrypoint] Running Prisma migrations..."
run_migrations || exit 1

echo "[entrypoint] Database ready, starting server..."
exec npm start
