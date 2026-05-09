import api from './api';

export interface AuditLogDetails {
  fileName?: string;
  fileId?: string;
  folderId?: string;
  folderName?: string;
  ipAddress?: string;
  userAgent?: string;
  tagName?: string;
  versionNumber?: number;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  details: AuditLogDetails | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

export const auditService = {
  async getUserLogs(options?: { limit?: number; offset?: number; action?: string }) {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));
    if (options?.action) params.append('action', options.action);
    const { data } = await api.get(`/audit/logs?${params.toString()}`);
    return data as { logs: AuditLog[]; total: number };
  },
};
