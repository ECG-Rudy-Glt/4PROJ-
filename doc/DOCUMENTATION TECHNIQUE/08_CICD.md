# SUPFile - CI/CD & DevSecOps

---

## Pipeline GitHub Actions - Vue d'ensemble

Fichier : `.github/workflows/ci.yml`

Declenchement : **push** et **pull request** sur la branche `main`.

![CI/CD Pipeline](img/supfile_architecture-CI_CD%20Pipeline.drawio.png)

**Principe de moindre privilege** : permissions globales `contents: read` ; seul `docker-push` eleve a `packages: write` pour GHCR.

---

## Jobs en detail

### [1] validate-env
- Verifie que `JWT_SECRET` et `FILE_ENCRYPTION_KEY` sont bien configures dans les secrets GitHub Actions
- Bloque tout le pipeline si l'un est absent -- les jobs suivants ne demarrent pas
- Evite de consommer des minutes CI pour des runs voues a l'echec

---

### [2a] backend-checks

| Etape | Outil | Resultat attendu |
|---|---|---|
| Install | `npm install` | dependances resolues |
| Prisma client | `npx prisma generate` | types TypeScript generes |
| Build TypeScript | `npm run build` | 0 erreur de compilation |
| Tests unitaires | `npm test --coverage` | couverture affichee, suite verte |
| Audit npm | `npm audit --audit-level=high` | 0 vulnerabilite HIGH/CRITICAL |

**Variables CI injectees** : `JWT_SECRET`, `FILE_ENCRYPTION_KEY`, `DEK_WRAP_SECRET`, `DATABASE_URL`, `NODE_ENV=test`

Cache `node_modules` cle sur `package.json` -- restauration instantanee si pas de changement de dependances.

---

### [2b] frontend-checks

| Etape | Outil | Resultat attendu |
|---|---|---|
| Install | `npm install` | dependances resolues |
| Linting | `npm run lint` (ESLint + TS ESLint) | 0 erreur |
| Build Vite | `npm run build` | bundle produit sans erreur |
| Audit npm | `npm audit --audit-level=high` | 0 vulnerabilite HIGH/CRITICAL |
| Tests E2E | Cypress via `npm run preview` | suite verte sur build statique |

Cache `node_modules` + `~/.cache/Cypress` -- evite le re-telechargement du binaire Cypress (~200 Mo).

---

### Validation desktop Windows Sync

Le client SupFile Sync Windows est un package separe dans `desktop/`. La validation minimale avant release est :

| Etape | Outil | Resultat attendu |
|---|---|---|
| Install | `npm install` | dependances resolues |
| Typecheck | `npm run lint` | main/preload/renderer sans erreur TypeScript |
| Build | `npm run build` | renderer Vite + main Electron generes |
| Packaging Windows | `npm run dist:win` | `desktop/release/SupFile-Sync-Setup.exe` genere |

Cette validation peut etre ajoutee comme job CI dedie. Le packaging `.exe` ne doit pas publier d'artefact public ni signer l'executable sans pipeline release controlee et certificat de signature.

---

### [2c] semgrep - SAST

- Outil : **Semgrep** (container officiel `semgrep/semgrep`)
- Regles appliquees :
  - `p/default` - regles communautaires generales
  - `p/nodejs` - patterns specifiques Node.js (injection, path traversal, prototype pollution)
  - `p/react` - XSS, dangerouslySetInnerHTML, event handler injection
- Mode : `--severity ERROR --error` -- tout finding ERROR bloque le pipeline
- Aucun secret ou cle API necessaire -- analyse purement statique

---

### [2d] trufflehog - Detection de secrets

- Outil : **TruffleHog v3** (binaire installe depuis le script officiel)
- Perimetre : **tout l'historique git** (`fetch-depth: 0` pour avoir les commits complets)
- Mode : `--only-verified` -- seuls les secrets **actifs et confirmes** (appel API reussi) bloquent le pipeline
- Evite les faux positifs sur des cles revoquees ou des valeurs de demo
- Detection couvre : cles AWS, GitHub tokens, Stripe, SendGrid, Google Cloud, Twilio, et 700+ autres detecteurs

---

### [3] docker-build

**Build des images** :
- Backend : `./backend` -> `backend:ci`
- Frontend : `./frontend` -> `frontend:ci`
- Cache BuildKit GitHub Actions (`type=gha`) par scope -- build incremental sur les layers non modifies

**Dockle - Audit Dockerfile (CIS Docker Benchmark)** :
- Niveau de blocage : `--exit-level fatal` (avertissements non bloquants, erreurs critiques bloquantes)
- Backend : scan sans exceptions
- Frontend : exception `CIS-DI-0010` (faux positif confirme -- signature nginx dans `nginx-unprivileged`)
- Les deux jobs ont `continue-on-error: true` -- les findings sont loggues sans casser le pipeline

