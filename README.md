# SUPFile - Solution de Stockage Cloud Sécurisée et Intelligente

## Présentation
SUPFile est une plateforme de stockage cloud de nouvelle génération, offrant une alternative robuste et souveraine aux services grand public. Conçue avec une architecture microservices, elle allie performance, sécurité cryptographique et intelligence artificielle pour une gestion optimale des données personnelles et professionnelles.

---

## Architecture du Système

Le projet est articulé autour de quatre piliers technologiques :

1.  **Backend (API de Haute Performance)** : Node.js / TypeScript / Express.
    - **ORM** : Prisma avec PostgreSQL.
    - **Sécurité** : JWT, OAuth2 (Google), MFA (TOTP), et Chiffrement AES-256.
    - **Temps Réel** : Socket.io pour les notifications et mises à jour instantanées.
2.  **Frontend (Interface Web Premium)** : React 18 / Vite.
    - **Styling** : TailwindCSS pour une UI moderne et responsive.
    - **Internationalisation** : i18next (Français/Anglais).
    - **State Management** : Zustand pour une gestion fluide de l'état (Auth, Vault, UI).
3.  **Brain-API (Cœur IA)** : Microservice Python dédié à l'IA.
    - **Modèle** : Intégration Google Gemini ou Ollama (local).
    - **RAG** : Système de recherche sémantique (Retrieval-Augmented Generation) avec ChromaDB.
4.  **Mobile (Accès Nomade)** : Application React Native (iOS/Android).

---

## Base de Données et Persistance

La persistance des données est segmentée pour garantir performance et scalabilité :

### Métadonnées Relationnelles (PostgreSQL 16)
Le cœur de l'application repose sur PostgreSQL pour la gestion des données structurées. Le schéma est orchestré par Prisma ORM :
- **Utilisateurs** : Gestion des comptes, quotas (30 Go par défaut), sessions (Refresh Tokens) et sécurité (MFA, Vault).
- **Arborescence** : Structure récursive pour les dossiers (`Folder`) et fichiers (`File`), incluant les chemins de navigation (Breadcrumbs).
- **Partages** : Liens publics (`SharedLink`) avec expiration/mot de passe et partages internes (`SharedFolder`) avec permissions granulaires.
- **Traçabilité** : Table `AuditLog` enregistre chaque action critique (upload, suppression, partage).
- **Collaboration** : Systèmes de commentaires et de tags associés aux fichiers.

### Stockage Vectoriel (ChromaDB)
Utilisé par le microservice Brain-API pour le RAG :
- Indexation du contenu textuel extrait des documents.
- Stockage des embeddings permettant la recherche sémantique et les interactions avec l'IA Bobby.

### Stockage d'Objets (S3 / MinIO)
Les fichiers physiques ne sont jamais stockés en base de données :
- **Stockage principal** : Compatible S3 (MinIO en local).
- **Sécurité** : Chaque fichier est chiffré avant d'être persisté sur le bucket.

---

## Fonctionnalités Majeures (Source de Vérité - Code)

### Gestion des Fichiers et Stockage
- **Hybride Storage** : Support natif de S3 avec repli local pour la portabilité.
- **Chiffrement au Repos** : Chiffrement AES-256 appliqué via EncryptionService avant le transfert.
- **Organisation** : Favoris, Corbeille avec purge automatique (90 jours) et gestion intelligente des doublons.

### Sécurité et Confidentialité
- **Audit et Logs** : Historique complet pour la conformité.
- **Sécurité Garantie** : Audit de chiffrement **réussi** (Avril 2026) confirmant l'illisibilité des documents au repos (MinIO & Postgres).

### Intelligence Artificielle (Assistant Bobby)
- **Analyse Multimodale** : OCR sur images et extraction de texte sur PDF.
- **Recherche Sémantique** : Capacité de retrouver un document par son sens ou son contenu.
- **Génération de Fichiers** : Créer des documents texte directement via des prompts IA.

---

## Plans et Quotas

| Caractéristique | Plan FREE (Libre) | Plan PRO / Business |
| :--- | :--- | :--- |
| **Stockage Total** | 30 Go | 200 Go / 2 To |
| **Taille Max Fichier** | 100 Mo | 500 Mo / 2 Go |
| **Versions** | 3 | 10 / 25 |
| **IA & Vault** | Non | **Inclus** |

> [!NOTE]
> La limite de 100 Mo par fichier sur le plan FREE est une règle métier stricte définie dans le PlanService, indépendante du quota global.

---

## Déploiement

Le projet utilise Docker Compose pour une orchestration simplifiée :
- **Services** : backend, frontend, postgres, minio, brain-api, ollama, onlyoffice.
- **Persistance** : Volumes Docker dédiés pour chaque service de stockage (DB, S3, Vector Store).

