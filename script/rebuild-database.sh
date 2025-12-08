#!/bin/bash

# =====================================
# SCRIPT DE RECONSTRUCTION COMPLÈTE DB
# =====================================

set -euo pipefail

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_step() { echo -e "${PURPLE}[STEP]${NC} $1"; }

echo -e "${PURPLE}"
echo "======================================="
echo "   RECONSTRUCTION COMPLÈTE BASE DE"
echo "         DONNÉES SUPCHAT"
echo "======================================="
echo -e "${NC}"

# Vérifier si nous sommes sur le VPS
if [[ -d "/opt/supchat" ]]; then
    log_info "Exécution sur le VPS détectée"
    PROJECT_DIR="/opt/supchat"
    cd "$PROJECT_DIR"
    COMPOSE_FILE="docker-compose.vps.yml"
else
    log_info "Exécution en local détectée"
    PROJECT_DIR="$(pwd)"
    cd "$PROJECT_DIR"
    COMPOSE_FILE="docker-compose.yml"
fi

# Détecter docker-compose
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi

log_warning "⚠️  ATTENTION: Cette opération va SUPPRIMER DÉFINITIVEMENT toutes les données de la base !"
log_warning "⚠️  Tous les utilisateurs, messages, workspaces, etc. seront perdus !"
echo ""
read -p "Êtes-vous sûr de vouloir continuer ? (tapez 'CONFIRMER' pour continuer): " confirmation

if [[ "$confirmation" != "CONFIRMER" ]]; then
    log_error "Opération annulée par l'utilisateur"
    exit 1
fi

echo ""
log_step "1. Arrêt de tous les conteneurs..."
$DOCKER_COMPOSE -f "$COMPOSE_FILE" down

log_success "Conteneurs arrêtés"

echo ""
log_step "2. Suppression du volume de données PostgreSQL..."
# Trouver le nom du volume PostgreSQL
POSTGRES_VOLUME=$($DOCKER_COMPOSE -f "$COMPOSE_FILE" config --volumes | grep postgres || echo "postgres_data")

# Supprimer le volume de données PostgreSQL
docker volume rm "${PROJECT_DIR##*/}_${POSTGRES_VOLUME}" 2>/dev/null || \
docker volume rm "${POSTGRES_VOLUME}" 2>/dev/null || \
docker volume rm "supchat_postgres_data" 2>/dev/null || \
log_warning "Volume PostgreSQL introuvable ou déjà supprimé"

log_success "Volume PostgreSQL supprimé"

echo ""
log_step "3. Suppression des conteneurs et images PostgreSQL..."
# Supprimer les conteneurs
$DOCKER_COMPOSE -f "$COMPOSE_FILE" rm -f postgres

# Supprimer l'image PostgreSQL pour forcer la reconstruction
docker rmi postgres:16-alpine 2>/dev/null || true

log_success "Conteneurs et images PostgreSQL supprimés"

echo ""
log_step "4. Vérification du fichier d'initialisation de la DB..."
if [[ -f "./backend/db/init-docker.sql" ]]; then
    log_info "✓ Fichier init-docker.sql trouvé ($(wc -l < ./backend/db/init-docker.sql) lignes)"
else
    log_error "❌ Fichier init-docker.sql introuvable !"
    echo "Le fichier ./backend/db/init-docker.sql est nécessaire pour initialiser la base."
    exit 1
fi

echo ""
log_step "5. Reconstruction du conteneur PostgreSQL..."
$DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d postgres

log_success "Conteneur PostgreSQL créé"

echo ""
log_step "6. Attente de l'initialisation de PostgreSQL..."
log_info "Initialisation de la base de données avec le schéma complet..."

# Attendre que PostgreSQL soit prêt
RETRY_COUNT=0
MAX_RETRIES=30

while [[ $RETRY_COUNT -lt $MAX_RETRIES ]]; do
    if $DOCKER_COMPOSE -f "$COMPOSE_FILE" exec postgres pg_isready -U postgres &>/dev/null; then
        log_success "PostgreSQL est prêt !"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -n "."
    sleep 2
done

if [[ $RETRY_COUNT -eq $MAX_RETRIES ]]; then
    log_error "Timeout : PostgreSQL n'est pas prêt après $((MAX_RETRIES * 2)) secondes"
    echo ""
    log_info "Logs PostgreSQL :"
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" logs postgres
    exit 1
fi

echo ""
log_step "7. Vérification de l'initialisation de la base..."
sleep 5

# Vérifier que les tables ont été créées
log_info "Vérification des tables créées..."
TABLES_COUNT=$($DOCKER_COMPOSE -f "$COMPOSE_FILE" exec -T postgres psql -U postgres -d supchat -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' \n' || echo "0")

if [[ "$TABLES_COUNT" -gt "0" ]]; then
    log_success "✓ $TABLES_COUNT tables créées avec succès"
    
    # Lister quelques tables importantes
    log_info "Tables principales créées :"
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" exec -T postgres psql -U postgres -d supchat -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" 2>/dev/null | grep -E "(users|workspaces|canaux|messages)" || true
else
    log_warning "⚠️  Aucune table détectée - vérification des logs..."
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" logs postgres | tail -20
fi

echo ""
log_step "8. Redémarrage des autres services..."
$DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d

log_success "Tous les services redémarrés"

echo ""
log_step "9. Attente du démarrage complet..."
sleep 15

echo ""
log_info "Vérification finale des services :"
$DOCKER_COMPOSE -f "$COMPOSE_FILE" ps

echo ""
log_info "Logs récents du backend (pour vérifier la connexion DB) :"
$DOCKER_COMPOSE -f "$COMPOSE_FILE" logs backend --tail=10

echo ""
log_success "🎉 RECONSTRUCTION DE LA BASE DE DONNÉES TERMINÉE !"
echo ""
echo -e "${YELLOW}📊 Résumé :${NC}"
echo "• Base de données PostgreSQL complètement reconstruite"
echo "• Schéma complet recréé à partir de init-docker.sql"
echo "• $TABLES_COUNT tables créées"
echo "• Toutes les anciennes données ont été supprimées"
echo ""
echo -e "${YELLOW}🔧 Prochaines étapes :${NC}"
echo "• Créer un nouvel utilisateur administrateur"
echo "• Configurer les workspaces de base"
echo "• Tester la connexion et l'inscription"
echo ""
echo -e "${YELLOW}🌐 Accès :${NC}"
if [[ -d "/opt/supchat" ]]; then
    echo "• Frontend: http://185.98.137.166"
    echo "• API Backend: http://185.98.137.166:3000"
else
    echo "• Frontend: http://localhost:3001"
    echo "• API Backend: http://localhost:3000"
fi
echo ""
echo -e "${GREEN}✨ La base de données est maintenant vierge et prête à l'emploi !${NC}"
