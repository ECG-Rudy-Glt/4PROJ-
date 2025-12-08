#!/bin/bash
# Script d'initialisation Docker pour PostgreSQL
# Ce script configure automatiquement la base de données SUPCHAT

set -e

# Variables d'environnement
DB_NAME=${POSTGRES_DB:-supchat}
DB_USER=${POSTGRES_USER:-postgres}

echo "🐘 Initialisation de la base de données PostgreSQL..."
echo "📝 Base de données: $DB_NAME"
echo "👤 Utilisateur: $DB_USER"

# Créer le rôle admin si nécessaire
ADMIN_PASSWORD=${POSTGRES_PASSWORD:-admin}
psql -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname postgres <<-EOSQL
    DO
    \$do\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'admin') THEN
            CREATE ROLE admin LOGIN PASSWORD '$ADMIN_PASSWORD';
        END IF;
    END
    \$do\$;
EOSQL

# Créer la base de données si elle n'existe pas
psql -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname postgres <<-EOSQL
    SELECT 'CREATE DATABASE $DB_NAME'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec
EOSQL

echo "✅ Base de données '$DB_NAME' créée ou existe déjà"

# Se connecter à la base de données et installer les extensions nécessaires
psql -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname "$DB_NAME" <<-EOSQL
    -- Extension pour UUID
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    
    -- Extension pour texte (si nécessaire)
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";
    
    -- Extension pour recherche plein-texte (si nécessaire)
    CREATE EXTENSION IF NOT EXISTS "unaccent";
EOSQL

echo "✅ Extensions PostgreSQL installées"

# Vérifier si le dump existe et l'importer
DUMP_FILE="/docker-entrypoint-initdb.d/dump-postgres-202505301032.sql"
if [ -f "$DUMP_FILE" ]; then
    echo "📥 Import du dump de base de données..."
    
    # Modifier le dump pour utiliser la bonne base de données
    sed "s/CREATE DATABASE postgres/-- CREATE DATABASE postgres (skipped)/g" "$DUMP_FILE" | \
    sed "s/\\\\connect postgres/\\\\connect $DB_NAME/g" | \
    psql -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname "$DB_NAME"
    
    echo "✅ Dump importé avec succès"
else
    echo "⚠️ Fichier dump non trouvé, création d'une base vide"
    
    # Créer au minimum les tables de base si le dump n'existe pas
    psql -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname "$DB_NAME" <<-EOSQL
        -- Table des utilisateurs basique si pas de dump
        CREATE TABLE IF NOT EXISTS utilisateur (
            id_utilisateur SERIAL PRIMARY KEY,
            nom VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            mot_de_passe VARCHAR(255),
            date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_validated BOOLEAN DEFAULT FALSE
        );
        
        -- Autres tables de base peuvent être ajoutées ici
EOSQL
fi

echo "🎉 Initialisation de la base de données terminée !"
