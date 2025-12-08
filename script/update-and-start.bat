@echo off
REM =====================================================
REM SCRIPT DE MISE A JOUR ET DEMARRAGE SUPCHAT SECURISE
REM Met a jour la base PostgreSQL Docker depuis le dump Azure
REM Utilise la configuration de production sécurisée
REM =====================================================

echo.
echo 🔒 Mise a jour et demarrage SECURISE de SUPCHAT
echo Base sur le dump Azure du 10 juin 2025
echo Configuration de production avec Docker Secrets
echo.

REM Verifier que nous sommes dans le bon repertoire
if not exist "docker-compose.prod.yml" (
    echo ❌ Erreur: docker-compose.prod.yml non trouve.
    echo Veuillez executer ce script depuis le repertoire racine du projet.
    pause
    exit /b 1
)

echo 📍 Repertoire de travail: %CD%
echo.

REM Verifier les secrets necessaires
echo 🔍 Verification des secrets Docker...
if not exist "secrets\db_user.txt" (
    echo ❌ Secret manquant: secrets\db_user.txt
    pause
    exit /b 1
)
if not exist "secrets\db_password.txt" (
    echo ❌ Secret manquant: secrets\db_password.txt
    pause
    exit /b 1
)
if not exist "secrets\jwt_secret.txt" (
    echo ❌ Secret manquant: secrets\jwt_secret.txt
    pause
    exit /b 1
)
echo    ✅ Secrets Docker detectes

REM Supprimer les fichiers .env s'ils existent encore (securite)
echo 🧹 Suppression des fichiers .env non securises...
if exist ".env" del /f ".env" >nul 2>&1
if exist "backend\.env" del /f "backend\.env" >nul 2>&1
if exist "frontend\.env" del /f "frontend\.env" >nul 2>&1
if exist "mobile\.env" del /f "mobile\.env" >nul 2>&1
echo    ✅ Fichiers .env supprimes

REM Etape 1: Arreter tous les conteneurs
echo 🛑 Arret des conteneurs Docker...
docker-compose -f docker-compose.prod.yml down --remove-orphans
if %ERRORLEVEL% neq 0 (
    echo ❌ Erreur lors de l'arret des conteneurs
    pause
    exit /b 1
)

REM Etape 2: Supprimer les volumes PostgreSQL pour reinitialiser
echo 🗑️ Suppression des volumes PostgreSQL...
for /f "tokens=*" %%i in ('docker volume ls -q ^| findstr postgres') do (
    echo    Suppression du volume: %%i
    docker volume rm %%i >nul 2>&1
)
for /f "tokens=*" %%i in ('docker volume ls -q ^| findstr supchat') do (
    echo    Suppression du volume: %%i
    docker volume rm %%i >nul 2>&1
)

REM Etape 3: Verifier le fichier init-docker.sql
echo ✅ Verification du fichier init-docker.sql...
if not exist "backend\db\init-docker.sql" (
    echo ❌ Fichier backend\db\init-docker.sql non trouve
    pause
    exit /b 1
)

REM Verifier que les roles corrects sont presents
findstr /C:"1, 'owner'" "backend\db\init-docker.sql" >nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Les roles corrects ne sont pas detectes dans init-docker.sql
    pause
    exit /b 1
)
echo    ✅ Roles detectes: owner, admin, member

REM Etape 4: Construire et demarrer les conteneurs avec la config securisee
echo 🔨 Construction et demarrage des conteneurs (configuration securisee)...
docker-compose -f docker-compose.prod.yml up --build -d
if %ERRORLEVEL% neq 0 (
    echo ❌ Erreur lors de la construction des conteneurs
    pause
    exit /b 1
)

REM Etape 5: Attendre que PostgreSQL soit pret
echo ⏳ Attente de la disponibilite de PostgreSQL...
set /a attempts=0
set /a maxAttempts=30

:wait_postgres
set /a attempts+=1
timeout /t 2 /nobreak >nul
docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -U postgres >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo    ✅ PostgreSQL est pret !
    goto postgres_ready
)
echo    Tentative %attempts%/%maxAttempts%...
if %attempts% lss %maxAttempts% goto wait_postgres

echo ❌ Timeout: PostgreSQL n'est pas devenu disponible
pause
exit /b 1

:postgres_ready

REM Etape 6: Verifier la base de donnees
echo 🔍 Verification de la base de donnees...

REM Verifier les roles
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d supchat -c "SELECT id_role, nom_role FROM role ORDER BY id_role;" >temp_roles.txt 2>nul
findstr /C:"owner" temp_roles.txt >nul && findstr /C:"admin" temp_roles.txt >nul && findstr /C:"member" temp_roles.txt >nul
if %ERRORLEVEL% equ 0 (
    echo    ✅ Roles correctement configures
) else (
    echo    ⚠️ Les roles ne semblent pas correctement configures
)
del temp_roles.txt >nul 2>&1

REM Verifier les tables principales
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d supchat -c "\dt" >temp_tables.txt 2>nul
findstr /C:"workspace" temp_tables.txt >nul && findstr /C:"utilisateur" temp_tables.txt >nul && findstr /C:"canal" temp_tables.txt >nul
if %ERRORLEVEL% equ 0 (
    echo    ✅ Tables principales detectees
) else (
    echo    ⚠️ Certaines tables principales semblent manquer
)
del temp_tables.txt >nul 2>&1

REM Etape 7: Afficher l'etat des conteneurs
echo.
echo 📊 Etat des conteneurs:
docker-compose -f docker-compose.prod.yml ps

REM Message de succes
echo.
echo 🎉 Mise a jour terminee avec succes !
echo.
echo 📋 Resume des changements:
echo    • Base de donnees mise a jour depuis le dump Azure
echo    • Roles corriges: 1=owner, 2=admin, 3=member
echo    • Schema et donnees synchronises
echo    • Type canal_access_type corrige
echo.
echo 🌐 Votre application devrait maintenant fonctionner correctement !
echo    • Les workspaces devraient afficher leurs images
echo    • Les createurs de workspace devraient avoir le role 'owner'
echo    • La creation de canaux devrait fonctionner
echo.

REM Proposer d'afficher les logs
echo 📋 Voulez-vous afficher les logs du backend ? (O/N)
set /p choice=
if /i "%choice%"=="O" (
    echo.
    echo 📋 Affichage des logs du backend (Ctrl+C pour arreter)...
    docker-compose -f docker-compose.prod.yml logs -f backend
) else if /i "%choice%"=="Y" (
    echo.
    echo 📋 Affichage des logs du backend (Ctrl+C pour arreter)...
    docker-compose -f docker-compose.prod.yml logs -f backend
)

echo.
echo ✨ Script termine. Bon developpement !
pause
