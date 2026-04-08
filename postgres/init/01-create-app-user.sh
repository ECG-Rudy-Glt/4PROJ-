#!/bin/bash
# Script d'initialisation PostgreSQL — exécuté une seule fois à la création du volume
# Crée un utilisateur applicatif dédié avec des privilèges limités (pas superuser)
set -e

APP_USER="${POSTGRES_APP_USER:-supfile_app}"
APP_PASSWORD="${POSTGRES_APP_PASSWORD}"
APP_DB="${POSTGRES_DB:-supfile}"

if [ -z "$APP_PASSWORD" ]; then
  echo "ERREUR : POSTGRES_APP_PASSWORD n'est pas défini. Arrêt."
  exit 1
fi

echo "Création de l'utilisateur applicatif '$APP_USER'..."

# Use separate -c calls to avoid psql-variable vs PL/pgSQL conflicts.
# format() handles identifier/literal quoting safely.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$APP_DB" \
  -c "DO \$\$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '$APP_USER') THEN
          EXECUTE format('CREATE USER %I WITH PASSWORD %L', '$APP_USER', '$APP_PASSWORD');
        ELSE
          EXECUTE format('ALTER USER %I WITH PASSWORD %L', '$APP_USER', '$APP_PASSWORD');
        END IF;
      END \$\$;" \
  -c "GRANT CONNECT ON DATABASE \"$APP_DB\" TO \"$APP_USER\";" \
  -c "GRANT ALL ON SCHEMA public TO \"$APP_USER\";" \
  -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO \"$APP_USER\";" \
  -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO \"$APP_USER\";" \
  -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO \"$APP_USER\";" \
  -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO \"$APP_USER\";"

echo "Utilisateur '$APP_USER' créé ou mis à jour avec succès."
