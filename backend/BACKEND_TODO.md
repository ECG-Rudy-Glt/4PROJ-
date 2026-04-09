# Backend TODO — Audit de qualité

## 🔴 CRITIQUE — Avant mise en prod

- [x] **[Sécurité]** Supprimer la valeur par défaut de `JWT_SECRET` — crasher au démarrage si non défini (`passport.ts:10`, `auth.ts:11`)
- [x] **[Sécurité]** Ajouter un rate limit strict sur `/api/auth/login` (ex: 10 req/15min par IP) — `index.ts`
- [x] **[Sécurité]** Clé de chiffrement dérivée avec PBKDF2 (100k iter) — implémenté via KekService (Architecture KEK/DEK) (`encryptionService.ts`)
- [x] **[Architecture]** Ajouter `prisma.$transaction()` sur les opérations billing multi-entités (`billingService.ts`)
- [~] **[Sécurité]** Whitelist MIME — non applicable : service de stockage, tous les types de fichiers doivent être acceptés

---

## 🟠 HAUTE PRIORITÉ — Court terme

### Sécurité
- [x] Retirer l'acceptation du token JWT en query param (apparaît dans les logs serveur) — `auth.ts:27-29`
- [~] Ajouter protection CSRF — non applicable : auth via JWT en header Authorization, pas de cookies de session
- [x] Limiter la taille de la `query` de recherche (ex: max 100 chars) — `userService.ts:14`
- [x] Valider `limit` params (min 0, max 1000) — `auditController.ts:12`, `userController.ts:22`

### Architecture
- [x] Créer un middleware d'erreur centralisé — `middlewares/errorHandler.ts`, `AppError` class, branché dans `index.ts`
- [x] Déplacer la logique d'invitation email hors des controllers → `ShareInvitationService` (`shareController.ts:129-167 & 265-307`)
- [x] Ajouter middleware `requireFolderPermission` sur les routes de dossier partagé — `folderRoutes.ts`

### Cohérence
- [ ] Normaliser le schéma de réponse API : `{ success, data?, error?, code? }` sur tous les endpoints
- [ ] Corriger les status HTTP incohérents (utiliser 401/403/404/409/422 correctement au lieu de 400 systématique)
- [x] Remplacer tous les `console.log` / `console.error` par un logger centralisé (pino) — `config/logger.ts`, appliqué sur tous les controllers, services et middlewares

---

## 🟡 MOYEN TERME

### Doublons à éliminer
- [x] Pattern export CSV répété 5x → créer `utils/csvExporter.ts` (`authController`, `fileController`, `auditController`, `adminController`)
- [x] Regex validation email dupliquée → créer `utils/validators.ts` avec `validateEmail()` — `authController.ts:17-20 & 59-62`
- [ ] `getRootUserId` / `getActorUserId` locaux → centraliser dans `utils/authHelpers.ts`
- [ ] Unifier la validation des entrées : tout passer à `express-validator` dans les routes (actuellement moitié manuelle)

### Découpage des fichiers trop longs
- [ ] **`shareService.ts`** (~864 lignes) → découper en `SharedLinkService`, `SharedFolderService`, `SharedFileService`, `SharePermissionService`
- [ ] **`fileService.ts`** (~732 lignes) → découper en `FileUploadService`, `FileDownloadService`, `FileSearchService`, `FileFavoriteService`
- [ ] **`authController.ts`** (~504 lignes) → extraire `UserProfileController`, `DataExportController`
- [ ] **`shareController.ts`** (~550 lignes) → aligner avec le découpage de shareService

### Performance
- [ ] Corriger export GDPR : 9 includes imbriqués chargent tout en mémoire → requêtes séparées paginées — `authController.ts:227`
- [ ] Ajouter pagination par défaut sur `listFiles` (ex: `take: 50`) — `fileService.ts`
- [ ] Remplacer `getUniqueFileName` O(n) (boucle while) par UUID/timestamp — `fileService.ts:40-76`
- [ ] Vérifier et ajouter les index composites manquants dans le schéma Prisma (ex: `userId + isDeleted + name`)
- [ ] Ajouter caching Redis pour : user info (TTL 5min), folder metadata (TTL 1min), user search (TTL 30s)

### TypeScript
- [x] Remplacer `catch (error: any)` par `catch (error) { const msg = error instanceof Error ? error.message : 'Unknown error' }` — global (10 fichiers traités)
- [ ] Sécuriser les conversions BigInt → Number (`authController.ts:135`, `planService.ts:85`)

---

## 🟢 LONG TERME

- [ ] Ajouter versioning d'API (`/api/v1/`) sur toutes les routes
- [ ] Découpler les services via événements ou injection de dépendances (FolderService importe actuellement 3 autres services)
- [ ] Offusquer les données sensibles dans l'export GDPR (IP, user-agents, devices) — `authController.ts:227`
- [ ] Implémenter une job queue (ex: BullMQ) pour les opérations fire-and-forget (notifications, audit logs, incréments de vues)
- [ ] Ajouter JSDoc sur toutes les fonctions publiques des services

---

## Stats

| Catégorie | Nb. problèmes |
|-----------|--------------|
| Sécurité | 10 |
| Doublons | 4 |
| Fichiers trop longs | 4 |
| Architecture | 4 |
| Performance | 5 |
| TypeScript | 3 |
| Cohérence | 5 |
| **Total** | **42** |
