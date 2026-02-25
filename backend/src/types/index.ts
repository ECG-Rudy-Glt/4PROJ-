import { Request } from 'express';
import { User } from '@prisma/client';

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
    expiresAt: Date | null;
  };
}

export interface AuthRequest extends Request {
  user?: User;
  authContext?: AuthSessionContext;
}

export interface FileUploadRequest extends AuthRequest {
  file?: any;
  files?: any;
}

export interface JWTPayload {
  userId: string;
  email: string;
  tokenVersion?: number;
  switchRootUserId?: string;
  switchSessionId?: string;
  delegatedByUserId?: string;
  delegationId?: string;
}

export interface OAuth2Profile {
  id: string;
  emails?: Array<{ value: string }>;
  displayName?: string;
  name?: {
    givenName?: string;
    familyName?: string;
  };
  photos?: Array<{ value: string }>;
}

export interface FileStats {
  totalFiles: number;
  totalSize: number;
  byMimeType: {
    [key: string]: {
      count: number;
      size: number;
    };
  };
}

export interface DashboardData {
  quotaUsed: number;
  quotaLimit: number;
  fileStats: FileStats;
  recentFiles: any[];
}
