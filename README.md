# SUPFile — Plateforme de stockage cloud souveraine & intelligente

SUPFile est une alternative française à Dropbox et Google Drive : stockage chiffré, IA documentaire embarquée (Bobby), MFA, coffre-fort, partage avancé — déployable en une commande.

---

## Démarrage rapide

### Prérequis

- [Docker](https://docs.docker.com/get-docker/) 24+
- [Docker Compose](https://docs.docker.com/compose/install/) 2.20+
- `make` — natif sur Linux/macOS, à installer sur Windows (voir ci-dessous)
- 8 Go de RAM minimum (16 Go recommandé avec Ollama actif)
- 20 Go d'espace disque libre

**Installation de `make` sur Windows** (terminal administrateur requis) :

```powershell
# Via Chocolatey
choco install make

# Via winget
winget install GnuWin32.Make
```

Sans `make`, les scripts sont directement utilisables :

```powershell
# Production (PowerShell)
.\scripts\START.ps1

# Développement (Git Bash)
bash scripts/hot-start.sh
```

### Installation

```bash
# 1. Cloner le dépôt
git clone https://github.com/<org>/supfile.git
cd supfile

# 2. Copier et configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos valeurs (voir section Variables d'environnement)
```

### Lancement

```bash
# Mode développement (hot reload, IP auto-détectée)
make dev

# Mode production locale
make start

# Avec profil IA activé
make start AI=1

# Voir toutes les commandes disponibles
make help
```

**Sur Windows sans `make`**, utilisez PowerShell directement :

```powershell
# Développement
.\scripts\hot-start.ps1

# Production
.\scripts\START.ps1

# Production avec IA
.\scripts\START.ps1 -Ai

# Mobile
.\scripts\start-mobile.ps1
```

Le premier démarrage télécharge le modèle Ollama (~1,6 Go). L'application est disponible dès que le service `backend` est `healthy`.

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5001 |
| Swagger UI | http://localhost:5001/api-docs |
| MinIO Console | http://localhost:9001 |
| OnlyOffice | http://localhost:8080 |

---

## Commandes Make

### Développement (Docker)

| Commande | Description |
|---|---|
| `make dev` | Démarre en mode hot-reload (IP auto-détectée, .env configuré automatiquement) |
| `make stop-dev` | Arrête les services de développement |
| `make logs-dev` | Suit les logs de tous les containers dev en temps réel |
| `make db-push` | Synchronise le schéma Prisma avec la base de données |

### Production (Docker)

| Commande | Description |
|---|---|
| `make start` | Démarre les services en mode production |
| `make start AI=1` | Démarre en production avec le profil IA (Ollama) activé |
| `make stop` | Arrête les services de production |
| `make logs` | Suit les logs de production en temps réel |

### Mobile (Expo)

| Commande | Description |
|---|---|
| `make mobile` | Démarre le serveur Expo (installe les dépendances automatiquement) |
| `make mobile-android` | Lance l'app sur un appareil/émulateur Android |
| `make mobile-ios` | Lance l'app sur le simulateur iOS (macOS uniquement) |
| `make mobile-web` | Lance l'app dans le navigateur web |
| `make mobile-install` | Installe uniquement les dépendances npm du projet mobile |
| `make mobile-clean` | Nettoie le cache Expo et réinstalle les dépendances |
| `make mobile-tunnel` | Démarre Expo en mode tunnel (accès externe via QR code) |

**Prérequis mobile :**
- Node.js 20+ et npm
- Pour Android : Android Studio avec un émulateur ou appareil USB
- Pour iOS : macOS avec Xcode et simulateur
- Expo Go app sur votre téléphone pour le développement rapide

### Configuration

| Commande | Description |
|---|---|
| `make configure-network` | Détecte l'IP locale et met à jour le fichier .env |
| `make status` | Affiche l'état des containers Docker en cours d'exécution |

### IA / Machine Learning

| Commande | Description |
|---|---|
| `make pull-model` | Télécharge le modèle Ollama par défaut (gemma2:2b) |
| `make pull-model MODEL=nom` | Télécharge un modèle spécifique (ex: `MODEL=qwen2.5:0.5b`) |

### Maintenance

| Commande | Description |
|---|---|
| `make clean` | Arrête tous les services et supprime les volumes Docker |
| `make backup` | Sauvegarde PostgreSQL et MinIO (Unix/Linux uniquement) |
| `make restore POSTGRES=<file> MINIO=<file>` | Restaure depuis une sauvegarde |

### Équivalents PowerShell (Windows sans make)

| Make | PowerShell |
|---|---|
| `make dev` | `.\scripts\hot-start.ps1` |
| `make start` | `.\scripts\START.ps1` |
| `make start AI=1` | `.\scripts\START.ps1 -Ai` |
| `make mobile` | `.\scripts\start-mobile.ps1` |
| `make mobile-android` | `.\scripts\start-mobile.ps1 -Platform android` |
| `make mobile-web` | `.\scripts\start-mobile.ps1 -Platform web` |
| `make mobile-install` | `.\scripts\start-mobile.ps1 -InstallOnly` |
| `make mobile-clean` | `.\scripts\start-mobile.ps1 -Clean` |
| `make mobile-tunnel` | `.\scripts\start-mobile.ps1 -Tunnel` |
| `make configure-network` | `.\scripts\configure-network.ps1` |
| `make stop-dev` | `docker compose -f docker-compose.dev.yml down` |
| `make stop` | `docker compose -f docker-compose.yml down` |

---

## Variables d'environnement

Copiez `.env.example` en `.env` et renseignez les valeurs obligatoires :

```bash
# === OBLIGATOIRES (le backend crashe au démarrage si absent) ===
JWT_SECRET=<chaine-aleatoire-min-32-chars>
JWT_MFA_SECRET=<chaine-aleatoire-min-32-chars>
DEK_WRAP_SECRET=<chaine-aleatoire-min-32-chars>
FILE_ENCRYPTION_KEY=<chaine-aleatoire-min-32-chars>
ONLYOFFICE_JWT_SECRET=<chaine-aleatoire-min-32-chars>
MFA_ENCRYPTION_KEY=<openssl rand -hex 32>

# === Base de données ===
POSTGRES_USER=supfile
POSTGRES_PASSWORD=<mot-de-passe-bdd>
POSTGRES_DB=supfile

# === MinIO (stockage objet) ===
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=<mot-de-passe-minio>
MINIO_APP_ACCESS_KEY=supfile-app
MINIO_APP_SECRET_KEY=<mot-de-passe-app-minio>

# === OAuth2 (optionnel — connexion Google/GitHub) ===
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
# Callbacks VPS :
# https://supfile.tech/api/auth/google/callback
# https://supfile.tech/api/auth/github/callback

# === Stripe test (optionnel — plans payants de démonstration) ===
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_BUSINESS_MONTHLY=
STRIPE_PRICE_ENTERPRISE_MONTHLY=

# === Email (optionnel — invitations, alertes expiration liens) ===
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# === Web Push (optionnel — notifications navigateur) ===
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# === IA (configuré automatiquement en Docker) ===
BRAIN_API_URL=http://brain-api:8001
OLLAMA_MODEL=gemma2:2b
```

Le fichier `.env` réel n'est pas versionné. Pour la préproduction VPS, utilisez un `.env` dédié sur le serveur et suivez [`doc/PREPROD_VPS.md`](doc/PREPROD_VPS.md).

---

## Architecture

```
Navigateur / App mobile
        |
        v
  nginx :3000
  (frontend React)
        | /api  proxy
        v
  backend :5001  (Node.js / Express / TypeScript)
        |-- PostgreSQL :5432  (metadonnees, BDD)
        |-- MinIO              (fichiers chiffres S3)
        |-- OnlyOffice :8080   (edition Office)
        +-- brain-api :8001   (IA Python / FastAPI)
                 |-- Ollama    (LLM local gemma2:2b)
                 +-- ChromaDB  (base vectorielle RAG)

  App mobile (Expo / React Native)
```

**7 services Docker**, **1 réseau bridge interne**, base de données et MinIO non exposés à l'hôte.

---

## Services Docker

| Service | Image | Rôle | Port exposé |
|---|---|---|---|
| `frontend` | nginx:alpine (build React) | Interface web + reverse proxy | `3000` |
| `backend` | Node.js 20 custom | API REST + WebSocket | `5001` |
| `postgres` | postgres:16-alpine | Base de données principale | — (interne) |
| `minio` | minio:2025-01 | Stockage objet S3 | — (interne) |
| `onlyoffice` | documentserver:8.2.2 | Édition collaborative Office | — (interne) |
| `ollama` | ollama:0.5.4 | Inférence LLM locale | — (interne) |
| `brain-api` | Python FastAPI custom | RAG + embeddings | — (interne) |

---

## Stack technique

| Couche | Technologies |
|---|---|
| **Frontend web** | React 18, TypeScript, Vite, TailwindCSS, Zustand, Socket.IO |
| **Backend** | Node.js 20, Express, TypeScript, Prisma, PostgreSQL, MinIO |
| **IA (brain-api)** | Python, FastAPI, Ollama, ChromaDB, fastembed |
| **Mobile** | React Native 0.81, Expo SDK 54, Zustand, expo-secure-store |
| **Sécurité** | AES-256-GCM, PBKDF2 100k iter, JWT versionné, MFA TOTP, Helmet |
| **DevOps** | Docker Compose, GitHub Actions, Semgrep, TruffleHog, Dockle |

---

## Fonctionnalités principales

- **Stockage** : upload drag & drop, quota par plan, corbeille 90 jours, versioning fichiers
- **Sécurité** : chiffrement AES-256 au repos (architecture KEK/DEK), MFA TOTP, coffre-fort chiffré (Vault)
- **Partage** : liens publics (mot de passe + expiration + quota de téléchargements), partage interne avec permissions granulaires (lecture/écriture/suppression/re-partage)
- **Prévisualisation** : images, vidéo, audio, PDF, Markdown, CSV, DOCX/XLSX/PPTX via OnlyOffice
- **IA — Bobby** : assistant documentaire RAG (recherche sémantique, analyse, génération de fichiers) — 100% on-premise
- **Temps réel** : notifications et partages via Socket.IO (WebSocket)
- **Mobile** : application iOS/Android (Expo), token stocké dans le Keychain/Keystore OS
- **Admin** : dashboard KPIs, gestion des plans, export CSV, réindexation IA
- **RGPD** : export de toutes les données personnelles, audit log 30+ événements, purge automatique

---

## Documentation

| Document | Contenu |
|---|---|
| [`doc/BACKEND_DOC.md`](doc/BACKEND_DOC.md) | Architecture backend, endpoints, sécurité, modèle de données |
| [`doc/FRONTEND_DOC.md`](doc/FRONTEND_DOC.md) | Architecture frontend, stores Zustand, composants, mobile |
| [`doc/BOBBY.md`](doc/BOBBY.md) | Documentation du microservice IA brain-api (RAG, ChromaDB, Ollama) |
| [`doc/PREPROD_VPS.md`](doc/PREPROD_VPS.md) | Déploiement préproduction VPS, OAuth, Stripe test, backup/restore |
| [`doc/MANUEL_UTILISATEUR.md`](doc/MANUEL_UTILISATEUR.md) | Guide utilisateur complet avec emplacements captures d'écran |
| [`doc/PRESENTATION/PRESENTATION_CICD.md`](doc/PRESENTATION/PRESENTATION_CICD.md) | Pipeline CI/CD GitHub Actions, SAST, SBOM, Dockle |
| [`doc/PRESENTATION/`](doc/PRESENTATION/) | Supports de présentation orale (architecture, sécurité, frontend, CEO) |

---

## Tests

```bash
# Tests unitaires backend
cd backend && npm test

# Tests d'intégration (nécessite l'application en cours d'exécution)
cd scripts && pip install -r requirements.txt
python test_e2e.py        # 79/80 — sécurité & infrastructure
python test_features.py   # 68/68 — fonctionnalités avancées

# Tests E2E frontend
cd frontend && npx cypress run
```

---

## CI/CD

Le pipeline GitHub Actions exécute à chaque push :

1. **Validation** — vérification des secrets obligatoires
2. **Backend** — build TypeScript + tests Jest + npm audit
3. **Frontend** — lint ESLint + build Vite + tests Cypress E2E + npm audit
4. **Sécurité** — Semgrep (SAST) + TruffleHog (secrets dans l'historique git)
5. **Docker** — build images + Dockle (audit CIS) + génération SBOM (SPDX-JSON)
6. **Push** — images taguées `:latest` + `:sha` vers GHCR (branche `main` uniquement)

---

## Récapitulatif des fonctionnalités implémentées

> Couverture : backend API + client web (React) + client mobile (Expo/React Native)

### Authentification & Identité

| Fonctionnalité | Web | Mobile | Détail |
|---|---|---|---|
| Inscription avec validation des champs | V | V | email, mot de passe min 6 chars, confirmation |
| Connexion email / mot de passe | V | V | JWT, bcrypt, gestion erreurs |
| Gestion de session JWT | V | V | tokenVersion pour révocation globale |
| Déconnexion de tous les appareils | V | V | incrémente tokenVersion côté serveur |
| Connexion OAuth2 Google | V | — | Passport.js, création compte auto |
| Connexion OAuth2 GitHub | V | — | Passport.js, création compte auto |
| MFA TOTP (Google Authenticator) | V | V | speakeasy, QR code, backup codes bcrypt |
| Appareils de confiance (skip MFA 30 j) | V | V | fingerprint SHA-256 |

### Gestion des fichiers & dossiers

| Fonctionnalité | Web | Mobile | Détail |
|---|---|---|---|
| Création de dossiers | V | V | arborescence récursive |
| Navigation avec fil d'Ariane | V | V | breadcrumbs cliquables |
| Upload de fichiers avec progression | V | V | barre par fichier, batch 3 simultanés |
| Vérification quota avant upload | V | V | côté client ET côté serveur |
| Renommage fichiers & dossiers | V | V | |
| Déplacement (drag & drop web / menu mobile) | V | V | HTML5 natif web, menu contextuel mobile |
| Suppression  corbeille (soft delete) | V | V | 90 jours avant purge automatique |
| Restauration depuis la corbeille | V | V | |
| Suppression définitive | V | V | |
| Marquage en favori | V | V | |

### Prévisualisation & téléchargement

| Fonctionnalité | Web | Mobile | Détail |
|---|---|---|---|
| Prévisualisation images (JPG, PNG, GIF, WebP) | V | V | blob  ObjectURL |
| Prévisualisation PDF | V | V | WebView mobile |
| Prévisualisation Markdown avec rendu | V | — | react-markdown + coloration |
| Prévisualisation CSV (tableau) | V | — | |
| Streaming vidéo intégré (MP4, AVI…) | V | V | Range headers, expo-video |
| Streaming audio intégré (MP3, WAV…) | V | V | |
| Édition DOCX / XLSX / PPTX (OnlyOffice) | V | — | WebView lecture seule sur mobile |
| Téléchargement fichier unitaire | V | V | |
| Téléchargement dossier complet en ZIP | V | — | généré à la volée côté serveur |

### Partage & collaboration

| Fonctionnalité | Web | Mobile | Détail |
|---|---|---|---|
| Lien public unique | V | V | token UUID, accès sans compte |
| Protection par mot de passe (lien public) | V | V | hashé bcrypt |
| Date d'expiration (lien public) | V | V | |
| Limite de téléchargements (lien public) | V | V | |
| Partage interne entre utilisateurs | V | V | dossiers et fichiers |
| Permissions granulaires | V | V | lecture / écriture / suppression / re-partage |
| Invitation par email | V | — | nodemailer |
| Acceptation / rejet du partage | V | V | |
| Révocation d'un partage | V | V | |

### Dashboard & Recherche

| Fonctionnalité | Web | Mobile | Détail |
|---|---|---|---|
| Visualisation quota utilisé / total | V | V | barre colorée vert/orange/rouge |
| Graphique répartition par type (PieChart) | V | — | Recharts |
| Accès rapide aux fichiers récents | V | V | |
| Statistiques d'activité | V | V | uploads, downloads, partages |
| Recherche par nom / extension | V | V | |
| Filtrage par type MIME | V | — | |
| Filtrage par date | V | — | |
| Recherche sémantique IA (Bobby) | V | — | RAG ChromaDB |

### Bonus implémentés

| Bonus | Statut | Détail |
|---|---|---|
| Drag & drop upload (global, dossiers entiers) | V | overlay plein écran, webkitRelativePath |
| Déplacement par drag & drop | V | attribut custom dataTransfer |
| Partage avancé (mot de passe + expiration + quota) | V | sur liens publics et partages internes |
| Chiffrement fichiers côté serveur (KEK/DEK) | V | AES-256-GCM + PBKDF2 100k itérations |
| MFA / TOTP | V | speakeasy, backup codes, appareils de confiance |
| Coffre-fort chiffré (Vault) | V | mot de passe séparé, MFA requis, lockout 5 tentatives |
| IA documentaire Bobby (RAG) | V | FastAPI + ChromaDB + fastembed + Ollama on-premise |
| Versioning des fichiers | V | historique + restauration |
| Tags personnalisés (nom + couleur) | V | filtrage par tag |
| Commentaires & threads | V | temps réel WebSocket |
| Notifications temps réel | V | Socket.IO + Web Push API |
| Audit log complet | V | 30+ types d'événements, export CSV |
| Export RGPD des données personnelles | V | CSV complet sans données sensibles |
| Organisations multi-membres | V | rôles Owner / Admin / Member |
| Délégation d'accès entre comptes | V | permissions granulaires, révocable |
| Administration (KPIs, gestion plans, export) | V | dashboard admin dédié |
| Application mobile iOS/Android | V | Expo SDK 54, expo-secure-store |
| Internationalisation FR/EN | V | i18next, détection langue navigateur |
| Thème clair / sombre | V | CSS variables, persisté en BDD |
| CI/CD avec sécurité intégrée | V | Semgrep, TruffleHog, Dockle, SBOM |

---

## Plans

| | FREE | PRO | BUSINESS | ENTERPRISE |
|---|---|---|---|---|
| Stockage | 30 Go | 100 Go | 500 Go | Sur devis |
| IA Bobby | X | V | V | V |
| Coffre-fort | X | V | V | V |
| Organisations | X | X | V | V |
| Versioning | X | 10 versions | 30 versions | Illimité |
| Prix | Gratuit | 9,99 €/mois | 24,99 €/mois | Sur devis |

---

## Sécurité — signaler une vulnérabilité

Ouvrez une issue privée ou contactez l'équipe directement. Ne publiez pas de vulnérabilité en clair dans les issues publiques.

---

*Dernière mise à jour : Mai 2026*
