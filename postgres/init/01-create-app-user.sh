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

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$APP_DB" <<-EOSQL
  -- Utilisateur dédié à l'application (pas superuser, pas CREATEDB, pas CREATEROLE)
  CREATE USER ${APP_USER} WITH PASSWORD '${APP_PASSWORD}';

  -- Connexion à la base de données
  GRANT CONNECT ON DATABASE ${APP_DB} TO ${APP_USER};

  -- Accès complet au schéma public (nécessaire pour les migrations Prisma)
  GRANT ALL ON SCHEMA public TO ${APP_USER};

  -- Privilèges sur les tables et séquences existantes
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${APP_USER};
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${APP_USER};

  -- Privilèges par défaut pour les futurs objets créés par le superuser
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${APP_USER};
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${APP_USER};
EOSQL

echo "Utilisateur '$APP_USER' créé avec succès."
