Mode opératoire — Lancer le projet et démarrer avec le compte admin
===============================================================

Objet
-----
Ce document décrit la procédure pour démarrer l'application en local (production locale via Docker) et s'assurer qu'un premier compte `ADMIN` est créé et activé.

Prérequis
---------
- Docker (avec `docker compose`) installé et en cours d'exécution
- `bash`, `curl` disponibles
- Ports ouverts localement : `3000`, `5001`, `8080`

Étapes (rapide)
----------------
1. Depuis la racine du dépôt, configurer le réseau :

   `./scripts/configure-network.sh` (répondre `O` pour accepter l'IP détectée)

   Astuce automatique : `printf "O\n" | ./scripts/configure-network.sh`

2. Démarrer l'application (prod locale) :

   `./scripts/START.sh`

   (pour dev hot-reload utiliser : `./scripts/hot-start.sh`)

3. Attendre que les conteneurs démarrent et que le `backend` soit `healthy` :

   `docker compose ps`  — vérifier la ligne `backend` (statut `Up ... (healthy)`).

4. Créer le compte admin (exemple par défaut) :

   `curl -s -X POST http://localhost:5001/api/auth/register -H 'Content-Type: application/json' -d '{"email":"admin@local.test","password":"Password123!","firstName":"Admin","lastName":"Local"}'`

   Remplace `admin@local.test` / `Password123!` par ton choix si nécessaire.

5. Vérifier (dry-run) la promotion du premier compte :

   `docker compose exec -T backend npm run admin:first:dry-run`

   - Si la sortie affiche quelque chose comme `[DRY-RUN] Would promote first account to admin: ...` -> OK pour promouvoir.
   - Si la sortie contient `deleted-` ou `INACTIVE` (ou `inactive`) -> NE PAS lancer `admin:first`. Promeut plutôt un compte existant (voir point 7).

6. Si le dry-run est OK, lancer la promotion :

   `docker compose exec -T backend npm run admin:first`

7. Cas d'erreurs courantes
-------------------------
- Erreur `Cannot find module '../src/config/environment'` lors du `admin:first:dry-run` :

  Cela signifie que le conteneur d'exécution n'a pas le dossier `src` (les scripts TypeScript importent `src/...`). Solution rapide :

  1. Copier `backend/src` dans le conteneur backend :

     `docker cp backend/src $(docker compose ps -q backend):/app/src`

  2. Relancer le `admin:first:dry-run` puis `admin:first` si le dry-run est OK.

- Si le dry-run montre un compte supprimé ou INACTIVE (p.ex. `deleted-...@deleted.supfile.local`) :

  Promeut manuellement le vrai compte par e‑mail :

  `cd backend`
  `npx tsx scripts/promote-to-admin.ts ton-email@exemple.com`

8. Connexion
------------
- Frontend : `http://localhost:3000` (ou l'IP configurée par `configure-network.sh`)
- Pour récupérer un token via l'API :

  `curl -s -X POST http://localhost:5001/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@local.test","password":"Password123!"}'`

Sécurité
--------
- Change immédiatement le mot de passe de l'admin après connexion.
- Active le MFA si nécessaire.

Script d'automatisation
-----------------------
Un script d'automatisation est fourni dans `scripts/start-with-admin.sh` pour exécuter automatiquement les étapes ci‑dessus (config réseau, démarrage, enregistrement du compte, dry-run et promotion si sûr).

Usage rapide :

`EMAIL=admin@local.test PASSWORD=Password123! bash scripts/start-with-admin.sh`

Annexes
-------
- Emplacements : frontend `http://localhost:3000` — backend API `http://localhost:5001`
- Si tu veux que j'exécute le script maintenant, dis "exécute".
