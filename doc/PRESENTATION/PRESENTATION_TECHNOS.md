# SUPFile — Stack technique complète

---

## Vue d'ensemble

```

  Frontend          Backend          Brain-API      Infra     
  React 18          Node.js 20       Python 3       Docker    
  TypeScript        TypeScript       FastAPI        nginx     
  Vite              Express          Ollama         MinIO     
  TailwindCSS       Prisma           ChromaDB       Postgres  
  Zustand           Socket.IO        fastembed      OnlyOffice

```

---

## Frontend

### Core
| Techno | Version | Rôle |
|---|---|---|
| React | 18.2 | Framework UI |
| TypeScript | 5.3 | Typage statique |
| Vite | 6.4 | Bundler / dev server |
| React Router DOM | 6.21 | Routing SPA |

### UI & Style
| Techno | Version | Rôle |
|---|---|---|
| TailwindCSS | 3.4 | Utility-first CSS |
| Lucide React | 0.312 | Icônes |
| Recharts | 2.10 | Graphiques (dashboard quota) |
| react-hot-toast | 2.4 | Notifications toast |
| clsx | 2.1 | Gestion classes conditionnelles |

### State & Data
| Techno | Version | Rôle |
|---|---|---|
| Zustand | 4.5 | State management global |
| Axios | 1.15 | Client HTTP |
| Socket.IO Client | 4.8 | Temps réel (notifications, partage) |
| date-fns | 3.2 | Manipulation des dates |

### Fonctionnalités spécifiques
| Techno | Version | Rôle |
|---|---|---|
| react-dropzone | 14.2 | Upload drag & drop |
| react-markdown | 9.1 | Rendu Markdown en prévisualisation |
| react-syntax-highlighter | 16.1 | Coloration syntaxique (prévisualisation code) |
| remark-breaks | 4.0 | Support sauts de ligne Markdown |

### i18n
| Techno | Version | Rôle |
|---|---|---|
| i18next | 25.10 | Internationalisation |
| react-i18next | 16.6 | Intégration React |
| i18next-browser-languagedetector | 8.2 | Détection langue navigateur |

### Tests & Qualité
| Techno | Version | Rôle |
|---|---|---|
| Cypress | 15.10 | Tests E2E |
| ESLint | 8.56 | Linting |
| TypeScript ESLint | 8.56 | Règles TS |

---

## Backend

### Core
| Techno | Version | Rôle |
|---|---|---|
| Node.js | 20 | Runtime |
| TypeScript | 5.3 | Typage statique |
| Express | 4.18 | Framework HTTP |
| tsx | 4.7 | Exécution TypeScript (dev) |

### Base de données & ORM
| Techno | Version | Rôle |
|---|---|---|
| PostgreSQL | 16 | Base de données relationnelle |
| Prisma | 5.22 | ORM (schéma, migrations, queries) |

### Authentification & Sécurité
| Techno | Version | Rôle |
|---|---|---|
| Passport.js | 0.7 | Middleware d'authentification |
| passport-jwt | 4.0 | Stratégie JWT |
| passport-google-oauth20 | 2.0 | OAuth2 Google |
| passport-github2 | 0.1 | OAuth2 GitHub |
| jsonwebtoken | 9.0 | Génération / vérification JWT |
| bcrypt | 6.0 | Hash des mots de passe |
| speakeasy | 2.0 | TOTP (MFA / Google Authenticator) |
| qrcode | 1.5 | Génération QR code MFA |
| express-rate-limit | 7.1 | Rate limiting par IP |
| helmet | 7.1 | Headers HTTP sécurisés |
| express-validator | 7.0 | Validation des entrées |

### Stockage & Fichiers
| Techno | Version | Rôle |
|---|---|---|
| MinIO | RELEASE.2025-01 | Stockage objet (compatible S3) |
| @aws-sdk/client-s3 | 3.1026 | Client S3 pour MinIO |
| @aws-sdk/lib-storage | 3.1026 | Upload multipart S3 |
| multer | 2.1 | Parsing multipart/form-data |
| archiver | 6.0 | Génération ZIP à la volée |
| sharp | 0.33 | Traitement d'images (thumbnails) |
| mime-types | 2.1 | Détection type MIME |

### Traitement documentaire
| Techno | Version | Rôle |
|---|---|---|
| pdf-parse | 2.4 | Extraction texte PDF |
| mammoth | 1.8 | Extraction texte DOCX |

### Communication
| Techno | Version | Rôle |
|---|---|---|
| Socket.IO | 4.8 | Temps réel (notifications live) |
| nodemailer | 8.0 | Envoi emails (invitations, reset password) |
| web-push | 3.6 | Push notifications navigateur |

### Paiement
| Techno | Version | Rôle |
|---|---|---|
| Stripe | 20.3 | Paiement (plans FREE/PRO/BUSINESS) |

