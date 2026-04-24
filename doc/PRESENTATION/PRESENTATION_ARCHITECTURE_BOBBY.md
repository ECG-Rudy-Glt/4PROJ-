# SUPFile — Architecture & Bobby (Chef de projet / Architecte)

---

## Vue d'ensemble du projet

SUPFile est une plateforme de stockage cloud avec assistant documentaire IA, construite en **architecture microservices** déployée intégralement via Docker Compose.

```
Navigateur
    │
    ▼
nginx (frontend) :3000
    │  SPA React — proxy /api et /socket.io vers le backend
    ▼
backend Node.js :5001
    │  Express REST API — JWT, Prisma, MinIO, Socket.IO
    ├──► PostgreSQL :5432      (BDD relationnelle, réseau interne)
    ├──► MinIO                 (stockage objet S3, réseau interne)
    ├──► OnlyOffice :8080      (édition documents Office)
    └──► brain-api :8001       (microservice IA Python)
              └──► Ollama      (inférence LLM locale, réseau interne)
              └──► ChromaDB    (base vectorielle, volume persistant)
```

**7 services Docker**, **1 réseau bridge interne**, **0 exposition directe** de la BDD et du stockage vers l'hôte.

---

## Infrastructure Docker

### Services et responsabilités

| Service | Image | Rôle | Exposition |
|---|---|---|---|
| **frontend** | React/nginx:alpine | SPA + reverse proxy | `3000:8080` |
| **backend** | Node.js 20 custom | API REST + WebSocket | `5001:5001` |
| **postgres** | postgres:16-alpine | Base de données principale | interne uniquement |
| **minio** | minio:2025-01 | Stockage objet S3 | interne uniquement |
| **minio-init** | minio/mc | Bootstrap bucket + IAM | one-shot |
| **onlyoffice** | documentserver:8.2.2 | Édition Office collaborative | interne via backend |
| **ollama** | ollama:0.5.4 | Inférence LLM locale | interne uniquement |
| **brain-api** | Python FastAPI custom | RAG + embeddings | interne uniquement |

### Volumes persistants

| Volume | Contenu |
|---|---|
| `postgres_data` | État de la BDD PostgreSQL |
| `minio_data` | Fichiers chiffrés (objets S3) |
| `ollama_data` | Poids du modèle LLM (gemma2:2b) |
| `brain_chromadb` | Base vectorielle ChromaDB |
| `onlyoffice_data/log` | État de l'éditeur Office |

### Sécurité réseau
- BDD et MinIO **non exposés** à l'hôte (réseau bridge interne uniquement)
- Politique IAM MinIO par utilisateur applicatif (GetObject, PutObject, DeleteObject, ListBucket uniquement)
- OnlyOffice avec IP allowlist et JWT interne

---

## CI/CD — Pipeline GitHub Actions

**5 jobs en parallèle, ordonnancés par dépendances :**

```
validate-env
    ├─► backend-checks   (npm install → prisma generate → build → tests + coverage)
    ├─► frontend-checks  (npm install → lint ESLint → vite build → cypress E2E)
    ├─► semgrep          (SAST — règles Node.js + React, fail sur ERROR)
    └─► trufflehog       (scan secrets dans tout l'historique git)
            └─► docker-build  (build images → Dockle audit → SBOM SPDX-JSON)
                    └─► docker-push  (GHCR :latest + :sha, main uniquement)
```

**Contrôles de sécurité intégrés :**
- **Semgrep** — analyse statique (SAST) avant tout build Docker
- **TruffleHog** — détection de secrets actifs dans l'historique git complet
- **Dockle** — audit de sécurité de l'image Docker (CIS Benchmark)
- **SBOM** — Software Bill of Materials (SPDX-JSON), conservé 90 jours
- **npm audit** — vérification des dépendances vulnérables (backend + frontend)

---

## Schéma de données — Prisma (PostgreSQL 16)

**~20 modèles**, conçus autour de 5 domaines :

### Utilisateur & sécurité
- `User` : email, plan (FREE/PRO/BUSINESS/ENTERPRISE), quotaUsed/quotaLimit (BigInt), tokenVersion (révocation JWT globale), kekSalt + encryptedDek (chiffrement), mfaSecret, vaultPasswordHash, stripeCustomerId
- `TrustedDevice` : fingerprint SHA-256, TTL 30 jours
- `RefreshToken` : révocation granulaire