**SBOM - Software Bill of Materials** :
- Outil : `anchore/sbom-action`
- Format : **SPDX-JSON** (standard NTIA, requis NIS2 supply chain)
- Deux fichiers produits : `sbom-backend.spdx.json` + `sbom-frontend.spdx.json`
- Conserves **90 jours** comme artefacts CI -- tracabilite complete de la chaine d'approvisionnement logicielle

---

### [4] docker-push (main uniquement)

Conditionne par `github.event_name == 'push' && github.ref == 'refs/heads/main'`.

**Deux tags par image** :
- `:latest` -- derniere version stable sur main
- `:<git-sha>` -- tag immutable lie au commit exact (rollback possible)

**Registre** : **GHCR** (GitHub Container Registry) -- authentifie via `GITHUB_TOKEN` (ephemere, aucun secret long-terme).

Normalisation du nom de depot : `ECG-Rudy-Glt/4PROJ-` -> `ecg-rudy-glt/4proj` (minuscules, sans tiret final).

---

### [5] deploy-prod

Conditionne par `github.event_name == 'push' && github.ref == 'refs/heads/main'`.

Fonctionnement :
1. Validation fail-fast des variables et secrets de deploiement (`PROD_*`, `GHCR_PAT`, `.env` prod)
2. Connexion SSH au VPS via cle privee (`PROD_SSH_PRIVATE_KEY`)
3. Creation/correction des droits sur `PROD_DEPLOY_PATH`
4. Copie `docker-compose.yml`, `docker-compose.vps.yml`, `nginx.vps.conf`, `.env` et scripts de maintenance
5. `docker compose pull` des images taguees avec le SHA du commit depuis GHCR
6. `docker compose up -d --no-build --remove-orphans` pour les services web/backend essentiels
7. Recréation forcee du reverse proxy pour charger le `nginx.vps.conf` recopie
8. Health checks publics sur `/` et `/health`
9. Nettoyage des images de plus de 7 jours (`docker image prune --filter until=168h`)

Le profil `ai` n'est pas active par defaut dans la pipeline VPS: le service `brain-api` utilise un build local (`./brain-api`) et necessite soit la copie du dossier sur le VPS, soit une image publiee dans GHCR.

---

## Secrets GitHub Actions requis

| Secret | Usage |
|---|---|
| `JWT_SECRET` | Backend : signature JWT (obligatoire) |
| `FILE_ENCRYPTION_KEY` | Backend : KEK chiffrement fichiers (obligatoire) |
| `JWT_MFA_SECRET` | Backend : signature des jetons MFA temporaires |
| `DEK_WRAP_SECRET` | Backend : wrapping DEK |
| `ONLYOFFICE_JWT_SECRET` | Backend/OnlyOffice : signature des callbacks et configs |
| `MFA_ENCRYPTION_KEY` | Backend : chiffrement secrets TOTP |
| `DATABASE_URL` | Backend : connexion PostgreSQL (tests) |
| `GITHUB_TOKEN` | Docker push GHCR (fourni automatiquement par GitHub) |
| `PROD_SSH_PRIVATE_KEY` | Cle privee SSH utilisee pour se connecter au VPS |
| `GHCR_PAT` | Token avec `read:packages` pour que le VPS pull les images GHCR |
| `PROD_ENV_FILE_CONTENT` | Contenu complet du `.env` de production copie dans `PROD_DEPLOY_PATH/.env` |

Variables (`vars`) : `VITE_API_URL`, `PROD_DEPLOY_HOST`, `PROD_DEPLOY_PATH`, `PROD_DEPLOY_USER`

`PROD_DEPLOY_HOST` doit etre un nom d'hote sans protocole, par exemple `supfile.tech` et non `https://supfile.tech`.

Pour le deploiement VPS, `PROD_DEPLOY_USER` doit pouvoir executer `sudo mkdir` et `sudo chown` sur `PROD_DEPLOY_PATH`. La workflow remet l'ownership du dossier de deploiement avant les `scp` pour eviter les erreurs `Permission denied` si `/opt/supfile` a ete cree par `root`.

---

## Choix techniques justifies

| Choix | Alternative | Raison |
|---|---|---|
| Semgrep | SonarQube, CodeQL | Gratuit, open-source, container leger, regles communautaires riches Node/React |
| TruffleHog `--only-verified` | `--no-verification` | Elimine les faux positifs sur secrets revoquees ou de demo |
| SBOM SPDX-JSON | CycloneDX | Standard NTIA, interoperable, requis NIS2 supply chain |
| Dockle | Trivy, Snyk | Specialise Dockerfile CIS Benchmark, leger, sans registre externe |
| Docker BuildKit cache GHA | Pas de cache | Reduit le temps de build de ~4min a ~90s sur les layers stables |
| Tag `:sha` + `:latest` | Tag `:latest` seul | Rollback deterministe vers n'importe quel commit |
| Permissions `contents: read` globales | Permissions larges | Principe de moindre privilege -- isolation des droits par job |
