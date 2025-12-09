export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  quotaUsed: number;
  quotaLimit: number;
  theme: string;
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
  isDeleted: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
  folder?: Folder;
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  userId: string;
  path: string;
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
  createdAt: string;
  url: string;
}

export interface SharedFolder {
  id: string;
  folderId: string;
  sharedById: string;
  sharedWithId: string;
  canEdit: boolean;
  createdAt: string;
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
