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

psql -v ON_ERROR_STOP=1 \
  -v app_user="$APP_USER" \
  -v app_password="$APP_PASSWORD" \
  -v app_db="$APP_DB" \
  --username "$POSTGRES_USER" --dbname "$APP_DB" <<-'EOSQL'
  -- Idempotent : crée l'utilisateur s'il n'existe pas, sinon met à jour son mot de passe
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :'app_user') THEN
      EXECUTE format('CREATE USER %I WITH PASSWORD %L', :'app_user', :'app_password');
    ELSE
      EXECUTE format('ALTER USER %I WITH PASSWORD %L', :'app_user', :'app_password');
    END IF;
  END
  $$;

  -- Connexion à la base de données
  DO $$ BEGIN EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', :'app_db', :'app_user'); END $$;

  -- Accès complet au schéma public (nécessaire pour les migrations Prisma)
  DO $$ BEGIN EXECUTE format('GRANT ALL ON SCHEMA public TO %I', :'app_user'); END $$;

  -- Privilèges sur les tables et séquences existantes
  DO $$ BEGIN
    EXECUTE format('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO %I', :'app_user');
    EXECUTE format('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO %I', :'app_user');
  END $$;

  -- Privilèges par défaut pour les futurs objets créés par le superuser
  DO $$ BEGIN
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO %I', :'app_user');
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO %I', :'app_user');
  END $$;
EOSQL

echo "Utilisateur '$APP_USER' créé ou mis à jour avec succès."