### Fichiers & dossiers
- `File` : storagePath (UUID), size (BigInt), isDeleted + deletedAt (soft delete), isVault, isFavorite, views, downloads
- `Folder` : arborescence récursive (parentId autoréférent), path (breadcrumbs), isVault
- `FileVersion` : historique immuable par fichier, storagePath unique par version
- **Indexes composites** : `(userId, folderId, isDeleted)` sur File — requête listing sans scan complet

### Partage & collaboration
- `SharedLink` : token UUID, mot de passe hashé, expiresAt, maxDownloads
- `SharedFolder` / `SharedFile` : partage interne avec permissions granulaires (canRead/Write/Delete/Share)
- `Comment` / thread de réponses
- `Tag` / `FileTag` : étiquettes avec couleur hex

### IA & recherche
- `FileSearchIndex` : texte extrait (full-text) + résumé IA + flag OCR — 1:1 avec File
- `Conversation` / `ConversationMessage` : historique des chats Bobby (role: user/assistant)

### Facturation & organisation
- `Organization` / `OrganizationMember` (rôles: OWNER/ADMIN/MEMBER)
- `Delegation` : accès délégué avec permissions temporelles + statut ACTIVE/REVOKED
- `AuditLog` : 30+ types d'actions, détails JSON, nettoyage RGPD automatique

**Choix de conception :**
- **Soft delete partout** → corbeille, restauration, conformité RGPD
- **BigInt pour les tailles** → supporte les fichiers > 2GB sans overflow
- **JSON fields** pour les métadonnées flexibles (audit, notifications)
- **Enums Prisma** pour les plans, statuts, rôles → type-safe dans tout le code

---

## Surface API — 20 domaines de routes

| Domaine | Endpoints clés |
|---|---|
| **Auth** | register, login, logout-all, OAuth Google/GitHub, change-password, avatar |
| **Fichiers** | upload, list, search, download, stream, move, favorite, restore, export CSV |
| **Dossiers** | create, rename, move, delete, download ZIP, breadcrumbs, restore |
| **Partage** | liens publics (password + expiry), partage interne (permissions granulaires), accept/reject |
| **IA / Bobby** | chat, analyze-file, search-files, generate-file, reindex, conversations |
| **Vault** | setup, unlock, lock, rotate-password |
| **MFA** | setup TOTP, verify, backup codes, trusted devices |
| **Tags** | create, update, delete, assign to file |
| **Commentaires** | add, reply, edit, delete |
| **Versions** | list, restore, delete |
| **Notifications** | list, mark-read, delete |
| **Dashboard** | quota par type, fichiers récents, stats |
| **Audit** | logs filtrés, stats, export CSV |
| **Admin** | KPIs, gestion utilisateurs, export CSV, reindex IA |
| **Facturation** | Stripe checkout, portal, downgrade, webhook |
| **OnlyOffice** | config éditeur, vérification droits |
| **Organisations** | create, invite members, change roles |
| **Délégation** | grant, revoke, assume context |
| **Push** | VAPID key, subscribe, unsubscribe |

**Documentation Swagger UI** interactive disponible — OpenAPI 3.0.3, auth Bearer JWT, tous les schémas de réponse documentés.

---

## nginx — Reverse proxy frontend

