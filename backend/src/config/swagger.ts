// ─── Reusable schemas ────────────────────────────────────────────────────────

const ErrorSchema: Record<string, any> = {
  type: 'object',
  properties: { error: { type: 'string' } },
};

const UserSchema: Record<string, any> = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    name: { type: 'string' },
    plan: { type: 'string', enum: ['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'] },
    quotaUsed: { type: 'integer' },
    quotaLimit: { type: 'integer' },
    hasPassword: { type: 'boolean' },
    mfaEnabled: { type: 'boolean' },
    authProvider: { type: 'string', enum: ['local', 'google', 'github', 'deleted'] },
    vaultEnabled: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

const FileSchema: Record<string, any> = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    originalName: { type: 'string' },
    mimeType: { type: 'string' },
    size: { type: 'integer' },
    checksum: { type: 'string', nullable: true, description: 'SHA-256 optionnel, utilisé par SupFile Sync' },
    folderId: { type: 'string', format: 'uuid', nullable: true },
    isFavorite: { type: 'boolean' },
    isDeleted: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const FolderSchema: Record<string, any> = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    path: { type: 'string' },
    parentId: { type: 'string', format: 'uuid', nullable: true },
    isVault: { type: 'boolean' },
    isDeleted: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const SyncTreeFileSchema: Record<string, any> = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    originalName: { type: 'string' },
    mimeType: { type: 'string' },
    size: { type: 'integer' },
    checksum: { type: 'string', nullable: true },
    folderId: { type: 'string', format: 'uuid', nullable: true },
    updatedAt: { type: 'string', format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

const SyncTreeFolderSchema: Record<string, any> = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    path: { type: 'string' },
    parentId: { type: 'string', format: 'uuid', nullable: true },
    updatedAt: { type: 'string', format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' },
    folders: {
      type: 'array',
      items: { $ref: '#/components/schemas/SyncTreeFolder' },
    },
    files: {
      type: 'array',
      items: { $ref: '#/components/schemas/SyncTreeFile' },
    },
  },
};

const SyncConflictSchema: Record<string, any> = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    error: { type: 'string', example: 'Remote file changed since last sync' },
    code: { type: 'string', example: 'SYNC_CONFLICT' },
    file: { $ref: '#/components/schemas/SyncTreeFile' },
  },
};

const TagSchema: Record<string, any> = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    color: { type: 'string' },
  },
};

