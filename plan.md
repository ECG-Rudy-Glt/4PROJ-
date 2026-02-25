# Plan d'implémentation des nouvelles fonctionnalités SUPFILE

## 📊 État actuel (Audit)

### ✅ Fonctionnalités déjà implémentées
- **Favoris** : Système complet avec `isFavorite`
- **Partage avec liens** : Password, expiration, maxDownloads
- **Corbeille** : Soft delete avec `isDeleted`
- **Upload multiple** : Interface existe, upload séquentiel
- **Recherche** : Filtrage par nom, type, dates

### ⚠️ Fonctionnalités partielles
- **AuditLog** : Modèle existe mais non utilisé
- **Tri** : Fixe (createdAt desc), pas paramétrable
- **Droits partage** : Seulement `canEdit` binaire

### ❌ Fonctionnalités manquantes
- Tags/étiquettes
- Versionning
- Commentaires
- Purge automatique 90 jours
- Gestion doublons (renommage auto)
- Tri/filtres dynamiques
- WebSockets temps réel
- Timeout session
- Notifications email
- Droits granulaires (lecture/écriture/suppression)
- faire une pipeline github actions. Celle ci va verifier les tests, les lint et les build. Ensuite elle va deployer sur un serveur.
- faire regex addresses mail valide
- partages a revoir 

---

## 🎯 Priorités d'implémentation

### Phase 1 : Améliorations immédiates (Impact élevé, Effort faible)

#### 1.1 Filtres avancés et tri dynamique
**Pourquoi en premier** : Amélioration UX immédiate, faible complexité

**Backend** :
- Ajouter paramètres `sortBy` et `sortOrder` aux API
- Modifier `fileService.listFiles()` pour accepter tri dynamique
- Options : `name`, `size`, `createdAt`, `updatedAt`

**Frontend** :
- Dropdown de tri dans FilesPage
- Options : A-Z, Z-A, Plus récents, Plus anciens, Plus volumineux, Plus petits

**Fichiers concernés** :
- `backend/src/services/fileService.ts` (ligne 78-92)
- `backend/src/controllers/fileController.ts` (ligne 48-62)
- `frontend/src/pages/FilesPage.tsx`

#### 1.2 Gestion des doublons
**Pourquoi** : Évite confusion utilisateur, simple à implémenter

**Backend** :
- Avant création fichier, vérifier si nom existe dans même dossier
- Si existe : renommer automatiquement avec pattern " (1)", " (2)", etc.
- Modifier `fileService.createFile()` (ligne 8-57)

**Algorithme** :
```typescript
async function getUniqueFileName(name: string, folderId: string, userId: string) {
  const existingFiles = await prisma.file.findMany({
    where: { name: { startsWith: baseName }, folderId, userId, isDeleted: false }
  });
  if (existingFiles.length === 0) return name;

  let counter = 1;
  let newName = `${baseName} (${counter})${extension}`;
  while (existingFiles.some(f => f.name === newName)) {
    counter++;
    newName = `${baseName} (${counter})${extension}`;
  }
  return newName;
}
```

**Fichiers concernés** :
- `backend/src/services/fileService.ts`

#### 1.3 Upload multiple amélioré
**Pourquoi** : Expérience utilisateur fluide

**Améliorations** :
- Upload en parallèle (3-5 fichiers simultanés au lieu de séquentiel)
- Barre de progression globale
- Déjà en place : UploadModal.tsx avec UI complète

**Frontend** :
- Modifier `startUpload()` dans FilesPage.tsx (ligne 142-196)
- Utiliser `Promise.all()` avec limite de concurrence

**Fichiers concernés** :
- `frontend/src/pages/FilesPage.tsx` (ligne 142-196)
- `frontend/src/components/UploadModal.tsx`

---

### Phase 2 : Fonctionnalités métier (Impact élevé, Effort moyen)

#### 2.1 Système de tags
**Pourquoi** : Organisation et recherche améliorées

**Backend** :
- Nouveau modèle Prisma `Tag` avec relation many-to-many
- Routes : POST/GET/DELETE `/api/files/:fileId/tags`
- Service pour CRUD tags

**Schema Prisma** :
```prisma
model Tag {
  id        String   @id @default(uuid())
  name      String
  color     String   @default("#6366f1")
  userId    String
  user      User     @relation(...)
  files     FileTag[]
  createdAt DateTime @default(now())
  @@unique([userId, name])
}

model FileTag {
  id        String @id @default(uuid())
  fileId    String
  file      File   @relation(...)
  tagId     String
  tag       Tag    @relation(...)
  @@unique([fileId, tagId])
}
```

**Frontend** :
- Composant TagsInput pour ajouter/retirer tags
- Affichage badges colorés
- Filtrage par tags

**Fichiers à créer/modifier** :
- `backend/prisma/schema.prisma` (ajouter modèles)
- `backend/src/services/tagService.ts` (nouveau)
- `backend/src/controllers/tagController.ts` (nouveau)
- `backend/src/routes/tagRoutes.ts` (nouveau)
- `frontend/src/components/TagsInput.tsx` (nouveau)
- `frontend/src/pages/FilesPage.tsx`