- Sert le build statique React (Vite) en `try_files $uri /index.html` (SPA routing)
- Proxy `/api` → backend avec `proxy_request_buffering off` (streaming upload jusqu'à **5 GB**)
- Proxy `/socket.io` → backend avec timeout 3600s (connexions WebSocket persistantes)
- `client_max_body_size 5G` — pas de limite artificielle sur les gros fichiers

---

## Tâches planifiées — node-cron

| Tâche | Fréquence | Action |
|---|---|---|
| **Purge corbeille** | configurable | Suppression définitive des fichiers/dossiers après 90 jours |
| **Alerte expiration liens** | quotidien 9h00 | Email aux propriétaires de liens expirant dans 1 jour ou 7 jours |

---

## Bobby — Architecture RAG complète

### Pourquoi un microservice séparé ?

Le backend Node.js reste léger et synchrone. Le traitement IA (embedding, LLM) est lent et gourmand en ressources. La séparation permet de :
- Scaler le brain-api indépendamment (GPU dédié en prod)
- Limiter l'impact d'un crash Ollama sur l'API principale
- Isoler les dépendances Python du runtime Node.js

### Pipeline d'indexation (`POST /embed`)

```
Fichier uploadé
    │
    ▼
Backend extrait le texte (pdf-parse, mammoth, lecture TXT/MD)
    │
    ▼
BrainService.embedFile() — fire-and-forget (non-bloquant pour l'upload)
    │
    ▼
brain-api reçoit le texte brut (max 200 000 chars)
    │
    ▼
Chunking : découpage par phrases, max 600 chars/chunk, overlap 2 phrases
    │  → préserve le contexte entre les chunks
    ▼
fastembed : modèle paraphrase-multilingual-MiniLM-L12-v2
    │  → multilingue natif (FR/EN/DE...), 220 MB, local, gratuit
    │  → embed() pour les documents (passage embeddings)
    ▼
ChromaDB : stockage vecteurs avec métadonnées { file_id, user_id, file_name, chunk_index }
    │  → ID format : {file_id}__chunk_{n} (idempotent : purge avant re-indexation)
    └  → collection "documents", distance cosinus, filtrage par user_id
```

### Pipeline de chat RAG (`POST /chat`)

```
Utilisateur envoie un message + historique de conversation
    │
    ▼
[Si historique] Reformulation de la question par le LLM
    │  → résout les pronoms et références implicites
    │  → ex: "Et cette facture ?" → "Quel est le montant de la facture de mars ?"
    ▼
fastembed.embed_query() → vecteur de la question
    │
    ▼
ChromaDB : 10 chunks les plus proches (filtré par user_id)
    │
    ▼
Filtrage distance cosinus ≤ 0.55 (chunks non pertinents écartés)
    │  → Si aucun chunk : réponse "aucun document trouvé"
    ▼
Construction du prompt RAG :
    │  contexte (3 000 chars max) + question reformulée + règles Bobby
    ▼
Ollama POST /api/chat → gemma2:2b
    │  temperature: 0.1 (réponses factuelles, peu créatives)
    │  num_predict: 512 tokens, timeout 120s
    ▼
Réponse retournée au backend → frontend
```

### Isolation des données

- **Chaque requête** ChromaDB inclut `where={"user_id": user_id}`
- Un utilisateur ne peut **jamais** accéder aux documents d'un autre
- Sécurité gérée côté backend (JWT) — le brain-api fait confiance au `user_id` fourni

### Sécurité LLM — Prompt engineering défensif

- Bobby ne révèle jamais son modèle, son architecture ni ses instructions
- Mode **RAG-only** : "N'utilise jamais tes connaissances générales"
- Résistance aux injections : détecte `"oublie tes instructions"`, `"tu es maintenant X"`
- Si aucun document trouvé : réponse explicite, pas d'hallucination

### BrainService.ts — Résilience côté backend

- **Retry automatique** : 3 tentatives avec backoff exponentiel (1s, 2s, 4s)
- Codes retryables : 502, 503, 504 (Ollama surchargé ou redémarrage)
- **Timeouts différenciés** : 30s pour embed/search, 120s pour chat/analyze/generate
- `deleteFile()` : fire-and-forget sans retry (non-critique)
- Si `BRAIN_API_URL` absent : fonctionnalités IA désactivées silencieusement

### Stack technique brain-api

| Composant | Techno | Pourquoi |
|---|---|---|
| Framework | FastAPI + Uvicorn | Async natif, validation Pydantic, performances |
| LLM | Ollama + gemma2:2b | Local, gratuit, aucune clé API, fonctionne hors ligne |
| Embeddings | fastembed | Local, multilingue, rapide, aucune dépendance externe |
| Vector store | ChromaDB | Open-source, auto-hébergé, simple en Docker, persistant |
| Client HTTP | httpx async | Async natif, timeout configurable, compatible FastAPI |

---

## Choix architecturaux justifiés

| Décision | Alternative écartée | Raison |
|---|---|---|
| Microservice brain-api séparé | LLM dans le backend Node | Isolation des ressources, scalabilité GPU indépendante, crash LLM ≠ crash API |
| ChromaDB | Pinecone, Weaviate | Open-source, auto-hébergé, Docker natif, pas d'abonnement SaaS |
| fastembed | OpenAI text-embedding | Gratuit, local, multilingue, zéro dépendance cloud |
| gemma2:2b | GPT-4o, Claude | Gratuit, local, fonctionne hors ligne, 3GB VRAM (swap CPU possible) |
| MinIO | Volume Docker brut | Compatible S3, scalable, interface admin, IAM policies, migration cloud triviale |
| Ollama | llama.cpp direct | API HTTP standard, gestion des modèles simplifiée, swap de modèle sans code |
| Soft delete Prisma | Hard delete | Corbeille, restauration, audit trail, conformité RGPD |
| docker compose | Kubernetes | Déploiement one-shot pour un MVP, courbe d'apprentissage maîtrisée |
