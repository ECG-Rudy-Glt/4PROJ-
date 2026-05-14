import prisma from '../config/database';
import logger from '../config/logger';

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
  | 'VERSION_DELETE'
  | 'ADMIN_PLAN_CHANGE'
  | 'ADMIN_ACCOUNT_STATUS_CHANGE'
  | 'PLAN_DOWNGRADE'
  | 'VAULT_SETUP'
  | 'VAULT_UNLOCK'
  | 'VAULT_LOCK'
  | 'VAULT_PASSWORD_ROTATE'
  | 'ORG_CREATE'
  | 'ORG_MEMBER_ADD'
  | 'ORG_MEMBER_ROLE_UPDATE'
  | 'ORG_MEMBER_REMOVE'
  | 'ORG_SWITCH'
  | 'ACCOUNT_SWITCH_LINK_ADDED'
  | 'ACCOUNT_SWITCH_LINK_REVOKED'
  | 'ACCOUNT_SWITCH'
  | 'ACCOUNT_SWITCH_BACK'
  | 'DELEGATION_GRANTED'
  | 'DELEGATION_REVOKED'
  | 'DELEGATION_ASSUME'
  | 'DELEGATION_STOP';

export interface AuditDetails {
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
}

export class AuditService {
  /**
   * Créer une entrée d'audit
   */
  static async createLog(
    userId: string,
    action: AuditAction,
    details?: AuditDetails
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action,
          details: details ? JSON.stringify(details) : null,
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'Erreur création log audit:');
      // Ne pas faire échouer l'opération principale si l'audit échoue
    }
  }

  /**
   * Récupérer les logs d'audit d'un utilisateur
   */
  static async getUserLogs(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      action?: AuditAction;
      dateFrom?: Date;
      dateTo?: Date;
    }
  ) {
    const where: any = { userId };

    if (options?.action) {
      where.action = options.action;
    }

    if (options?.dateFrom || options?.dateTo) {
      where.createdAt = {};
      if (options.dateFrom) {
        where.createdAt.gte = options.dateFrom;
      }
      if (options.dateTo) {
        where.createdAt.lte = options.dateTo;
      }
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs: logs.map(log => ({
        ...log,
        details: log.details ? JSON.parse(log.details) : null,
      })),
      total,
    };
  }

  /**
   * Récupérer les statistiques d'activité
   */
  static async getActivityStats(userId: string, days: number = 7) {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const logs = await prisma.auditLog.findMany({
      where: {
        userId,
        createdAt: {
          gte: dateFrom,
        },
      },
      select: {
        action: true,
        createdAt: true,
      },
    });

    // Grouper par action
    const actionCounts: { [key: string]: number } = {};
    logs.forEach(log => {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    });

    // Grouper par jour
    const dailyActivity: { [key: string]: number } = {};
    logs.forEach(log => {
      const day = log.createdAt.toISOString().split('T')[0];
      dailyActivity[day] = (dailyActivity[day] || 0) + 1;
    });

    return {
      totalActions: logs.length,
      actionCounts,
      dailyActivity,
    };
  }

  /**
   * Supprimer les anciens logs (RGPD / nettoyage)
   */
  static async cleanOldLogs(daysToKeep: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return {
      deleted: result.count,
      message: `${result.count} logs supprimés (plus de ${daysToKeep} jours)`,
    };
  }
}
