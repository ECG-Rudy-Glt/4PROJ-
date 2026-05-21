# SUPFile - Backend & Sécurité MATHIS

---

## Architecture générale

- **Node.js 20 + TypeScript strict** - typage bout en bout, zéro `any` dans les couches critiques
- **Express 4** avec architecture 3 couches : routes  controllers  services
- **Prisma 5** comme ORM : migrations versionnées, queries type-safe, index composites en BDD
- **PostgreSQL 16** pour la persistance relationnelle, **MinIO** pour le stockage objet (compatible S3)
- **Réponses API normalisées** : `sendSuccess` / `sendError` - format uniforme dans 100% des endpoints
- **Middleware d'erreur centralisé** : `AppError` typé + handler global, aucune fuite de stack trace

---

## Authentification

### JWT avec versionnage de token
- Token signé HS256, `JWT_SECRET` obligatoire - **crash volontaire au démarrage si absent**
- Chaque token embarque un `tokenVersion` (entier en BDD) - révocation instantanée sans liste noire
- **Déconnexion globale** : incrémente `tokenVersion` en BDD  tous les tokens existants deviennent invalides
- Extraction Bearer uniquement (`Authorization: Bearer <token>`), pas de cookie, pas de query param

### OAuth2
- **Google** et **GitHub** via Passport.js
- Création automatique de compte au premier login OAuth (pas de mot de passe requis)
- Liaison d'un compte OAuth à un compte local existant (même email)

### Sécurité des mots de passe
- **bcrypt** avec salt factor 10 - jamais stockés en clair
- Validation côté serveur à chaque endpoint sensible (express-validator)

---

## MFA - Multi-Factor Authentication

- **TOTP** via `speakeasy` (Google Authenticator, Authy…) - fenêtre de tolérance `window: 2`
- QR code généré serveur-side avec `qrcode` - secret jamais exposé après setup
- **Codes de récupération** : 8 codes one-time, hashés avec bcrypt avant stockage
- **Appareils de confiance** : fingerprint SHA-256 (user-agent + IP), TTL 30 jours, stocké hashé en BDD
- Vérification MFA bloquante sur toutes les routes protégées si MFA activé

---

## Chiffrement des fichiers - Architecture KEK/DEK

### Pourquoi deux niveaux de clé ?
Un seul mot de passe  une seule clé  changer le mot de passe impose de re-chiffrer tous les fichiers.
Avec KEK/DEK, seule la KEK change : les DEK restent intacts.

### Implémentation
- **KEK** (Key Encryption Key) : dérivée du mot de passe utilisateur via **PBKDF2-SHA512, 100 000 itérations**, sel unique par utilisateur
- **DEK** (Data Encryption Key) : générée aléatoirement par fichier (32 bytes), chiffrée avec la KEK, stockée en BDD
- **Chiffrement du contenu** : **AES-256-GCM** - authentifié (intégrité + confidentialité), IV 16 bytes aléatoire par fichier
- Structure objet MinIO : `IV (16B) | AuthTag (16B) | ciphertext`
- Lecture par **ranged GET S3** : 0–15 pour l'IV, 16–31 pour l'AuthTag, 32+ pour le contenu - jamais de chargement du fichier entier en mémoire

---

## Coffre-fort (Vault)

- Mot de passe **séparé** du compte principal - dérivation KEK indépendante
- **MFA requis** pour ouvrir le vault si MFA activé
- **Lockout 5 tentatives**  verrouillage 15 minutes
- **Auto-lock** : session vault expire après 10 minutes d'inactivité
- Rotation du mot de passe vault sans re-chiffrement des fichiers (seule la DEK wrappée est mise à jour)
- Disponible uniquement sur les plans PRO et supérieurs

---

## Sécurité des uploads

- **Multer** avec renommage UUID systématique - le nom original n'est jamais utilisé comme clé de stockage
- Filtrage des types MIME côté serveur (images avatar : JPEG/PNG/WebP uniquement)
- Limite de taille configurable (5 GB par fichier)
- Vérification quota **avant** upload côté serveur (pas de confiance au client)
- Détection MIME par extension + magic bytes

---

## Contrôle d'accès & Partage

- **RBAC** sur les ressources partagées : permissions granulaires `read / write / delete / share`
- Middleware de délégation : vérification owner **ou** permission explicite à chaque requête
- **Account switching** : accès à un compte tiers via token délégué, permissions limitées, révocable
- Liens publics : token UUID unique, optionnellement protégé par mot de passe (hashé bcrypt), date d'expiration, quota de téléchargements

---

## Audit & Traçabilité

- **30+ types d'événements** tracés : login, upload, download, partage, MFA, changement de mot de passe, suppression…
- Écriture **asynchrone fire-and-forget** - jamais bloquant pour la requête principale
- Nettoyage automatique RGPD : purge des logs > 90 jours via **node-cron**
- Export CSV des logs filtrés (type, plage de dates) - disponible admin + utilisateur

---

## Protections réseau & HTTP

- **Helmet** : headers HSTS, X-Content-Type-Options, X-Frame-Options, CSP - activé globalement
- **CORS strict** : origines whitelistées, credentials `true` uniquement sur domaines autorisés
- **Rate limiting** (`express-rate-limit`) :
  - Auth routes (login, register, MFA) : 10 requêtes / 15 minutes par IP
  - Routes sensibles (reset password, vault) : limites dédiées
- Validation des entrées systématique avec **express-validator** sur toutes les routes critiques

---

## Logging & Observabilité

- **Pino** : logger JSON structuré, le plus rapide de l'écosystème Node (async, non-bloquant)
- **pino-pretty** en dev pour lisibilité, JSON brut en production (compatible Datadog/Loki)
- Logs corrélés par `requestId`, `userId`, `fileId` pour traçabilité bout en bout
- Niveau configurable via variable d'environnement (`LOG_LEVEL`)

---

## Tâches planifiées

- **node-cron** : purge automatique de la corbeille (fichiers > 90 jours)
- Nettoyage des logs d'audit (RGPD)
- Exécuté dans le même process Node - pas de worker séparé nécessaire

---

## Choix technologiques justifiés

| Choix | Alternative écartée | Raison |
|---|---|---|
| Prisma | Sequelize, TypeORM | DX TypeScript supérieure, migrations auto, zero raw SQL obligatoire |
| MinIO | Volume Docker brut | Compatible S3, scalable horizontalement, interface admin, snapshot/backup natif |
| Pino | Winston, Morgan | 2 plus rapide, JSON natif, adapté production cloud |
| bcrypt | Argon2, scrypt | Bibliothèque éprouvée, Node natif, intégration Passport sans friction |
| speakeasy | otplib, node-2fa | TOTP RFC 6238 strict, backup codes intégrés, window configurable |
| AES-256-GCM | AES-CBC, ChaCha20 | Chiffrement **authentifié** - détecte toute altération du ciphertext |
| PBKDF2 100k iter | MD5, SHA1 | Résistance brute-force : 100k itérations = ~100ms par tentative côté serveur |