const VaultStatusSchema: Record<string, any> = {
  type: 'object',
  properties: {
    available: { type: 'boolean' },
    plan: { type: 'string', enum: ['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'] },
    enabled: { type: 'boolean' },
    mfaEnabled: { type: 'boolean' },
    unlocked: { type: 'boolean' },
    unlockUntil: { type: 'string', format: 'date-time', nullable: true },
    lockedUntil: { type: 'string', format: 'date-time', nullable: true },
    failedAttempts: { type: 'integer' },
    lastUnlockedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

const BearerAuth: Record<string, any> = {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'Token JWT obtenu via POST /api/auth/login',
};

// ─── Full spec ────────────────────────────────────────────────────────────────

export const swaggerSpec: Record<string, any> = {
  openapi: '3.0.3',
  info: {
    title: 'SUPFile API',
    version: '1.0.0',
    description: `API REST de la plateforme **SUPFile** - stockage cloud sécurisé avec chiffrement AES-256, coffre-fort, IA (Bobby), partage granulaire et collaboration.

## Authentification
La plupart des endpoints nécessitent un token JWT transmis dans l'en-tête :
\`\`\`
Authorization: Bearer <token>
\`\`\`

Obtenez un token via **POST /api/auth/login**.

## Rate Limiting
- Global : **500 req / min**
- Auth (login/register) : **10 req / 15 min**`,
    contact: { name: 'SUPFile Team' },
  },
  servers: [
    { url: 'http://localhost:5001/api', description: 'Développement local' },
  ],
  components: {
    securitySchemes: { BearerAuth },
    schemas: {
      Error: ErrorSchema,
      User: UserSchema,
      File: FileSchema,
      Folder: FolderSchema,
      SyncTreeFile: SyncTreeFileSchema,
      SyncTreeFolder: SyncTreeFolderSchema,
      SyncConflict: SyncConflictSchema,
      Tag: TagSchema,
      VaultStatus: VaultStatusSchema,
    },
  },
  security: [{ BearerAuth: [] }],
  tags: [
    { name: 'Auth', description: 'Authentification & profil utilisateur' },
    { name: 'Files', description: 'Gestion des fichiers' },
    { name: 'Folders', description: 'Gestion des dossiers' },
    { name: 'Share', description: 'Partage (liens publics & interne)' },
    { name: 'Tags', description: 'Tags et catégorisation' },
    { name: 'Vault', description: 'Coffre-fort sécurisé (plan PRO+)' },
    { name: 'Dashboard', description: 'Statistiques et activité' },
    { name: 'AI', description: 'Assistant IA Bobby (RAG, analyse, génération)' },
    { name: 'MFA', description: 'Authentification multi-facteurs (TOTP)' },
    { name: 'Audit', description: 'Logs d\'audit et traçabilité' },
    { name: 'Notifications', description: 'Notifications en temps réel' },
    { name: 'Comments', description: 'Commentaires sur fichiers' },
    { name: 'Versions', description: 'Versions de fichiers' },
    { name: 'Users', description: 'Recherche et gestion utilisateurs' },
    { name: 'Admin', description: 'Administration (super-admin uniquement)' },
    { name: 'Billing', description: 'Facturation et abonnements (Stripe)' },
    { name: 'Organizations', description: 'Organisations et membres' },
    { name: 'AccountAccess', description: 'Délégations et switch de compte' },
    { name: 'Sync', description: 'SupFile Sync Windows (synchronisation desktop)' },
    { name: 'Push', description: 'Notifications Web Push' },
    { name: 'OnlyOffice', description: 'Édition de documents en ligne' },
  ],
  paths: {

    // ═══════════════════════════════════════════════════════════
    // AUTH
    // ═══════════════════════════════════════════════════════════

    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Inscription',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 6 },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Compte créé - retourne token JWT et profil utilisateur' },
          '400': { description: 'Validation échouée', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '409': { description: 'Email déjà utilisé' },
        },
      },
    },

    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Connexion',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Connexion réussie',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' },
                    user: { $ref: '#/components/schemas/User' },
                    requireMfa: { type: 'boolean' },
                    tempToken: { type: 'string', description: 'Présent si MFA requis' },
                  },
                },
              },
            },
          },
          '401': { description: 'Identifiants invalides' },
          '429': { description: 'Trop de tentatives' },
        },
      },
    },

    '/auth/providers': {
      get: {
        tags: ['Auth'],
        summary: 'Disponibilite des providers OAuth',
        security: [],
        responses: {
          '200': {
            description: 'Providers OAuth configures',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        google: { type: 'boolean' },
                        github: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/auth/profile': {
      get: {
        tags: ['Auth'],
        summary: 'Profil utilisateur connecté',
        responses: {
          '200': { description: 'Profil', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          '401': { description: 'Non authentifié' },
        },
      },
      put: {
        tags: ['Auth'],
        summary: 'Mettre à jour le profil',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  theme: { type: 'string', enum: ['light', 'dark'] },
                  language: { type: 'string', enum: ['fr', 'en'] },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Profil mis à jour' },
          '401': { description: 'Non authentifié' },
        },
      },
    },

    '/auth/avatar': {
      post: {
        tags: ['Auth'],
        summary: 'Upload avatar',
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: { type: 'object', properties: { avatar: { type: 'string', format: 'binary' } } },
            },
          },
        },
        responses: {
          '200': { description: 'Avatar mis à jour' },
          '400': { description: 'Fichier invalide' },
        },
      },
    },

    '/auth/change-password': {
      post: {
        tags: ['Auth'],
        summary: 'Changer le mot de passe',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['oldPassword', 'newPassword'],
                properties: {
                  oldPassword: { type: 'string' },
                  newPassword: { type: 'string', minLength: 6 },
                  mfaCode: { type: 'string', description: 'Code MFA (TOTP ou code de secours) requis si MFA activé' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Mot de passe changé' },
          '400': { description: 'Ancien mot de passe incorrect' },
        },
      },
    },

    '/auth/logout-all': {
      post: {
        tags: ['Auth'],
        summary: 'Déconnexion globale (invalide tous les tokens)',
        responses: { '200': { description: 'Déconnecté de toutes les sessions' } },
      },
    },

    '/auth/export-data': {
      get: {
        tags: ['Auth'],
        summary: 'Export RGPD des données personnelles',
        responses: {
          '200': { description: 'Archive ZIP des données utilisateur', content: { 'application/zip': {} } },
        },
      },
    },

    '/auth/account': {
      delete: {
        tags: ['Auth'],
        summary: 'Supprimer et anonymiser le compte connecté',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['confirmationEmail'],
                properties: {
                  confirmationEmail: { type: 'string', format: 'email' },
                  currentPassword: { type: 'string', description: 'Requis si le compte possède un mot de passe local' },
                  mfaCode: { type: 'string', description: 'Requis si le MFA est actif' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Compte supprimé et anonymisé' },
          '400': { description: 'Confirmation invalide' },
          '401': { description: 'Réauthentification invalide' },
          '403': { description: 'Session directe requise' },
          '409': { description: 'Suppression bloquée par une contrainte admin ou organisation' },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // FILES
    // ═══════════════════════════════════════════════════════════

    '/files': {
      get: {
        tags: ['Files'],
        summary: 'Lister les fichiers',
        parameters: [
          { name: 'folderId', in: 'query', schema: { type: 'string', format: 'uuid' }, description: 'Filtrer par dossier' },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['name', 'size', 'createdAt', 'updatedAt'] } },
          { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
        ],
        responses: {
          '200': {
            description: 'Liste des fichiers',
            content: { 'application/json': { schema: { type: 'object', properties: { files: { type: 'array', items: { $ref: '#/components/schemas/File' } } } } } },
          },
        },
      },
    },

    '/files/upload': {
      post: {
        tags: ['Files'],
        summary: 'Upload de fichier(s)',
        description: 'Chiffrement AES-256 appliqué automatiquement. Limite : 100 Mo (FREE) / 500 Mo (PRO).',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['files'],
                properties: {
                  files: { type: 'array', items: { type: 'string', format: 'binary' } },
                  folderId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Fichier(s) uploadé(s)' },
          '400': { description: 'Quota dépassé ou fichier invalide' },
          '413': { description: 'Fichier trop volumineux' },
        },
      },
    },

    '/files/deleted': {
      get: {
        tags: ['Files'],
        summary: 'Fichiers dans la corbeille',
        responses: { '200': { description: 'Liste des fichiers supprimés' } },
      },
    },

    '/files/favorites': {
      get: {
        tags: ['Files'],
        summary: 'Fichiers marqués en favoris',
        responses: { '200': { description: 'Liste des favoris' } },
      },
    },

    '/files/search': {
      get: {
        tags: ['Files'],
        summary: 'Recherche de fichiers par nom',
        parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Résultats de la recherche' } },
      },
    },

    '/files/export/csv': {
      get: {
        tags: ['Files'],
        summary: 'Export CSV des métadonnées fichiers',
        responses: { '200': { description: 'Fichier CSV', content: { 'text/csv': {} } } },
      },
    },

    '/files/{fileId}': {
      get: {
        tags: ['Files'],
        summary: 'Détails d\'un fichier',
        parameters: [{ name: 'fileId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Détails fichier', content: { 'application/json': { schema: { $ref: '#/components/schemas/File' } } } },
          '404': { description: 'Fichier introuvable' },
        },
      },
      put: {
        tags: ['Files'],
        summary: 'Renommer un fichier',
        parameters: [{ name: 'fileId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' } } } } },
        },
        responses: { '200': { description: 'Fichier mis à jour' }, '404': { description: 'Fichier introuvable' } },
      },
      delete: {
        tags: ['Files'],
        summary: 'Supprimer un fichier (corbeille)',
        parameters: [
          { name: 'fileId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'permanent', in: 'query', schema: { type: 'boolean' }, description: 'Suppression définitive' },
        ],
        responses: { '200': { description: 'Fichier supprimé' } },
      },
    },

    '/files/{fileId}/download': {
      get: {
        tags: ['Files'],
        summary: 'Télécharger un fichier (déchiffré)',
        parameters: [{ name: 'fileId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Contenu du fichier déchiffré', content: { 'application/octet-stream': {} } },
          '404': { description: 'Fichier introuvable' },
        },
      },
    },

    '/files/{fileId}/stream': {
      get: {
        tags: ['Files'],
        summary: 'Streamer un fichier (audio/vidéo)',
        description: 'Supporte les Range Headers pour la lecture progressive. Authentification via Authorization: Bearer uniquement.',
        parameters: [
          { name: 'fileId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'Flux complet' },
          '206': { description: 'Contenu partiel (Range)' },
        },
      },
    },

    '/files/{fileId}/move': {
      put: {
        tags: ['Files'],
        summary: 'Déplacer un fichier vers un dossier',
        parameters: [{ name: 'fileId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { folderId: { type: 'string', format: 'uuid', nullable: true, description: 'null = racine' } } } } },
        },
        responses: { '200': { description: 'Fichier déplacé' } },
      },
    },

    '/files/{fileId}/restore': {
      post: {
        tags: ['Files'],
        summary: 'Restaurer un fichier depuis la corbeille',
        parameters: [{ name: 'fileId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Fichier restauré' } },
      },
    },

    '/files/{fileId}/favorite': {
      post: {
        tags: ['Files'],
        summary: 'Ajouter / retirer des favoris',
        parameters: [{ name: 'fileId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Statut favori modifié' } },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // FOLDERS
    // ═══════════════════════════════════════════════════════════

    '/folders': {
      get: {
        tags: ['Folders'],
        summary: 'Lister les dossiers',
        parameters: [{ name: 'parentId', in: 'query', schema: { type: 'string', format: 'uuid' }, description: 'Dossier parent (vide = racine)' }],
        responses: { '200': { description: 'Liste des dossiers', content: { 'application/json': { schema: { type: 'object', properties: { folders: { type: 'array', items: { $ref: '#/components/schemas/Folder' } } } } } } } },
      },
      post: {
        tags: ['Folders'],
        summary: 'Créer un dossier',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, parentId: { type: 'string', format: 'uuid' } } } } },
        },
        responses: {
          '201': { description: 'Dossier créé', content: { 'application/json': { schema: { $ref: '#/components/schemas/Folder' } } } },
          '409': { description: 'Nom déjà utilisé dans ce répertoire' },
        },
      },
    },

    '/folders/deleted': {
      get: {
        tags: ['Folders'],
        summary: 'Dossiers dans la corbeille',
        responses: { '200': { description: 'Liste des dossiers supprimés' } },
      },
    },

    '/folders/{folderId}': {
      get: {
        tags: ['Folders'],
        summary: 'Détails d\'un dossier',
        parameters: [{ name: 'folderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Détails dossier', content: { 'application/json': { schema: { $ref: '#/components/schemas/Folder' } } } } },
      },
      put: {
        tags: ['Folders'],
        summary: 'Renommer un dossier',
        parameters: [{ name: 'folderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } } } },
        },
        responses: { '200': { description: 'Dossier renommé' } },
      },
      delete: {
        tags: ['Folders'],
        summary: 'Supprimer un dossier',
        parameters: [
          { name: 'folderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'permanent', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: { '200': { description: 'Dossier supprimé' } },
      },
    },

    '/folders/{folderId}/download': {
      get: {
        tags: ['Folders'],
        summary: 'Télécharger un dossier complet en ZIP',
        description: 'Génère une archive ZIP à la volée. Les fichiers sont déchiffrés (AES-256) pendant le streaming. L\'arborescence est préservée dans le ZIP.',
        parameters: [{ name: 'folderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Archive ZIP streamée', content: { 'application/zip': {} } },
          '403': { description: 'Accès refusé ou coffre-fort verrouillé' },
          '404': { description: 'Dossier introuvable' },
        },
      },
    },

    '/folders/{folderId}/move': {
      put: {
        tags: ['Folders'],
        summary: 'Déplacer un dossier',
        parameters: [{ name: 'folderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { parentId: { type: 'string', format: 'uuid', nullable: true } } } } },
        },
        responses: { '200': { description: 'Dossier déplacé' } },
      },
    },

    '/folders/{folderId}/breadcrumbs': {
      get: {
        tags: ['Folders'],
        summary: 'Fil d\'Ariane (chemin complet)',
        parameters: [{ name: 'folderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': {
            description: 'Breadcrumbs',
            content: { 'application/json': { schema: { type: 'object', properties: { breadcrumbs: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } } } } } } },
          },
        },
      },
    },

    '/folders/{folderId}/restore': {
      post: {
        tags: ['Folders'],
        summary: 'Restaurer un dossier depuis la corbeille',
        parameters: [{ name: 'folderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Dossier restauré' } },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // VAULT
    // ═══════════════════════════════════════════════════════════

    '/vault/status': {
      get: {
        tags: ['Vault'],
        summary: 'Statut du coffre-fort',
        responses: {
          '200': {
            description: 'Statut et dossier racine du coffre-fort',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { $ref: '#/components/schemas/VaultStatus' },
                    rootFolder: { $ref: '#/components/schemas/Folder' },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/vault/setup': {
      post: {
        tags: ['Vault'],
        summary: 'Initialiser le coffre-fort',
        description: 'Nécessite un plan PRO+, MFA activé et un mot de passe fort (12 car. min, majuscule, minuscule, chiffre, spécial).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['password', 'totpCode'],
                properties: {
                  password: { type: 'string', minLength: 12, description: 'Mot de passe fort du coffre-fort' },
                  totpCode: { type: 'string', description: 'Code TOTP 6 chiffres' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Coffre-fort initialisé', content: { 'application/json': { schema: { $ref: '#/components/schemas/VaultStatus' } } } },
          '400': { description: 'Mot de passe trop faible ou MFA non activé' },
          '403': { description: 'Plan insuffisant (FREE)' },
        },
      },
    },

    '/vault/unlock': {
      post: {
        tags: ['Vault'],
        summary: 'Déverrouiller le coffre-fort',
        description: 'Session valide 10 minutes (configurable). Après 5 échecs, verrouillage 15 min.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['password', 'totpCode'],
                properties: {
                  password: { type: 'string' },
                  totpCode: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Coffre-fort déverrouillé' },
          '401': { description: 'Identifiants invalides' },
          '423': { description: 'Coffre-fort temporairement verrouillé' },
        },
      },
    },

    '/vault/lock': {
      post: {
        tags: ['Vault'],
        summary: 'Verrouiller le coffre-fort',
        responses: { '200': { description: 'Coffre-fort verrouillé' } },
      },
    },

    '/vault/rotate-password': {
      post: {
        tags: ['Vault'],
        summary: 'Changer le mot de passe du coffre-fort',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['oldPassword', 'newPassword', 'totpCode'],
                properties: {
                  oldPassword: { type: 'string' },
                  newPassword: { type: 'string', minLength: 12 },
                  totpCode: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Mot de passe modifié' }, '400': { description: 'Ancien mot de passe invalide' } },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // SHARE
    // ═══════════════════════════════════════════════════════════

    '/share/links': {
      post: {
        tags: ['Share'],
        summary: 'Créer un lien de partage public',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['fileId'],
                properties: {
                  fileId: { type: 'string', format: 'uuid' },
                  password: { type: 'string' },
                  expiresAt: { type: 'string', format: 'date-time' },
                  maxDownloads: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Lien créé avec token unique' } },
      },
      get: {
        tags: ['Share'],
        summary: 'Lister mes liens de partage publics',
        responses: { '200': { description: 'Liste des liens' } },
      },
    },

    '/share/links/{linkId}': {
      delete: {
        tags: ['Share'],
        summary: 'Supprimer un lien de partage',
        parameters: [{ name: 'linkId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Lien supprimé' } },
      },
    },

    '/share/{token}': {
      get: {
        tags: ['Share'],
        summary: 'Accès public à un fichier partagé',
        security: [],
        parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Métadonnées du fichier partagé' }, '401': { description: 'Mot de passe requis' }, '404': { description: 'Lien expiré ou introuvable' } },
      },
    },

    '/share/{token}/download': {
      get: {
        tags: ['Share'],
        summary: 'Télécharger un fichier via lien public',
        security: [],
        parameters: [
          { name: 'token', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'password', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Fichier déchiffré' }, '401': { description: 'Mot de passe invalide' }, '410': { description: 'Quota de téléchargements atteint' } },
      },
    },

    '/share/folders': {
      post: {
        tags: ['Share'],
        summary: 'Partager un dossier en interne',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['folderId', 'userId'],
                properties: {
                  folderId: { type: 'string', format: 'uuid' },
                  userId: { type: 'string', format: 'uuid' },
                  canRead: { type: 'boolean', default: true },
                  canWrite: { type: 'boolean', default: false },
                  canDelete: { type: 'boolean', default: false },
                  canShare: { type: 'boolean', default: false },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Partage créé' } },
      },
    },

    '/share/files': {
      post: {
        tags: ['Share'],
        summary: 'Partager un fichier en interne',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['fileId', 'userId'],
                properties: {
                  fileId: { type: 'string', format: 'uuid' },
                  userId: { type: 'string', format: 'uuid' },
                  canWrite: { type: 'boolean', default: false },
                  canDelete: { type: 'boolean', default: false },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Partage créé' } },
      },
    },

    '/share/pending': {
      get: {
        tags: ['Share'],
        summary: 'Partages en attente d\'acceptation',
        responses: { '200': { description: 'Partages dossiers et fichiers en attente' } },
      },
    },

    '/share/files/with-me': {
      get: { tags: ['Share'], summary: 'Fichiers partagés avec moi', responses: { '200': { description: 'Liste' } } },
    },

    '/share/files/by-me': {
      get: { tags: ['Share'], summary: 'Fichiers que j\'ai partagés', responses: { '200': { description: 'Liste' } } },
    },

    '/share/folders/with-me': {
      get: { tags: ['Share'], summary: 'Dossiers partagés avec moi', responses: { '200': { description: 'Liste' } } },
    },

    '/share/folders/by-me': {
      get: { tags: ['Share'], summary: 'Dossiers que j\'ai partagés', responses: { '200': { description: 'Liste' } } },
    },

    // ═══════════════════════════════════════════════════════════
    // TAGS
    // ═══════════════════════════════════════════════════════════

    '/tags': {
      get: {
        tags: ['Tags'],
        summary: 'Lister mes tags',
        responses: { '200': { description: 'Liste des tags', content: { 'application/json': { schema: { type: 'object', properties: { tags: { type: 'array', items: { $ref: '#/components/schemas/Tag' } } } } } } } },
      },
      post: {
        tags: ['Tags'],
        summary: 'Créer un tag',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, color: { type: 'string', description: 'Code couleur hex (#RRGGBB)' } } } } },
        },
        responses: { '201': { description: 'Tag créé', content: { 'application/json': { schema: { $ref: '#/components/schemas/Tag' } } } } },
      },
    },

    '/tags/{tagId}': {
      put: {
        tags: ['Tags'],
        summary: 'Modifier un tag',
        parameters: [{ name: 'tagId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, color: { type: 'string' } } } } } },
        responses: { '200': { description: 'Tag modifié' } },
      },
      delete: {
        tags: ['Tags'],
        summary: 'Supprimer un tag',
        parameters: [{ name: 'tagId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Tag supprimé' } },
      },
    },

    '/tags/file/{fileId}': {
      post: {
        tags: ['Tags'],
        summary: 'Ajouter un tag à un fichier',
        parameters: [{ name: 'fileId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['tagId'], properties: { tagId: { type: 'string', format: 'uuid' } } } } } },
        responses: { '200': { description: 'Tag ajouté au fichier' } },
      },
      get: {
        tags: ['Tags'],
        summary: 'Tags d\'un fichier',
        parameters: [{ name: 'fileId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Liste des tags du fichier' } },
      },
    },

    '/tags/file/{fileId}/{tagId}': {
      delete: {
        tags: ['Tags'],
        summary: 'Retirer un tag d\'un fichier',
        parameters: [
          { name: 'fileId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'tagId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { '200': { description: 'Tag retiré' } },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // DASHBOARD
    // ═══════════════════════════════════════════════════════════

    '/dashboard': {
      get: {
        tags: ['Dashboard'],
        summary: 'Données du tableau de bord',
        description: 'Retourne quota utilisé par type (images, vidéos, documents, autres), fichiers récents et statistiques générales.',
        responses: {
          '200': {
            description: 'Données dashboard',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    quotaUsed: { type: 'integer' },
                    quotaLimit: { type: 'integer' },
                    fileCount: { type: 'integer' },
                    folderCount: { type: 'integer' },
                    recentFiles: { type: 'array', items: { $ref: '#/components/schemas/File' } },
                    storageByType: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // AI - BOBBY
    // ═══════════════════════════════════════════════════════════

    '/ai/chat': {
      post: {
        tags: ['AI'],
        summary: 'Chat avec Bobby (RAG)',
        description: 'Conversation avec l\'assistant IA. Bobby peut accéder aux fichiers de l\'utilisateur via RAG pour répondre avec contexte.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['message'],
                properties: {
                  message: { type: 'string' },
                  conversationId: { type: 'string', format: 'uuid', description: 'Continuer une conversation existante' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Réponse de Bobby', content: { 'application/json': { schema: { type: 'object', properties: { response: { type: 'string' }, conversationId: { type: 'string' } } } } } } },
      },
    },

    '/ai/analyze-file': {
      post: {
        tags: ['AI'],
        summary: 'Analyser un fichier avec l\'IA',
        description: 'OCR sur images, extraction texte PDF, analyse de contenu.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['fileId'],
                properties: {
                  fileId: { type: 'string', format: 'uuid' },
                  prompt: { type: 'string', description: 'Question ou instruction spécifique' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Analyse du fichier' } },
      },
    },

    '/ai/search-files': {
      post: {
        tags: ['AI'],
        summary: 'Recherche sémantique de fichiers',
        description: 'Retrouve des fichiers par leur sens ou contenu via embeddings vectoriels (ChromaDB).',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['query'], properties: { query: { type: 'string' } } } } },
        },
        responses: { '200': { description: 'Fichiers correspondants' } },
      },
    },

    '/ai/generate-file': {
      post: {
        tags: ['AI'],
        summary: 'Générer un fichier via prompt IA',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['prompt'],
                properties: {
                  prompt: { type: 'string' },
                  fileName: { type: 'string' },
                  folderId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Fichier généré et uploadé' } },
      },
    },

    '/ai/conversations': {
      get: {
        tags: ['AI'],
        summary: 'Lister les conversations avec Bobby',
        responses: { '200': { description: 'Liste des conversations' } },
      },
    },

    '/ai/conversations/{id}': {
      get: {
        tags: ['AI'],
        summary: 'Détails d\'une conversation',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Conversation et messages' } },
      },
      delete: {
        tags: ['AI'],
        summary: 'Supprimer une conversation',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Conversation supprimée' } },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // MFA
    // ═══════════════════════════════════════════════════════════

    '/mfa/status': {
      get: {
        tags: ['MFA'],
        summary: 'Statut MFA de l\'utilisateur',
        responses: { '200': { description: 'Statut MFA', content: { 'application/json': { schema: { type: 'object', properties: { enabled: { type: 'boolean' }, method: { type: 'string' } } } } } } },
      },
    },

    '/mfa/setup': {
      post: {
        tags: ['MFA'],
        summary: 'Initialiser le MFA (TOTP)',
        description: 'Retourne un QR code et une clé secrète à scanner dans une app TOTP (Google Authenticator, etc.).',
        responses: { '200': { description: 'QR code et secret TOTP' } },
      },
    },

    '/mfa/verify-setup': {
      post: {
        tags: ['MFA'],
        summary: 'Activer le MFA après setup',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['code'], properties: { code: { type: 'string', description: 'Code TOTP 6 chiffres' } } } } },
        },
        responses: { '200': { description: 'MFA activé - retourne les codes de récupération' }, '400': { description: 'Code invalide' } },
      },
    },

    '/mfa/verify': {
      post: {
        tags: ['MFA'],
        summary: 'Vérifier le code TOTP lors de la connexion',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['code', 'tempToken'], properties: { code: { type: 'string' }, tempToken: { type: 'string' } } } } },
        },
        responses: { '200': { description: 'Connexion validée - retourne token JWT final' }, '401': { description: 'Code invalide' } },
      },
    },

    '/mfa/disable': {
      post: {
        tags: ['MFA'],
        summary: 'Désactiver le MFA',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['code'], properties: { code: { type: 'string' } } } } },
        },
        responses: { '200': { description: 'MFA désactivé' }, '400': { description: 'Code invalide' } },
      },
    },

    '/mfa/trusted-devices': {
      get: {
        tags: ['MFA'],
        summary: 'Appareils de confiance (bypass MFA)',
        responses: { '200': { description: 'Liste des appareils' } },
      },
    },

    '/mfa/trusted-devices/{deviceId}': {
      delete: {
        tags: ['MFA'],
        summary: 'Révoquer un appareil de confiance',
        parameters: [{ name: 'deviceId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Appareil révoqué' } },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // AUDIT
    // ═══════════════════════════════════════════════════════════

    '/audit/logs': {
      get: {
        tags: ['Audit'],
        summary: 'Logs d\'audit utilisateur',
        responses: { '200': { description: 'Historique des actions (upload, download, partage, etc.)' } },
      },
    },

    '/audit/stats': {
      get: {
        tags: ['Audit'],
        summary: 'Statistiques d\'activité',
        responses: { '200': { description: 'Statistiques (actions par type, période)' } },
      },
    },

    '/audit/export/csv': {
      get: {
        tags: ['Audit'],
        summary: 'Export CSV des logs d\'audit',
        responses: { '200': { description: 'Fichier CSV', content: { 'text/csv': {} } } },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // NOTIFICATIONS
    // ═══════════════════════════════════════════════════════════

    '/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'Récupérer les notifications',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: { '200': { description: 'Liste des notifications' } },
      },
    },

    '/notifications/read-all': {
      patch: {
        tags: ['Notifications'],
        summary: 'Marquer toutes les notifications comme lues',
        responses: { '200': { description: 'Toutes marquées comme lues' } },
      },
    },

    '/notifications/{id}/read': {
      patch: {
        tags: ['Notifications'],
        summary: 'Marquer une notification comme lue',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Notification lue' } },
      },
    },

    '/notifications/{id}': {
      delete: {
        tags: ['Notifications'],
        summary: 'Supprimer une notification',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Notification supprimée' } },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // COMMENTS
    // ═══════════════════════════════════════════════════════════

    '/files/{fileId}/comments': {
      post: {
        tags: ['Comments'],
        summary: 'Ajouter un commentaire à un fichier',
        parameters: [{ name: 'fileId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['content'], properties: { content: { type: 'string' } } } } } },
        responses: { '201': { description: 'Commentaire créé' } },
      },
      get: {
        tags: ['Comments'],
        summary: 'Lister les commentaires d\'un fichier',
        parameters: [{ name: 'fileId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Liste des commentaires' } },
      },
    },

    '/comments/{commentId}': {
      put: {
        tags: ['Comments'],
        summary: 'Modifier un commentaire',
        parameters: [{ name: 'commentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['content'], properties: { content: { type: 'string' } } } } } },
        responses: { '200': { description: 'Commentaire modifié' } },
      },
      delete: {
        tags: ['Comments'],
        summary: 'Supprimer un commentaire',
        parameters: [{ name: 'commentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Commentaire supprimé' } },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // VERSIONS
    // ═══════════════════════════════════════════════════════════

    '/files/{fileId}/versions': {
      get: {
        tags: ['Versions'],
        summary: 'Lister les versions d\'un fichier',
        parameters: [{ name: 'fileId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Historique des versions' } },
      },
    },

    '/files/{fileId}/versions/{versionId}/restore': {
      post: {
        tags: ['Versions'],
        summary: 'Restaurer une version antérieure',
        parameters: [
          { name: 'fileId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'versionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { '200': { description: 'Version restaurée' } },
      },
    },

    '/files/{fileId}/versions/{versionId}': {
      delete: {
        tags: ['Versions'],
        summary: 'Supprimer une version',
        parameters: [
          { name: 'fileId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'versionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { '200': { description: 'Version supprimée' } },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // USERS
    // ═══════════════════════════════════════════════════════════

    '/users/search': {
      get: {
        tags: ['Users'],
        summary: 'Rechercher des utilisateurs (pour le partage)',
        parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' }, description: 'Email ou nom' }],
        responses: { '200': { description: 'Utilisateurs trouvés' } },
      },
    },

    '/users/plan': {
      put: {
        tags: ['Users'],
        summary: 'Changer de plan',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['plan'], properties: { plan: { type: 'string', enum: ['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'] } } } } } },
        responses: { '200': { description: 'Plan mis à jour' } },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════

    '/admin/overview': {
      get: {
        tags: ['Admin'],
        summary: 'Vue d\'ensemble de la plateforme',
        description: 'Accès restreint aux super-admins.',
        responses: { '200': { description: 'Statistiques globales' }, '403': { description: 'Accès refusé' } },
      },
    },

    '/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'Lister tous les utilisateurs',
        responses: { '200': { description: 'Liste complète des utilisateurs' } },
      },
    },

    '/admin/users/{userId}/plan': {
      patch: {
        tags: ['Admin'],
        summary: 'Changer le plan d\'un utilisateur',
        parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['plan'], properties: { plan: { type: 'string', enum: ['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'] } } } } } },
        responses: { '200': { description: 'Plan modifié' } },
      },
    },

    '/admin/reindex': {
      post: {
        tags: ['Admin'],
        summary: 'Réindexer tous les fichiers dans ChromaDB',
        responses: { '200': { description: 'Réindexation lancée' } },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // BILLING
    // ═══════════════════════════════════════════════════════════

    '/billing/checkout-session': {
      post: {
        tags: ['Billing'],
        summary: 'Créer une session de paiement Stripe',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['priceId'], properties: { priceId: { type: 'string' }, plan: { type: 'string' } } } } },
        },
        responses: { '200': { description: 'URL de la session Stripe Checkout' } },
      },
    },

    '/billing/portal-session': {
      post: {
        tags: ['Billing'],
        summary: 'Ouvrir le portail client Stripe',
        responses: { '200': { description: 'URL du portail Stripe' } },
      },
    },

    '/billing/downgrade-free': {
      post: {
        tags: ['Billing'],
        summary: 'Rétrograder vers le plan FREE',
        responses: { '200': { description: 'Plan rétrogradé' } },
      },
    },

    '/billing/webhook': {
      post: {
        tags: ['Billing'],
        summary: 'Webhook Stripe (appel automatique)',
        security: [],
        description: 'Endpoint appelé par Stripe pour les événements de facturation. Ne pas appeler manuellement.',
        responses: { '200': { description: 'Webhook traité' } },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // ORGANIZATIONS
    // ═══════════════════════════════════════════════════════════

    '/organizations': {
      post: {
        tags: ['Organizations'],
        summary: 'Créer une organisation',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, description: { type: 'string' } } } } },
        },
        responses: { '201': { description: 'Organisation créée' } },
      },
    },

    '/organizations/mine': {
      get: {
        tags: ['Organizations'],
        summary: 'Mes organisations',
        responses: { '200': { description: 'Liste des organisations' } },
      },
    },

    '/organizations/{orgId}/members': {
      post: {
        tags: ['Organizations'],
        summary: 'Ajouter un membre',
        parameters: [{ name: 'orgId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['userId', 'role'], properties: { userId: { type: 'string', format: 'uuid' }, role: { type: 'string', enum: ['ADMIN', 'MEMBER', 'VIEWER'] } } } } } },
        responses: { '201': { description: 'Membre ajouté' } },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // ACCOUNT ACCESS
    // ═══════════════════════════════════════════════════════════

    '/account-access/delegations': {
      get: {
        tags: ['AccountAccess'],
        summary: 'Lister les délégations d\'accès',
        responses: { '200': { description: 'Délégations actives' } },
      },
      post: {
        tags: ['AccountAccess'],
        summary: 'Accorder une délégation d\'accès à un utilisateur',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userId'],
                properties: {
                  userId: { type: 'string', format: 'uuid' },
                  canRead: { type: 'boolean', default: true },
                  canWrite: { type: 'boolean', default: false },
                  canDelete: { type: 'boolean', default: false },
                  canShare: { type: 'boolean', default: false },
                  expiresAt: { type: 'string', format: 'date-time', nullable: true },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Délégation créée' } },
      },
    },

    '/account-access/delegations/{delegationId}/revoke': {
      patch: {
        tags: ['AccountAccess'],
        summary: 'Révoquer une délégation',
        parameters: [{ name: 'delegationId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Délégation révoquée' } },
      },
    },

    '/account-access/delegations/{delegationId}/assume': {
      post: {
        tags: ['AccountAccess'],
        summary: 'Assumer une délégation (agir au nom d\'un autre utilisateur)',
        parameters: [{ name: 'delegationId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Token de session déléguée retourné' } },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // SYNC WINDOWS
    // ═══════════════════════════════════════════════════════════

    '/sync/root': {
      get: {
        tags: ['Sync'],
        summary: 'Créer ou récupérer le dossier racine SupFile Sync',
        description: 'Endpoint idempotent utilisé par le client desktop Windows. Retourne le dossier racine `SupFile Sync` de l\'utilisateur courant, ou le restaure s\'il existait en corbeille.',
        responses: {
          '200': {
            description: 'Dossier racine SupFile Sync',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        folder: { $ref: '#/components/schemas/Folder' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { description: 'Non authentifié' },
          '403': { description: 'Permission write requise en contexte de délégation' },
        },
      },
    },

    '/sync/tree': {
      get: {
        tags: ['Sync'],
        summary: 'Arborescence récursive du dossier SupFile Sync',
        description: 'Retourne uniquement les dossiers et fichiers non supprimés sous le root sync. Le backend vérifie que le root appartient à l\'utilisateur courant.',
        parameters: [
          { name: 'rootFolderId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Tree distant sous SupFile Sync',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        tree: { $ref: '#/components/schemas/SyncTreeFolder' },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': { description: 'rootFolderId manquant', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '401': { description: 'Non authentifié' },
          '403': { description: 'Permission read requise ou scope invalide' },
          '404': { description: 'Root SupFile Sync introuvable' },
        },
      },
    },

    '/sync/files/upload': {
      post: {
        tags: ['Sync'],
        summary: 'Upload ou remplacement de fichier depuis SupFile Sync Windows',
        description: 'Upload multipart utilisé par le client desktop. Le scope est vérifié par ascendance parentId sous le root `SupFile Sync`; le checksum SHA-256 est vérifié si fourni.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file', 'rootFolderId'],
                properties: {
                  file: { type: 'string', format: 'binary' },
                  rootFolderId: { type: 'string', format: 'uuid' },
                  folderId: { type: 'string', format: 'uuid', description: 'Dossier cible sous le root sync. Par défaut: rootFolderId.' },
                  remoteFileId: { type: 'string', format: 'uuid', description: 'Présent pour remplacer un fichier distant existant.' },
                  baseRemoteUpdatedAt: { type: 'string', format: 'date-time', description: 'updatedAt distant connu au dernier état synchronisé.' },
                  checksum: { type: 'string', pattern: '^[a-f0-9]{64}$', description: 'SHA-256 du contenu local.' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Fichier remplacé',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'object', properties: { file: { $ref: '#/components/schemas/File' } } },
                  },
                },
              },
            },
          },
          '201': {
            description: 'Fichier créé',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'object', properties: { file: { $ref: '#/components/schemas/File' } } },
                  },
                },
              },
            },
          },
          '400': { description: 'Fichier absent, root manquant, checksum invalide ou mismatch' },
          '401': { description: 'Non authentifié' },
          '403': { description: 'DEK verrouillée, permission write manquante ou scope sync invalide' },
          '404': { description: 'Fichier distant ou dossier cible introuvable' },
          '409': {
            description: 'Conflit: le fichier distant a changé depuis baseRemoteUpdatedAt',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SyncConflict' } } },
          },
          '413': { description: 'Fichier trop volumineux' },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // PUSH
    // ═══════════════════════════════════════════════════════════

    '/push/vapid-public-key': {
      get: {
        tags: ['Push'],
        summary: 'Clé publique VAPID pour les notifications Web Push',
        security: [],
        responses: { '200': { description: 'Clé VAPID publique', content: { 'application/json': { schema: { type: 'object', properties: { publicKey: { type: 'string' } } } } } } },
      },
    },

    '/push/subscribe': {
      post: {
        tags: ['Push'],
        summary: 'S\'abonner aux notifications push',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['subscription'], properties: { subscription: { type: 'object', description: 'PushSubscription object du navigateur' } } } } },
        },
        responses: { '201': { description: 'Abonnement enregistré' } },
      },
    },

    '/push/unsubscribe': {
      post: {
        tags: ['Push'],
        summary: 'Se désabonner des notifications push',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['endpoint'], properties: { endpoint: { type: 'string' } } } } },
        },
        responses: { '200': { description: 'Abonnement supprimé' } },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // ONLYOFFICE
    // ═══════════════════════════════════════════════════════════

    '/onlyoffice/config/{fileId}': {
      get: {
        tags: ['OnlyOffice'],
        summary: 'Configuration de l\'éditeur OnlyOffice',
        parameters: [{ name: 'fileId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Config JSON pour initialiser le Document Server' } },
      },
    },

    '/onlyoffice/can-edit/{fileId}': {
      get: {
        tags: ['OnlyOffice'],
        summary: 'Vérifier si un fichier est éditable',
        parameters: [{ name: 'fileId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Résultat', content: { 'application/json': { schema: { type: 'object', properties: { canEdit: { type: 'boolean' } } } } } } },
      },
    },
  },
};
