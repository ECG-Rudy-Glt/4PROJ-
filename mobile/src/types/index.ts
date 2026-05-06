// ── Enums ───────────────────────────────────────────────

export type Role = 'USER' | 'ADMIN';
export type AccountStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type Plan = 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE' | 'TRIALING';
export type NotificationType = 'SHARE' | 'COMMENT' | 'QUOTA';
export type FileCategory = 'image' | 'video' | 'doc' | 'audio' | 'other';

// ── User ────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  role?: Role;
  accountStatus?: AccountStatus;
  quotaUsed: number;
  quotaLimit: number;
  theme: string;
  plan?: Plan;
  subscriptionStatus?: SubscriptionStatus;
  vaultEnabled?: boolean;
  mfaEnabled?: boolean;
  currentOrganizationId?: string | null;
  createdAt: string;
}

// ── Auth ────────────────────────────────────────────────

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

export interface LoginPayload {
  email: string;
  password: string;
  deviceFingerprint?: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface MfaVerifyPayload {
  tempToken: string;
  code: string;
  trustDevice?: boolean;
  deviceFingerprint?: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
  authContext?: AuthSessionContext;
}

export interface MfaRequiredResponse {
  mfaRequired: true;
  tempToken: string;
  userId: string;
  mfaSetupRequired?: boolean;
  qrCode?: string;
  secret?: string;
}

// ── File ────────────────────────────────────────────────

export interface FileItem {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  thumbnailPath?: string;
  category?: FileCategory;
  folderId?: string;
  userId: string;
  isVault?: boolean;
  isDeleted: boolean;
  deletedAt?: string;
  isFavorite: boolean;
  views?: number;
  downloads?: number;
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

// ── Folder ──────────────────────────────────────────────

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  userId: string;
  path: string;
  isVault?: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
  parent?: Folder;
  children?: Folder[];
  files?: FileItem[];
}

export interface Breadcrumb {
  id: string;
  name: string;
}

// ── Tags ────────────────────────────────────────────────

export interface Tag {
  id: string;
  name: string;
  color: string;
  userId: string;
  createdAt: string;
  _count?: { files: number };
}

export interface FileTag {
  id: string;
  fileId: string;
  tagId: string;
  tag: Tag;
  createdAt: string;
}

// ── Sharing ─────────────────────────────────────────────

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
  accepted: boolean;
  createdAt: string;
  folder?: Folder;
  sharedBy?: UserSummary;
  sharedWith?: UserSummary & { avatar?: string };
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
  accepted: boolean;
  createdAt: string;
  file?: FileItem;
  sharedBy?: UserSummary;
  sharedWith?: UserSummary & { avatar?: string };
}

export interface UserSummary {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

// ── Dashboard ───────────────────────────────────────────

export interface FileStats {
  totalFiles: number;
  totalSize: number;
  byMimeType: Record<string, { count: number; size: number }>;
}

export interface DashboardData {
  quotaUsed: number;
  quotaLimit: number;
  fileStats: FileStats;
  recentFiles: Array<{
    id: string;
    name: string;
    mimeType: string;
    size: number;
    updatedAt: string;
    folder?: { id: string; name: string };
  }>;
}

// ── Notifications ───────────────────────────────────────

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  data?: Record<string, unknown>;
  createdAt: string;
}

// ── Audit ───────────────────────────────────────────────

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  details?: string;
  createdAt: string;
}

// ── File Versions ───────────────────────────────────────

export interface FileVersion {
  id: string;
  fileId: string;
  versionNumber: number;
  name: string;
  size: number;
  storagePath: string;
  mimeType: string;
  createdAt: string;
  createdBy: UserSummary;
}

// ── Comments ────────────────────────────────────────────

export interface Comment {
  id: string;
  content: string;
  fileId: string;
  userId: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  user?: UserSummary & { avatar?: string };
  replies?: Comment[];
}

// ── Navigation ──────────────────────────────────────────

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  MfaVerify: { tempToken: string; userId: string; mfaSetupRequired?: boolean; qrCode?: string; secret?: string };
  Main: undefined;
  Trash: undefined;
  Admin: undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  Files: { folderId?: string } | undefined;
  Favorites: undefined;
  Shared: undefined;
  Settings: undefined;
};
