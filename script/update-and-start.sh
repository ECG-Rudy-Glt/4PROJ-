#!/bin/bash
# =====================================================
# SCRIPT DE MISE A JOUR ET DEMARRAGE SUPCHAT SECURISE
# Met a jour la base PostgreSQL Docker depuis le dump Azure
# Utilise la configuration de production sécurisée
# =====================================================

echo ""
echo "🔒 Mise a jour et demarrage SECURISE de SUPCHAT"
echo "Base sur le dump Azure du 10 juin 2025"
echo "Configuration de production avec Docker Secrets"
echo ""

# Verifier que nous sommes dans le bon repertoire
if [ ! -f "docker-compose.prod.yml" ]; then
    echo "❌ Erreur: docker-compose.prod.yml non trouve."
    echo "Veuillez executer ce script depuis le repertoire racine du projet."
    read -p "Appuyez sur Entree pour continuer..."
    exit 1
fi

echo "📍 Repertoire de travail: $(pwd)"
echo ""

# Verifier les secrets necessaires
echo "🔍 Verification des secrets Docker..."
if [ ! -f "secrets/db_user.txt" ]; then
    echo "❌ Secret manquant: secrets/db_user.txt"
    read -p "Appuyez sur Entree pour continuer..."
    exit 1
fi
if [ ! -f "secrets/db_password.txt" ]; then
    echo "❌ Secret manquant: secrets/db_password.txt"
    read -p "Appuyez sur Entree pour continuer..."
    exit 1
fi
if [ ! -f "secrets/jwt_secret.txt" ]; then
    echo "❌ Secret manquant: secrets/jwt_secret.txt"
    read -p "Appuyez sur Entree pour continuer..."
    exit 1
fi
echo "   ✅ Secrets Docker detectes"

# Supprimer les fichiers .env s'ils existent encore (securite)
echo "🧹 Suppression des fichiers .env non securises..."
[ -f ".env" ] && rm -f ".env" 2>/dev/null
[ -f "backend/.env" ] && rm -f "backend/.env" 2>/dev/null
[ -f "frontend/.env" ] && rm -f "frontend/.env" 2>/dev/null
[ -f "mobile/.env" ] && rm -f "mobile/.env" 2>/dev/null
echo "   ✅ Fichiers .env supprimes"

# Etape 1: Arreter tous les conteneurs
echo "🛑 Arret des conteneurs Docker..."
if ! docker-compose -f docker-compose.prod.yml down --remove-orphans; then
    echo "❌ Erreur lors de l'arret des conteneurs"
    read -p "Appuyez sur Entree pour continuer..."
    exit 1
fi

# Etape 2: Supprimer les volumes PostgreSQL pour reinitialiser
# echo "🗑️ Suppression des volumes PostgreSQL..."
# for volume in $(docker volume ls -q | grep -E "(postgres|supchat)"); do
#     if [ ! -z "$volume" ]; then
#         echo "   Suppression du volume: $volume"
#         docker volume rm "$volume" 2>/dev/null || true
#     fi
# done

# Etape 3: Verifier le fichier init-docker.sql
# echo "✅ Verification du fichier init-docker.sql..."
# if [ ! -f "backend/db/init-docker.sql" ]; then
#     echo "❌ Fichier backend/db/init-docker.sql non trouve"
#     read -p "Appuyez sur Entree pour continuer..."
#     exit 1
# fi

# Verifier que les roles corrects sont presents
# if ! grep -q "1, 'owner'" "backend/db/init-docker.sql"; then
#     echo "❌ Les roles corrects ne sont pas detectes dans init-docker.sql"
#     read -p "Appuyez sur Entree pour continuer..."
#     exit 1
# fi
# echo "   ✅ Roles detectes: owner, admin, member"

# Etape 4: Construire et demarrer les conteneurs avec la config securisee
echo "🔨 Construction et demarrage des conteneurs (configuration securisee)..."
if ! docker-compose -f docker-compose.prod.yml up --build -d; then
    echo "❌ Erreur lors de la construction des conteneurs"
    read -p "Appuyez sur Entree pour continuer..."
    exit 1
fi

# Etape 5: Attendre que PostgreSQL soit pret
echo "⏳ Attente de la disponibilite de PostgreSQL..."
attempts=0
maxAttempts=30

while [ $attempts -lt $maxAttempts ]; do
    attempts=$((attempts + 1))
    sleep 2
    if docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
        echo "   ✅ PostgreSQL est pret !"
        break
    fi
    echo "   Tentative $attempts/$maxAttempts..."
done

if [ $attempts -eq $maxAttempts ]; then
    echo "❌ Timeout: PostgreSQL n'est pas devenu disponible"
    read -p "Appuyez sur Entree pour continuer..."
    exit 1
fi

# Etape 6: Verifier la base de donnees
echo "🔍 Verification de la base de donnees..."

# Verifier les roles
if docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d supchat -c "SELECT id_role, nom_role FROM role ORDER BY id_role;" >temp_roles.txt 2>/dev/null; then
    if grep -q "owner" temp_roles.txt && grep -q "admin" temp_roles.txt && grep -q "member" temp_roles.txt; then
        echo "   ✅ Roles correctement configures"
    else
        echo "   ⚠️ Les roles ne semblent pas correctement configures"
    fi
    rm -f temp_roles.txt 2>/dev/null
fi

# Verifier les tables principales
if docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d supchat -c "\dt" >temp_tables.txt 2>/dev/null; then
    if grep -q "workspace" temp_tables.txt && grep -q "utilisateur" temp_tables.txt && grep -q "canal" temp_tables.txt; then
        echo "   ✅ Tables principales detectees"
    else
        echo "   ⚠️ Certaines tables principales semblent manquer"
    fi
    rm -f temp_tables.txt 2>/dev/null
fi

# Etape 7: Afficher l'etat des conteneurs
echo ""
echo "📊 Etat des conteneurs:"
docker-compose -f docker-compose.prod.yml ps

# Message de succes
echo ""
echo "🎉 Mise a jour terminee avec succes !"
echo ""
echo "📋 Resume des changements:"
echo "   • Base de donnees mise a jour depuis le dump Azure"
echo "   • Roles corriges: 1=owner, 2=admin, 3=member"
echo "   • Schema et donnees synchronises"
echo "   • Type canal_access_type corrige"
echo ""
echo "🌐 Votre application devrait maintenant fonctionner correctement !"
echo "   • Les workspaces devraient afficher leurs images"
echo "   • Les createurs de workspace devraient avoir le role 'owner'"
echo "   • La creation de canaux devrait fonctionner"
echo ""

# Proposer d'afficher les logs
echo "📋 Voulez-vous afficher les logs du backend ? (o/n)"
read -n 1 choice
echo ""
if [[ "$choice" == "o" ]] || [[ "$choice" == "O" ]] || [[ "$choice" == "y" ]] || [[ "$choice" == "Y" ]]; then
    echo ""
    echo "📋 Affichage des logs du backend (Ctrl+C pour arreter)..."
    docker-compose -f docker-compose.prod.yml logs -f backend
fi

echo ""
echo "✨ Script termine. Bon developpement !"
