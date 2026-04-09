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
- **Coffre-fort (Vault)** : Zone isolée avec clé de chiffrement dédiée pour les documents sensibles.
- **Authentification** : Support multi-facteurs (TOTP) et connexion sociale OAuth2.
- **Audit et Logs** : Historique complet pour la conformité et la sécurité.

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

###  8. Documentation & Livrables (Statut : ❌ A FAIRE)
- [ ] **PRIORITÉ CRITIQUE** : Manuel utilisateur complet (PDF ou MD). A FAIRE
- [ ] **PRIORITÉ CRITIQUE** : Documentation technique (Architecture, UML, API Endpoints). A FAIRE
- [ ] **PRIORITÉ CRITIQUE** : Guide de déploiement et pré-requis. A FAIRE

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

## Application Mobile (React Native / Expo Go)

L'application mobile permet un accès complet à SUPFile depuis iOS et Android via Expo Go (SDK 54). Voici l'état d'avancement fonctionnalité par fonctionnalité.

### Fonctionnalités implémentées

#### Authentification & Sécurité
- [x] Inscription (email, mot de passe, nom/prénom)
- [x] Connexion email/mot de passe
- [x] MFA : configuration TOTP (QR code + clé manuelle) au premier login
- [x] MFA : vérification du code à chaque reconnexion
- [x] Gestion de session JWT via SecureStore
- [x] Logout global (toutes les sessions)

#### Gestion des fichiers
- [x] Navigation dossiers avec fil d'Ariane (breadcrumbs)
- [x] Upload de fichiers via sélecteur de documents natif
- [x] Création, renommage, déplacement et suppression de dossiers
- [x] Renommage, déplacement et suppression de fichiers
- [x] Recherche globale par nom de fichier
- [x] Favoris (ajout/retrait, écran dédié)
- [x] Prévisualisation image avec métadonnées
- [x] Téléchargement de fichiers
- [x] Corbeille : fichiers supprimés, restauration, suppression définitive

#### Partage & Collaboration
- [x] Partage de fichier avec un utilisateur (permissions granulaires)
- [x] Liens de partage publics (mot de passe, limite de téléchargements)
- [x] Partages en attente : accepter / refuser avec badge de compteur
- [x] Onglets « Partagés avec moi » et « Partagés par moi »

#### Tags, Commentaires & Versions
- [x] Tags : création, édition, suppression, assignation aux fichiers
- [x] Commentaires : ajout, réponse, édition, suppression
- [x] Historique de versions : consultation, restauration, suppression

#### Dashboard & Notifications
- [x] Dashboard : quota de stockage, statistiques fichiers, fichiers récents
- [x] Centre de notifications : lecture, marquer lu, suppression
- [x] Temps réel via WebSocket (Socket.io)

#### Profil & Paramètres
- [x] Modification du profil (nom, prénom)
- [x] Upload d'avatar depuis la galerie
- [x] Changement de mot de passe
- [x] Export de données personnelles (RGPD)

#### Administration
- [x] Panel admin : KPIs système, répartition des plans, top stockage
- [x] Liste des utilisateurs avec recherche et filtre par plan
- [x] Modification du plan d'un utilisateur

#### Comptes multiples & Délégations
- [x] Lier un compte secondaire (email + mot de passe + MFA)
- [x] Switch de compte avec gestion du token de session
- [x] Retour au compte principal
- [x] Délégations : accorder, assumer, révoquer (permissions R/W/D/S)

### Fonctionnalités restantes à implémenter

| Priorité | Fonctionnalité | Complexité |
| :--- | :--- | :--- |
| Haute | Filtres avancés (type MIME, date, taille) | Moyenne |
| Haute | Prévisualisation vidéo, audio, PDF, markdown | Moyenne |
| Haute | Upload avec barre de progression et file d'attente | Faible |
| Haute | MFA complet dans Settings (désactiver, regénérer codes, trusted devices) | Moyenne |
| Moyenne | Coffre-fort chiffré (Vault) | Élevée |
| Moyenne | Journal d'activité / Audit | Moyenne |
| Moyenne | Thème sombre (dark mode) | Faible |
| Moyenne | Restauration de dossiers depuis la corbeille | Faible |
| Moyenne | Partage de dossiers dans l'interface | Faible |
| Moyenne | Admin : export CSV utilisateurs et stockage | Faible |
| Moyenne | Téléchargement dossier en ZIP | Faible |
| Basse | Organisations (création, membres, rôles, switch) | Élevée |
| Basse | Plans & Billing (Stripe) | Moyenne |
| Basse | Assistant IA Bobby (chat, analyse, recherche sémantique) | Élevée |
| Basse | Internationalisation FR/EN (i18next) | Moyenne |
| Basse | OAuth (Google / GitHub) | Moyenne |
| Basse | Deep link pour liens de partage publics | Moyenne |

---
*Documentation mise à jour - Avril 2026*


