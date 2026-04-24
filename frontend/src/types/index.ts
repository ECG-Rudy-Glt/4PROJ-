export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  role?: 'USER' | 'ADMIN';
  accountStatus?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  quotaUsed: number;
  quotaLimit: number;
  theme: string;
  plan?: 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
  subscriptionStatus?: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE' | 'TRIALING';
  vaultEnabled?: boolean;
  currentOrganizationId?: string | null;
  createdAt: string;
}

export type AuthResponse = 
  | { 
      user: User; 
      token: string; 
      mfaRequired?: false;
      mfaSetupRequired?: false;
      session?: AuthSessionContext;
    }
  | { 
      mfaSetupRequired: true; 
      tempToken: string; 
      userId: string;
      user: { email: string; firstName?: string; lastName?: string };
    }
  | {
      mfaRequired: true;
      tempToken: string;
      userId: string;
    };


export interface AuthSessionContext {
  authType: 'DIRECT' | 'SWITCH' | 'DELEGATION';
  rootUserId: string;
  actorUserId: string;
  delegation?: {
    id: string;
    canRead: boolean;
    canWrite: boolean;
    canDelete: boolean;
    canShare: boolean;
    expiresAt: string | null;
  } | null;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  userId: string;
  createdAt: string;
  _count?: {
    files: number;
  };
}

export interface FileTag {
  id: string;
  fileId: string;
  tagId: string;
  tag: Tag;
  createdAt: string;
}

export interface File {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  thumbnailPath?: string;
  category?: string; // 'image', 'video', 'doc', 'audio', 'other'
  folderId?: string;
  userId: string;
  isVault?: boolean;
  isDeleted: boolean;
  deletedAt?: string;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  folder?: Folder;
  tags?: FileTag[];
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  userId: string;
  path: string;
  isVault?: boolean;
  isDeleted: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
  parent?: Folder;
  children?: Folder[];
  files?: File[];
}

export interface SharedLink {
  id: string;
  token: string;
  fileId?: string;
  folderId?: string;
  fileName?: string;
  expiresAt?: string;
  maxDownloads?: number;
  downloads: number;
  password?: string;
  createdAt: string;
  url: string;
}

export interface SharedFolder {
  id: string;
  folderId: string;
  sharedById: string;
  sharedWithId: string;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canShare: boolean;
  createdAt: string;
  folder?: Folder;
  sharedBy?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  sharedWith?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
  };
}

export interface SharedFile {
  id: string;
  fileId: string;
  sharedById: string;
  sharedWithId: string;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canShare: boolean;
  createdAt: string;
  file?: File;
  sharedBy?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  sharedWith?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
  };
}

export interface DashboardData {
  quotaUsed: number;
  quotaLimit: number;
  fileStats: {
    totalFiles: number;
    totalSize: number;
    byMimeType: {
      [key: string]: {
        count: number;
        size: number;
      };
    };
  };
  recentFiles: Array<{
    id: string;
    name: string;
    mimeType: string;
    size: number;
    updatedAt: string;
    folder?: {
      id: string;
      name: string;
    };
  }>;
}

export interface Breadcrumb {
  id: string;
  name: string;
}

export interface RefreshToken {
  id: string;
  token: string;
  userId: string;
  expiresAt: string;
  revoked: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string; // 'UPLOAD', 'DELETE', 'LOGIN', 'DOWNLOAD', 'SHARE', 'CREATE_FOLDER'
  details?: string;
  createdAt: string;
}

export interface AdminOverview {
  kpis: {
    totalUsers: number;
    totalAdmins: number;
    totalFiles: number;
    totalDeletedFiles: number;
    totalFolders: number;
    totalSharedFiles: number;
    totalSharedFolders: number;
    totalStorageUsed: number;
    totalQuotaUsed: number;
    totalQuotaLimit: number;
    storageUsagePercent: number;
    activeUsers24h: number;
    newUsers30d: number;
    uploads24h: number;
  };
  distribution: {
    plans: Array<{
      plan: 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
      count: number;
    }>;
    subscriptionStatus: Array<{
      status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE' | 'TRIALING';
      count: number;
    }>;
  };
  topStorageUsers: Array<{
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: 'USER' | 'ADMIN';
    plan: 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
    quotaUsed: number;
    quotaLimit: number;
  }>;
}

export interface AdminUserRow {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'USER' | 'ADMIN';
  plan: 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
  subscriptionStatus: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE' | 'TRIALING';
  quotaUsed: number;
  quotaLimit: number;
  createdAt: string;
  lastActiveAt: string;
  _count: {
    files: number;
    folders: number;
  };
}

export interface OrganizationMembership {
  id: string;
  organizationId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  organization: {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface OrganizationMemberRow {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    lastActiveAt: string;
    createdAt: string;
  };
}
