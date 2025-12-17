import api from './api';

export type AuditAction =
  | 'UPLOAD'
  | 'DELETE'
  | 'RESTORE'
  | 'DOWNLOAD'
  | 'SHARE'
  | 'UNSHARE'
  | 'CREATE_FOLDER'
  | 'DELETE_FOLDER'
  | 'MOVE_FILE'
  | 'RENAME_FILE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'PASSWORD_CHANGE'
  | 'PROFILE_UPDATE'
  | 'TAG_ADD'
  | 'TAG_REMOVE'
  | 'COMMENT_ADD'
  | 'COMMENT_DELETE'
  | 'VERSION_RESTORE'
  | 'VERSION_DELETE';

export interface AuditLog {
  id: string;
  userId: string;
  action: AuditAction;
  details: {
    fileName?: string;
    fileId?: string;
    folderId?: string;
    folderName?: string;
    shareToken?: string;
    ipAddress?: string;
    userAgent?: string;
    tagName?: string;
    versionNumber?: number;
    [key: string]: any;
  } | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

export interface ActivityStats {
  totalActions: number;
  actionCounts: { [key: string]: number };
  dailyActivity: { [key: string]: number };
}

export const auditService = {
  /**
   * Récupérer les logs d'audit
   */
  async getUserLogs(options?: {
    limit?: number;
    offset?: number;
    action?: AuditAction;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.action) params.append('action', options.action);
    if (options?.dateFrom) params.append('dateFrom', options.dateFrom);
    if (options?.dateTo) params.append('dateTo', options.dateTo);

    const { data } = await api.get(`/audit/logs?${params.toString()}`);
    return data as { logs: AuditLog[]; total: number };
  },

  /**
   * Récupérer les statistiques d'activité
   */
  async getActivityStats(days: number = 7) {
    const { data } = await api.get(`/audit/stats?days=${days}`);
    return data as ActivityStats;
  },
};