#### 2.2 Purge automatique 90 jours
**Pourquoi** : Libération automatique d'espace

**Backend** :
- Installer `node-cron` : `npm install node-cron @types/node-cron`
- Créer `backend/src/jobs/trashCleanup.ts`
- Cron job quotidien : supprimer fichiers où `deletedAt < now() - 90 days`
- Décrémenter quotas utilisateurs

**Cron job** :
```typescript
cron.schedule('0 2 * * *', async () => { // 2h du matin
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const oldFiles = await prisma.file.findMany({
    where: { isDeleted: true, deletedAt: { lte: ninetyDaysAgo } }
  });

  for (const file of oldFiles) {
    await deleteFile(file.storagePath);
    await prisma.file.delete({ where: { id: file.id } });
    await prisma.user.update({
      where: { id: file.userId },
      data: { quotaUsed: { decrement: file.size } }
    });
  }
});
```

**Fichiers à créer/modifier** :
- `backend/package.json` (ajouter dépendance)
- `backend/src/jobs/trashCleanup.ts` (nouveau)
- `backend/src/index.ts` (importer et démarrer cron)

#### 2.3 Commentaires sur fichiers
**Pourquoi** : Collaboration autour des documents

**Backend** :
- Nouveau modèle Prisma `Comment`
- Routes CRUD : POST/GET/PUT/DELETE `/api/files/:fileId/comments`

**Schema Prisma** :
```prisma
model Comment {
  id        String   @id @default(uuid())
  content   String
  fileId    String
  file      File     @relation(...)
  userId    String
  user      User     @relation(...)
  parentId  String?  // Pour réponses
  parent    Comment? @relation("CommentReplies", ...)
  replies   Comment[] @relation("CommentReplies")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([fileId])
  @@index([userId])
}
```

**Frontend** :
- Composant CommentsPanel
- Fil de discussion avec réponses
- Affichage dans FilePreviewModal

**Fichiers à créer/modifier** :
- `backend/prisma/schema.prisma`
- `backend/src/services/commentService.ts` (nouveau)
- `backend/src/controllers/commentController.ts` (nouveau)
- `backend/src/routes/commentRoutes.ts` (nouveau)
- `frontend/src/components/CommentsPanel.tsx` (nouveau)
- `frontend/src/components/FilePreviewModal.tsx`

---

### Phase 3 : Fonctionnalités avancées (Impact moyen, Effort élevé)

#### 3.1 Versionning de fichiers
**Pourquoi** : Historique et récupération

**Backend** :
- Nouveau modèle `FileVersion`
- Lors d'update de fichier, créer version au lieu d'écraser
- Routes : GET versions, POST restore version

**Schema Prisma** :
```prisma
model FileVersion {
  id          String   @id @default(uuid())
  fileId      String
  file        File     @relation(...)
  versionNumber Int
  name        String
  size        BigInt
  storagePath String
  mimeType    String
  createdAt   DateTime @default(now())
  createdBy   String
  user        User     @relation(...)
  @@unique([fileId, versionNumber])
  @@index([fileId])
}
```

**Stratégie** :
- Conserver N dernières versions (10 par défaut)
- Comptabiliser dans quota utilisateur
- Interface historique des versions

**Fichiers à créer/modifier** :
- `backend/prisma/schema.prisma`
- `backend/src/services/fileService.ts` (modifier update)
- `backend/src/services/versionService.ts` (nouveau)
- `backend/src/controllers/versionController.ts` (nouveau)
- `frontend/src/components/VersionHistory.tsx` (nouveau)

#### 3.2 Activation et utilisation d'AuditLog
**Pourquoi** : Traçabilité et sécurité

**Backend** :
- Créer `auditService.createLog(userId, action, details)`
- Appeler dans tous les services lors d'actions critiques
- Routes : GET `/api/audit/logs` (admin/user)

**Actions à logger** :
- UPLOAD, DELETE, DOWNLOAD, SHARE, CREATE_FOLDER, RESTORE
- LOGIN, LOGOUT, PASSWORD_CHANGE, PROFILE_UPDATE

**Fichiers à créer/modifier** :
- `backend/src/services/auditService.ts` (nouveau)
- Modifier tous les services pour logger : fileService, authService, shareService, folderService
- `backend/src/controllers/auditController.ts` (nouveau)
- `backend/src/routes/auditRoutes.ts` (nouveau)

#### 3.3 Droits de partage granulaires
**Pourquoi** : Contrôle fin des permissions

**Backend** :
- Étendre `SharedFolder` avec permissions détaillées
- Modifier schéma : remplacer `canEdit` par flags multiples

**Schema Prisma modifié** :
```prisma
model SharedFolder {
  // ... existing fields
  canRead   Boolean @default(true)
  canWrite  Boolean @default(false)  // upload/modify files
  canDelete Boolean @default(false)
  canShare  Boolean @default(false)  // reshare to others
  // ... rest
}
```

**Middleware** :
- Vérifier permissions avant chaque action sur fichier partagé

