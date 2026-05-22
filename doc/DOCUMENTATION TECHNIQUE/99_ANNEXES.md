# Annexes - SUPFile

## Liens utiles

| Ressource | URL |
|-----------|-----|
| Site production | https://supfile.tech/ |
| API Swagger | https://supfile.tech/api-docs |
| Repository GitHub | https://github.com/ECG-Rudy-Glt/4PROJ- |

---

## Glossaire

| Terme | Definition |
|-------|------------|
| KEK | Key Encryption Key - cle maitre derivee du mot de passe utilisateur via PBKDF2 |
| DEK | Data Encryption Key - cle unique par fichier, chiffree par la KEK |
| MFA | Multi-Factor Authentication - authentification a deux facteurs |
| TOTP | Time-based One-Time Password - code a 6 chiffres genere toutes les 30s |
| Coffre-fort (Vault) | Espace securise avec mot de passe dedie, chiffrement separe |
| Bobby | Assistant IA integre base sur gemma2:2b (Ollama) |
| RAG | Retrieval-Augmented Generation - recherche semantique + LLM |
| ChromaDB | Base de donnees vectorielle pour les embeddings |
| JWT | JSON Web Token - token d'authentification |
| OAuth2 | Protocole d'authentification (Google, GitHub) |
| WebSocket | Connexion bidirectionnelle temps reel (Socket.io) |
| RBAC | Role-Based Access Control - gestion des permissions |
| RGPD | Reglement General sur la Protection des Donnees |
| SAST | Static Application Security Testing (Semgrep) |
| SBOM | Software Bill of Materials - inventaire des dependances |

---

## Variables d'environnement

### Backend (.env)

```bash
# Base de donnees
DATABASE_URL=postgresql://user:pass@localhost:5432/supfile

# Securite JWT (obligatoire)
JWT_SECRET=<openssl rand -base64 48>
JWT_MFA_SECRET=<openssl rand -base64 48>
DEK_WRAP_SECRET=<openssl rand -base64 48>
FILE_ENCRYPTION_KEY=<openssl rand -base64 48>
MFA_ENCRYPTION_KEY=<openssl rand -hex 32>

# Stockage S3/MinIO
S3_ENDPOINT=http://minio:9000
S3_BUCKET=supfile-uploads
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=<mot de passe>

# IA Bobby
BRAIN_API_URL=http://brain-api:8001
OLLAMA_MODEL=gemma2:2b

# OAuth2 (optionnel)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Stripe (mode test)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...

# Web Push
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

### Frontend (.env)

```bash
VITE_API_URL=http://localhost:5001
VITE_SOCKET_URL=http://localhost:5001
VITE_DESKTOP_DOWNLOAD_URL=/downloads/SupFile-Sync-Setup.exe
```

### Mobile (.env)

```bash
API_URL=http://192.168.x.x:5001
```

---

## Ports par defaut

| Service | Port | Description |
|---------|------|-------------|
| Frontend (prod) | 3000 | Nginx reverse proxy |
| Frontend (dev) | 5173 | Vite dev server |
| Backend API | 5001 | Express.js |
| Desktop renderer dev | 5174 | Vite dev server Electron |
| Bobby IA | 8001 | FastAPI |
| PostgreSQL | 5432 | Base de donnees |
| MinIO | 9000 | Stockage S3 |
| MinIO Console | 9001 | Interface admin MinIO |
| OnlyOffice | 8080 | Editeur Office |
| Ollama | 11434 | LLM local |

---

## Commandes utiles

### Docker

```bash
# Demarrer en dev
make dev

# Demarrer en prod
make start

# Avec IA
make start AI=1

# Logs
make logs

# Arreter
make stop

# Nettoyer volumes
make clean
```

### Base de donnees

```bash
# Migrations Prisma
cd backend && npx prisma migrate dev

# Seed
npx prisma db seed

# Studio (GUI)
npx prisma studio
```

### Mobile

```bash
# Demarrer Expo
make mobile

