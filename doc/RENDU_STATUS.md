# SUPFile — État du rendu (hors mobile)

> Dernière mise à jour : 2026-04-23

---

## Fonctionnalités — 190 pts

| # | Fonctionnalité | Points | Statut | Notes |
|---|---|---|---|---|
| 1 | Connexion standard | 10 | ✅ Fait | JWT, bcrypt, validation champs, gestion erreurs |
| 2 | Connexion OAuth2 | 20 | ✅ Fait | Google + GitHub, création compte auto |
| 3 | Navigation & dossiers | 15 | ✅ Fait | Breadcrumbs, arborescence, création/rename/suppression |
| 4 | Upload fichiers | 20 | ✅ Fait | Barre de progression, gestion erreurs, limite taille |
| 5 | Manipulation fichiers | 15 | ✅ Fait | Déplacement drag & drop, renommage, corbeille + restauration |
| 6 | Visionneuse intégrée | 20 | ✅ Fait | PDF, images, TXT/MD, streaming audio/vidéo |
| 7 | Téléchargement | 20 | ✅ Fait | Unitaire + ZIP dossier complet à la volée |
| 8 | Liens publics | 20 | ✅ Fait | URL unique, date d'expiration, mot de passe |
| 9 | Partage interne | 20 | ✅ Fait | Partage dossier entre utilisateurs inscrits |
| 10 | Dashboard & quota | 15 | ✅ Fait | Graphique répartition espace, fichiers récents |
| 11 | Recherche & filtres | 15 | ✅ Fait | Par nom/extension, filtres type/date, RAG sémantique (Bobby) |
| | **Total** | **190** | ✅ | |

---

## Qualité du code — 190 pts

Le barème qualité est indexé sur les mêmes items que les fonctionnalités.

### Points acquis
- Architecture 3 couches claire (frontend / backend / BDD + microservices)
- Schéma de réponse API normalisé (`sendSuccess` / `sendError`)
- Middleware d'erreur centralisé + `AppError`
- Chiffrement fichiers KEK/DEK (PBKDF2 100k iter)
- Rate limiting sur les routes sensibles
- JWT secret obligatoire au démarrage (crash si absent)
- Loggers centralisés (pino)
- Index composites Prisma
- Pagination sur `listFiles`
- Services découpés (ShareService, FileUploadService, FileDownloadService…)
- Utils partagés (csvExporter, validators, authHelpers)
- TypeScript strict (plus de `catch (error: any)`)

### Reste à corriger (impact qualité)

| Priorité | Item | Fichier concerné |
|---|---|---|
| 🔴 Critique | `ActivityLog` + `AccountSwitcherModal` non montés dans SettingsPage | `frontend/src/pages/SettingsPage.tsx` |
| 🔴 Critique | Lien `/organization-admin` absent de la Sidebar/Header | `frontend/src/components/Sidebar.tsx` |
| 🟠 Haute | Toasts Socket.io en dur en français (non i18n) | `frontend/src/components/SocketListener.tsx` L.46-50, 73-75, 103-104 |
| 🟠 Haute | Warning manquant pour téléchargement de scripts dangereux | `frontend/src/components/FilePreviewModal.tsx` |
| 🟡 Moyen | `formatBytes()` non uniforme dans l'UI | Plusieurs composants |
| 🟡 Moyen | Tri non aligné sur la page Partages (`SharedPage`) | `frontend/src/pages/SharedPage.tsx` |
| 🟡 Moyen | Unifier validation avec `express-validator` (actuellement moitié manuelle) | Routes backend |
| 🟡 Moyen | `any` TypeScript dans les events Socket.io | `frontend/src/components/SocketListener.tsx` |
| 🟡 Moyen | `PlansPage` : `setTimeout` de simulation Stripe à nettoyer | `frontend/src/pages/PlansPage.tsx` L.143 |
| 🟢 Long terme | Redis caching (user TTL 5min, folders TTL 1min) | `backend/src/services/` |
| 🟢 Long terme | Versioning API `/api/v1/` | Routes backend |
| 🟢 Long terme | Injection de dépendances entre services | Architecture backend |

---

## Déploiement — 50 pts

| Critère | Statut | Notes |
|---|---|---|
| `docker compose up` fonctionnel | ✅ Fait | `docker-compose.yml` à la racine |
| 3 services minimum | ✅ Fait | backend + frontend + postgres + minio + brain-api + ollama |
| Persistance volumes Docker | ✅ Fait | Volumes déclarés pour postgres, minio, chromadb |
| Architecture abstraite | ✅ Fait | API gateway nginx, microservice IA séparé |
| Pas de secrets en clair | ✅ Fait | `.env` requis, JWT_SECRET crashe si absent |

---

## Qualité interface & UX — 20 pts

| Critère | Statut |
|---|---|
| Design cohérent (thème clair/sombre) | ✅ Fait |
| Ergonomie fluide (breadcrumbs, modals, toasts) | ✅ Fait |
| Responsive | ✅ Fait (non optimisé touch mobile) |
| Drag & drop | ✅ Fait |

---

## Bonus — jusqu'à 50 pts

| Bonus | Statut | Points estimés |
|---|---|---|
| Drag & drop fonctionnel | ✅ Fait | ~10 |
| Partage avancé (mot de passe + date expiration) | ✅ Fait | ~10 |
| Chiffrement fichiers côté serveur (KEK/DEK) | ✅ Fait | ~10 |
| MFA / TOTP | ✅ Fait | ~10 |
| IA RAG (Bobby — assistant documentaire) | ✅ Fait | ~10 |
| **Total estimé** | | **~50** |

---

## Documentation — 50 pts ⚠️ (ajournement si < 30)

| Élément requis | Statut |
|---|---|
| Procédure d'installation & prérequis | À vérifier |
| Guide de déploiement (`docker compose up`) | À vérifier |
| Justification des choix technologiques | À vérifier |
| Diagramme UML — Cas d'utilisation | À vérifier |
| Diagramme UML — Schéma relationnel BDD | À vérifier |
| Architecture API (endpoints principaux) | À vérifier |
| Manuel utilisateur | À vérifier |

> ⚠️ La documentation est le seul critère d'ajournement non encore vérifié. À compléter en priorité.

---

## Résumé des actions avant rendu

| Priorité | Action | Effort estimé |
|---|---|---|
| 🔴 1 | Monter `ActivityLog` + `AccountSwitcherModal` dans `SettingsPage` | ~30 min |
| 🔴 2 | Ajouter lien `/organization-admin` dans la Sidebar | ~10 min |
| 🔴 3 | Compléter / vérifier la documentation technique + manuel utilisateur | ~2-4h |
| 🟠 4 | Corriger toasts i18n dans `SocketListener.tsx` | ~15 min |
| 🟠 5 | Ajouter warning téléchargement scripts dangereux | ~20 min |
| 🟡 6 | Unifier `formatBytes()` et tri sur `SharedPage` | ~30 min |
| 🟡 7 | Nettoyer `setTimeout` Stripe dans `PlansPage` | ~5 min |