**Fichiers à modifier** :
- `backend/prisma/schema.prisma`
- `backend/src/services/shareService.ts`
- `backend/src/middlewares/permissions.ts` (nouveau)
- `frontend/src/pages/SharedPage.tsx`

---

### Phase 4 : Fonctionnalités de sécurité (Impact critique, Effort élevé)

#### 4.1 Timeout de session avec inactivité
**Pourquoi** : Sécurité

**Backend** :
- Ajouter `lastActivity` dans RefreshToken
- Middleware qui vérifie inactivité (15min par défaut)
- Invalider token si timeout dépassé

**Fichiers à modifier** :
- `backend/src/middlewares/auth.ts`
- `backend/src/services/authService.ts`
- `backend/prisma/schema.prisma` (ajouter lastActivity)

#### 4.2 2FA (TOTP)
**Pourquoi** : Sécurité renforcée

**Backend** :
- Installer `speakeasy` et `qrcode`
- Nouveau modèle `TwoFactorAuth`
- Endpoints : enable/disable/verify 2FA

**Schema Prisma** :
```prisma
model TwoFactorAuth {
  id        String   @id @default(uuid())
  userId    String   @unique
  user      User     @relation(...)
  secret    String
  enabled   Boolean  @default(false)
  backupCodes String[] // Codes de secours
  createdAt DateTime @default(now())
}
```

**Frontend** :
- Page setup 2FA avec QR code
- Modal vérification lors du login

**Fichiers à créer/modifier** :
- `backend/prisma/schema.prisma`
- `backend/src/services/twoFactorService.ts` (nouveau)
- `backend/src/controllers/twoFactorController.ts` (nouveau)
- `frontend/src/pages/TwoFactorSetup.tsx` (nouveau)
- `frontend/src/components/TwoFactorModal.tsx` (nouveau)

---

### Phase 5 : Temps réel et notifications (Impact moyen, Effort très élevé)

#### 5.1 WebSockets temps réel
**Pourquoi** : Collaboration en direct

**Backend** :
- Installer `socket.io`
- Créer serveur WebSocket
- Events : file_uploaded, file_deleted, comment_added, share_created

**Architecture** :
```
WebSocket Server
├── Rooms par dossier
├── Events émis lors de mutations
└── Authentification JWT via handshake
```

**Fichiers à créer/modifier** :
- `backend/package.json` (socket.io)
- `backend/src/websocket/server.ts` (nouveau)
- `backend/src/websocket/events.ts` (nouveau)
- `backend/src/index.ts` (initialiser WS)
- Modifier tous les services pour émettre events
- `frontend/src/services/websocket.ts` (nouveau)
- `frontend/src/stores/` (écouter events WS)

#### 5.2 Notifications email
**Pourquoi** : Alertes importantes

**Backend** :
- Installer `nodemailer`
- Service email avec templates
- Notifications : partage reçu, lien expire bientôt, quota atteint

**Configuration** :
- SMTP settings dans `.env`
- Templates HTML pour emails

**Fichiers à créer/modifier** :
- `backend/package.json` (nodemailer)
- `backend/src/services/emailService.ts` (nouveau)
- `backend/src/templates/emails/` (templates HTML)
- `backend/.env` (SMTP config)
- Modifier shareService, authService pour envoyer emails

---

## 🗂️ Ordre d'exécution recommandé

1. **Filtres avancés** (1h) - Impact immédiat
2. **Gestion doublons** (30min) - Évite problèmes
3. **Upload parallèle** (1h) - Meilleure UX
4. **Tags** (3h) - Organisation
5. **Purge automatique** (2h) - Maintenance
6. **Commentaires** (4h) - Collaboration
7. **AuditLog activation** (2h) - Traçabilité
8. **Versionning** (6h) - Historique
9. **Droits granulaires** (3h) - Sécurité
10. **Timeout session** (2h) - Sécurité
11. **2FA** (5h) - Sécurité forte
12. **WebSockets** (8h) - Temps réel
13. **Notifications email** (4h) - Alertes

**Total estimé** : ~41 heures de développement

---

## 📝 Migrations Prisma nécessaires

Chaque modification du schéma nécessitera :
```bash
npx prisma migrate dev --name <nom_migration>
npx prisma generate
docker compose down && docker compose up -d --build
```

Migrations à créer :
1. `add_tags_system` (Tag, FileTag)
2. `add_comments` (Comment)
3. `add_file_versions` (FileVersion)
4. `add_audit_log_fields` (lastActivity dans RefreshToken)
5. `add_granular_permissions` (modifier SharedFolder)
6. `add_two_factor_auth` (TwoFactorAuth)

---

## ⚠️ Points d'attention

1. **Quota** : Tags, commentaires, versions comptent dans le quota
2. **Performance** : Indexer tous les nouveaux champs de recherche
3. **Sécurité** : Valider toutes les entrées utilisateur
4. **Compatibilité** : Migrations rétrocompatibles
5. **Tests** : Tester chaque fonctionnalité avant passage à la suivante

---

## 🚀 Prêt à démarrer

Le plan est structuré pour implémenter progressivement. Nous pouvons commencer par les phases 1-2 qui apportent le plus de valeur rapidement.