# Android
make mobile-android

# iOS
make mobile-ios

# Tunnel (QR code externe)
make mobile-tunnel
```

### Desktop Windows Sync

```bash
# Depuis desktop/
npm install
npm run lint
npm run build
npm run dist:win
```

L'installeur est genere dans `desktop/release/SupFile-Sync-Setup.exe`.

---

## Structure du projet

```
4PROJ-/
  backend/              # API Node.js/Express
  frontend/             # App React/Vite
  mobile/               # App React Native/Expo
  desktop/              # Client SupFile Sync Windows (Electron)
  brain-api/            # Microservice IA Python
  docker-compose.yml    # Orchestration prod
  docker-compose.dev.yml # Orchestration dev
  Makefile              # Commandes raccourcies
  scripts/              # Scripts utilitaires
  doc/                  # Documentation
```

---

## Plans et quotas

| Plan | Stockage | Bobby IA | Vault | Organisations | Versions |
|------|----------|----------|-------|---------------|----------|
| FREE | 30 Go | Non | Non | Non | Non |
| PRO | 100 Go | Oui | Oui | Non | 10 |
| BUSINESS | 500 Go | Oui | Oui | Oui | 30 |
| ENTERPRISE | Sur mesure | Oui | Oui | Oui | Illimite |

---

## Codes d'erreur API

| Code | Signification |
|------|---------------|
| `INVALID_CREDENTIALS` | Email ou mot de passe incorrect |
| `MFA_REQUIRED` | Code TOTP requis |
| `MFA_INVALID` | Code TOTP invalide |
| `ACCOUNT_DISABLED` | Compte desactive |
| `SESSION_EXPIRED` | Token JWT expire |
| `QUOTA_EXCEEDED` | Quota de stockage depasse |
| `FILE_NOT_FOUND` | Fichier introuvable |
| `PERMISSION_DENIED` | Permission insuffisante |
| `VAULT_LOCKED` | Coffre-fort verrouille |
| `RATE_LIMITED` | Trop de requetes |
| `ROOT_FOLDER_REQUIRED` | Root sync absent dans une requete desktop |
| `SYNC_ROOT_NOT_FOUND` | Dossier `SupFile Sync` introuvable ou invalide |
| `SYNC_SCOPE_VIOLATION` | Ressource hors du root sync |
| `SYNC_CONFLICT` | Fichier distant modifie depuis la derniere base connue |
| `CHECKSUM_MISMATCH` | Checksum fourni different du fichier recu |

---

## References techniques

### Backend
- [Express.js](https://expressjs.com/)
- [Prisma ORM](https://www.prisma.io/)
- [Socket.io](https://socket.io/)
- [Passport.js](https://www.passportjs.org/)
- [Speakeasy (TOTP)](https://github.com/speakeasyjs/speakeasy)

### Frontend
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [TailwindCSS](https://tailwindcss.com/)
- [Zustand](https://zustand-demo.pmnd.rs/)
- [i18next](https://www.i18next.com/)

### Mobile
- [React Native](https://reactnative.dev/)
- [Expo](https://expo.dev/)
- [React Navigation](https://reactnavigation.org/)

### Desktop
- [Electron](https://www.electronjs.org/)
- [electron-builder](https://www.electron.build/)
- [chokidar](https://github.com/paulmillr/chokidar)

### IA
- [FastAPI](https://fastapi.tiangolo.com/)
- [LangChain](https://langchain.com/)
- [Ollama](https://ollama.ai/)
- [ChromaDB](https://www.trychroma.com/)

### DevOps
- [Docker](https://www.docker.com/)
- [GitHub Actions](https://github.com/features/actions)
- [Semgrep](https://semgrep.dev/)
- [Dockle](https://github.com/goodwithtech/dockle)

---

**Derniere mise a jour** : Mai 2026

**Auteurs** : Paul Mazzon, Rudy Gault, Mathis Malzac, Hugo Bouland

**Projet** : 4PROJ - SUPINFO 2025-2026