---

## Checklist de Conformité & Priorisation

Ce plan synthétise les exigences du projet SUPFile et les aligne avec l'état actuel du code source (Source de Vérité).

###  1. Authentification & Identité (Statut : ✅ TERMINE)
- [x] Connexion standard (Email/Mot de passe) avec hachage bcrypt.
- [x] Inscription avec validation des champs.
- [x] Gestion des sessions via JWT sécurisés.
- [x] Connexion OAuth2 (Google & GitHub) fonctionnelle.
- [x] **Bonus** : Double authentification (MFA/TOTP) implémentée.

###  2. Gestionnaire de Fichiers (Statut : ✅ TERMINE)
- [x] Navigation fluide et Fil d'Ariane (Breadcrumbs).
- [x] Création, renommage et suppression de dossiers.
- [x] Upload de fichiers avec barre de progression en temps réel.
- [x] Corbeille fonctionnelle avec restauration et purge automatique (Cron).
- [x] **Téléchargement de dossier complet en archive ZIP** : route `GET /folders/:folderId/download`, déchiffrement AES-256 à la volée, streaming via `archiver`.
- [x] **Glisser-déposer (Drag & Drop) pour le déplacement de fichiers et dossiers** : HTML5 natif, différenciation drag interne vs upload OS, feedback visuel au survol.

###  3. Prévisualisation & Média (Statut : ✅ TERMINE)
- [x] Visionneuse PDF et documents texte (Markdown, TXT).
- [x] Streaming fluide des fichiers audio (MP3) et vidéo (MP4) via Range Headers.
- [x] Galerie d'images haute performance.
- [x] Affichage des détails techniques (Taille, MIME, Dates) via le système de fichiers.

###  4. Partage & Collaboration (Statut : ✅ TERMINE)
- [x] Liens de partage publics (accessibles hors compte).
- [x] Protection des liens par mot de passe et date d'expiration.
- [x] Limite de téléchargements sur les liens publics.
- [x] Partage interne entre utilisateurs avec gestion des permissions (Lecture/Écriture).

###  5. Dashboard & Recherche (Statut : ✅ TERMINE)
- [x] Recherche unifiée par nom et extension.
- [x] Filtres dynamiques par type de fichier et date.
- [x] Dashboard avec graphique de répartition du quota (vidéos, docs, etc.).
- [x] Liste des activités récentes (derniers fichiers modifiés).
- [x] **IA Bobby** : RAG Context, Chat, Recherche sémantique.

###  6. Paramètres & UX (Statut : ✅ TERMINE)
- [x] Modification du profil (Avatar, Email).
- [x] Thème Clair / Sombre persistant.
- [x] Internationalisation (Français/Anglais).

###  7. Déploiement & Architecture (Statut : ✅ TERMINE)
- [x] Séparation stricte Backend / Frontend / Mobile.
- [x] Conteneurisation complète avec Docker Compose (Serveur, Web, BDD, IA, Stockage).
- [x] Persistance des données via volumes Docker.
- [x] Abstraction du stockage (S3/MinIO/Local).

###  8. Documentation & Livrables (Statut : ✅ TERMINE)
- [x] Manuel utilisateur complet (README & BACKEND_DOC).
- [x] Documentation technique (KEK/DEK, Architecture, API Endpoints).
- [x] Guide de déploiement (Docker Compose & .env).

---

##  Priorisation des tâches restantes

1.  **Documentation (CRITIQUE)** : Nécessaire pour éviter l'ajournement (Note < 30/50 requis). Rédaction du manuel utilisateur et de la documentation technique (Swagger/OpenAPI, UML, guide de déploiement).
2.  **Audit Mobile (HAUTE)** : S'assurer que chaque fonction Web est bien disponible sur le client Mobile React Native.
3.  **Tests (HAUTE)** : Tests unitaires et d'intégration à compléter (couverture des services critiques).
4.  **STRIPE / Services Tiers (MOYENNE)** : Intégration du paiement pour les plans PRO/Business.

---

## Correctifs récents (Avril 2026)

- **Fix 429 Tags** : le store Zustand `useTagStore` déclenche désormais un seul appel réseau grâce au flag `isLoaded`, éliminant le storm de requêtes sur `/api/tags` lors de l'affichage de la liste de fichiers.
- **ZIP Download** : implémentation complète — backend `streamFolderAsZip` (archiver + déchiffrement AES-256 à la volée), route `GET /folders/:folderId/download`, bouton dans l'UI avec feedback visuel au survol.
- **Drag & Drop Move** : déplacement de fichiers et dossiers par glisser-déposer (HTML5 natif), guard anti-conflit avec l'upload global existant.

---
*Documentation mise à jour - Avril 2026*