### Monitoring & Logs
| Techno | Version | Rôle |
|---|---|---|
| pino | 10.3 | Logger structuré JSON (performant) |
| pino-pretty | 13.1 | Formatage logs dev |
| node-cron | 3.0 | Tâches planifiées (nettoyage corbeille) |

### API & Outillage
| Techno | Version | Rôle |
|---|---|---|
| swagger-ui-express | 5.0 | Documentation API interactive |
| cors | 2.8 | Gestion CORS |
| csv-stringify | 6.6 | Export CSV (audit, GDPR) |
| uuid | 9.0 | Génération identifiants uniques |

### Tests
| Techno | Version | Rôle |
|---|---|---|
| Jest | 30.2 | Tests unitaires |
| Supertest | 7.2 | Tests d'intégration HTTP |
| ts-jest | 29.4 | Jest pour TypeScript |

---

## Brain-API (microservice IA)

### Core
| Techno | Version | Rôle |
|---|---|---|
| Python | 3.x | Runtime |
| FastAPI | 0.115 | Framework API REST |
| Uvicorn | 0.32 | Serveur ASGI |
| Pydantic | 2.9 | Validation des données |
| httpx | 0.28 | Client HTTP async |

### IA & RAG
| Techno | Version | Rôle |
|---|---|---|
| Ollama | 0.5.4 | Serveur LLM local (container séparé) |
| gemma2:2b | — | Modèle de langage (LLM) |
| ChromaDB | 0.6 | Base vectorielle (persistance embeddings) |
| fastembed | 0.3 | Génération embeddings (paraphrase-multilingual-MiniLM-L12-v2) |

---

## Infrastructure & DevOps

### Conteneurisation
| Techno | Version | Rôle |
|---|---|---|
| Docker | — | Conteneurisation |
| Docker Compose | — | Orchestration multi-services |

### Services tiers
| Techno | Version | Rôle |
|---|---|---|
| PostgreSQL | 16-alpine | BDD principale |
| MinIO | 2025-01 | Stockage objet S3-compatible |
| OnlyOffice Document Server | 8.2.2 | Édition collaborative en ligne |
| Ollama | 0.5.4 | Inférence LLM locale |
| nginx (unprivileged) | alpine | Serveur web frontend (non-root) |

### CI/CD
| Techno | Rôle |
|---|---|
| GitHub Actions | Pipeline CI (lint, tests, build) |

---

## Mobile

### Core
| Techno | Version | Rôle |
|---|---|---|
| React Native | 0.81.5 | Framework mobile iOS & Android |
| Expo SDK | 54 | Toolchain, build, accès APIs natives |
| TypeScript | 5.9.2 | Typage statique |

### Navigation & State
| Techno | Version | Rôle |
|---|---|---|
| React Navigation | v6 | Native Stack + Bottom Tabs |
| Zustand | 5.0.12 | State management (même pattern que le web) |
| Axios | 1.13.6 | Client HTTP avec intercepteurs JWT |
| Socket.IO Client | 4.8.3 | Temps réel |

### APIs natives
| Techno | Version | Rôle |
|---|---|---|
| expo-secure-store | — | Stockage chiffré des tokens (iOS Keychain / Android Keystore) |
| expo-document-picker | — | Sélection fichiers système |
| expo-image-picker | — | Accès galerie photo / caméra |
| expo-file-system | — | Opérations fichiers locaux |
| expo-video | 3.0.16 | Lecture vidéo native |
| react-native-webview | 13.15.0 | Prévisualisation PDF & Office |
| react-native-toast-message | — | Notifications toast |

---

## Résumé chiffres

| Catégorie | Nombre de technos |
|---|---|
| Frontend Web | 20 |
| Backend | 35 |
| Brain-API | 5 |
| Mobile | 10 |
| Infrastructure | 8 |
| **Total** | **~78** |

---

## Choix notables à justifier

| Choix | Alternative écartée | Raison |
|---|---|---|
| Prisma | Sequelize, TypeORM | Meilleure DX TypeScript, migrations auto, type-safe queries |
| MinIO | Volume local brut | Compatible S3, scalable, interface admin, production-ready |
| Zustand | Redux, Context API | Légèreté, moins de boilerplate, idéal pour taille du projet |
| Pino | Winston, console.log | Performances (JSON structuré, async), compatible pino-pretty en dev |
| ChromaDB | Pinecone, Weaviate | Open-source, auto-hébergé, simple à déployer en Docker |
| fastembed | OpenAI embeddings | Gratuit, local, multilingue, aucune dépendance API externe |
| gemma2:2b (déployé) / gemma3:2b–9b (roadmap prod) | GPT-4, Claude | Gratuit, local, aucune clé API, fonctionne hors ligne |
| Socket.IO | SSE, WebSocket brut | Abstraction robuste, fallback auto, rooms intégrées |
| nginx-unprivileged | nginx standard | Sécurité renforcée (non-root, uid 101), conforme CIS |
