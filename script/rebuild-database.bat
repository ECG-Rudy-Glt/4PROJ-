@echo off
REM =====================================================
REM SCRIPT DE RECONSTRUCTION COMPLETE DE LA BASE DE DONNEES
REM Recrée la base de données avec le nouveau schéma
REM =====================================================

echo.
echo 🔄 RECONSTRUCTION COMPLETE DE LA BASE DE DONNEES SUPCHAT
echo.

REM Verifier que nous sommes dans le bon repertoire
if not exist "docker-compose.yml" (
    echo ❌ Erreur: docker-compose.yml non trouve.
    echo Veuillez executer ce script depuis le repertoire racine du projet.
    pause
    exit /b 1
)

echo 📍 Repertoire de travail: %CD%
echo.

REM Arreter tous les conteneurs
echo 🛑 Arret des conteneurs...
docker-compose down
if %ERRORLEVEL% neq 0 (
    echo ⚠️ Erreur lors de l'arret des conteneurs (normal si deja arretes)
)

REM Supprimer le volume de la base de donnees pour forcer la recreation
echo 🗑️ Suppression du volume de la base de donnees...
docker volume rm supchat_postgres_data
if %ERRORLEVEL% neq 0 (
    echo ⚠️ Erreur lors de la suppression du volume (normal si deja supprime)
)

REM Supprimer les images pour forcer la reconstruction
echo 🗑️ Suppression des images pour forcer la reconstruction...
docker-compose build --no-cache
if %ERRORLEVEL% neq 0 (
    echo ❌ Erreur lors de la reconstruction des images
    pause
    exit /b 1
)

REM Demarrer les conteneurs
echo 🚀 Demarrage des conteneurs avec nouvelle base de donnees...
docker-compose up -d
if %ERRORLEVEL% neq 0 (
    echo ❌ Erreur lors du demarrage des conteneurs
    pause
    exit /b 1
)

REM Attendre que la base de donnees soit prete
echo ⏳ Attente de l'initialisation de la base de donnees...
timeout /t 20 /nobreak >nul

REM Afficher l'etat des conteneurs
echo 📊 Etat des conteneurs:
docker-compose ps

echo.
echo 📋 Affichage des logs d'initialisation de la base de donnees:
docker logs supchat-postgres --tail=30

echo.
echo ✅ RECONSTRUCTION TERMINEE !
echo.
echo 🌐 URLs de l'application:
echo    Frontend: http://185.98.137.166:3000
echo    Backend:  http://185.98.137.166:5000  
echo    PgAdmin:  http://185.98.137.166:8080
echo.
echo 📝 Note: La base de donnees a ete completement recreee avec le nouveau schema.
echo    Les utilisateurs systeme (Mistral AI, MistralOCR, System) ont ete ajoutes.
echo.
pause
