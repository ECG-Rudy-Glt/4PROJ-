import { Plan, Role } from '@prisma/client';
import prisma from '../config/database';
import { PlanService } from './planService';
import { AuditService } from './auditService';
import { MailService } from './mailService';
import { NotificationService } from './notificationService';
import logger from '../config/logger';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
type AdminAccountStatus = 'ACTIVE' | 'SUSPENDED';

const adminUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  accountStatus: true,
  plan: true,
  subscriptionStatus: true,
  quotaUsed: true,
  quotaLimit: true,
  createdAt: true,
  lastActiveAt: true,
};

const displayName = (user: { email: string; firstName?: string | null; lastName?: string | null }) => {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fullName || user.email;
};

const mapAdminUser = <T extends { quotaUsed: bigint; quotaLimit: bigint }>(user: T) => ({
  ...user,
  quotaUsed: Number(user.quotaUsed),
  quotaLimit: Number(user.quotaLimit),
});

export class AdminService {
  static async getOverview() {
    const now = Date.now();
    const dayAgo = new Date(now - DAY_IN_MS);
    const monthAgo = new Date(now - 30 * DAY_IN_MS);

    const [
      totalUsers,
      totalAdmins,
      totalFiles,
      totalDeletedFiles,
      totalFolders,
      totalSharedFiles,
      totalSharedFolders,
      activeUsers24h,
      newUsers30d,
      uploads24h,
      storageAggregate,
      usersQuotaAggregate,
      byPlan,
      bySubscriptionStatus,
      topStorageUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: Role.ADMIN } }),
      prisma.file.count({ where: { isDeleted: false } }),
      prisma.file.count({ where: { isDeleted: true } }),
      prisma.folder.count(),
      prisma.sharedFile.count({ where: { accepted: true } }),
      prisma.sharedFolder.count({ where: { accepted: true } }),
      prisma.user.count({ where: { lastActiveAt: { gte: dayAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
      prisma.file.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.file.aggregate({
        where: { isDeleted: false },
        _sum: { size: true },
      }),
      prisma.user.aggregate({
        _sum: {
          quotaUsed: true,
          quotaLimit: true,
        },
      }),
      prisma.user.groupBy({
        by: ['plan'],
        _count: { _all: true },
      }),
      prisma.user.groupBy({
        by: ['subscriptionStatus'],
        _count: { _all: true },
      }),
      prisma.user.findMany({
        orderBy: { quotaUsed: 'desc' },
        take: 5,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          plan: true,
          quotaUsed: true,
          quotaLimit: true,
          role: true,
        },
      }),
    ]);

    const totalStorageUsed = Number(storageAggregate._sum.size || 0);
    const totalQuotaUsed = Number(usersQuotaAggregate._sum.quotaUsed || 0);
    const totalQuotaLimit = Number(usersQuotaAggregate._sum.quotaLimit || 0);

    return {
      kpis: {
        totalUsers,
        totalAdmins,
        totalFiles,
        totalDeletedFiles,
        totalFolders,
        totalSharedFiles,
        totalSharedFolders,
        totalStorageUsed,
        totalQuotaUsed,
        totalQuotaLimit,
        storageUsagePercent: totalQuotaLimit > 0 ? (totalQuotaUsed / totalQuotaLimit) * 100 : 0,
        activeUsers24h,
        newUsers30d,
        uploads24h,
      },
      distribution: {
        plans: byPlan.map((entry) => ({
          plan: entry.plan,
          count: entry._count._all,
        })),
        subscriptionStatus: bySubscriptionStatus.map((entry) => ({
          status: entry.subscriptionStatus,
          count: entry._count._all,
        })),
      },
      topStorageUsers: topStorageUsers.map((user) => ({
        ...user,
        quotaUsed: Number(user.quotaUsed),
        quotaLimit: Number(user.quotaLimit),
      })),
    };
  }

  static async listUsers(options?: {
    page?: number;
    limit?: number;
    search?: string;
    plan?: Plan;
  }) {
    const page = options?.page && options.page > 0 ? options.page : 1;
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (options?.search) {
      where.OR = [
        { email: { contains: options.search, mode: 'insensitive' } },
        { firstName: { contains: options.search, mode: 'insensitive' } },
        { lastName: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    if (options?.plan) {
      where.plan = options.plan;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          accountStatus: true,
          plan: true,
          subscriptionStatus: true,
          quotaUsed: true,
          quotaLimit: true,
          createdAt: true,
          lastActiveAt: true,
          _count: {
            select: {
              files: true,
              folders: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map((user) => ({
        ...mapAdminUser(user),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  static async updateUserPlan(adminUserId: string, targetUserId: string, plan: Plan) {
    const existingUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, plan: true },
    });

    if (!existingUser) {
      throw new Error('User not found');
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: { plan },
      select: adminUserSelect,
    });

    await PlanService.syncUserQuotaLimit(targetUserId);

    await AuditService.createLog(adminUserId, 'ADMIN_PLAN_CHANGE', {
      targetUserId,
      previousPlan: existingUser.plan,
      newPlan: plan,
    });

    const refreshedUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: adminUserSelect,
    });

    return mapAdminUser(refreshedUser || updatedUser);
  }

  static async updateUserStatus(
    adminUserId: string,
    targetUserId: string,
    status: AdminAccountStatus,
    reason?: string
  ) {
    if (adminUserId === targetUserId && status === 'SUSPENDED') {
      throw Object.assign(new Error('Un administrateur ne peut pas suspendre son propre compte'), { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        accountStatus: true,
        language: true,
      },
    });

    if (!existingUser) {
      throw Object.assign(new Error('User not found'), { status: 404 });
    }

    const shouldRevokeSessions = status === 'SUSPENDED' && existingUser.accountStatus !== 'SUSPENDED';
    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        accountStatus: status,
        ...(shouldRevokeSessions ? { tokenVersion: { increment: 1 } } : {}),
      },
      select: adminUserSelect,
    });

    if (status === 'SUSPENDED') {
      await prisma.refreshToken.updateMany({
        where: { userId: targetUserId, revoked: false },
        data: { revoked: true },
      });
    }

    await AuditService.createLog(adminUserId, 'ADMIN_ACCOUNT_STATUS_CHANGE', {
      targetUserId,
      previousStatus: existingUser.accountStatus,
      newStatus: status,
      reason: reason || null,
      revokedSessions: status === 'SUSPENDED',
    });

    const isSuspended = status === 'SUSPENDED';
    const title = isSuspended ? 'Compte suspendu' : 'Compte réactivé';
    const message = isSuspended
      ? 'Votre compte SupFile a été suspendu par un administrateur.'
      : 'Votre compte SupFile a été réactivé par un administrateur.';

    NotificationService.create(targetUserId, 'SHARE', title, message, {
      status,
      reason: reason || null,
    }).catch((error) => logger.error({ err: error }, 'Failed to create account status notification'));

    try {
      await MailService.sendAccountStatusNotification(
        existingUser.email,
        displayName(existingUser),
        status,
        reason,
        existingUser.language
      );
    } catch (error) {
      logger.error({ err: error }, 'Failed to send account status email');
    }

    return mapAdminUser(updatedUser);
  }

  static async getUsersExportRows() {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        accountStatus: true,
        plan: true,
        subscriptionStatus: true,
        quotaUsed: true,
        quotaLimit: true,
        vaultEnabled: true,
        currentOrganizationId: true,
        createdAt: true,
        lastActiveAt: true,
        _count: {
          select: {
            files: true,
            folders: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      role: user.role,
      accountStatus: user.accountStatus,
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      quotaUsed: Number(user.quotaUsed),
      quotaLimit: Number(user.quotaLimit),
      vaultEnabled: user.vaultEnabled ? 'yes' : 'no',
      currentOrganizationId: user.currentOrganizationId || '',
      filesCount: user._count.files,
      foldersCount: user._count.folders,
      createdAt: user.createdAt.toISOString(),
      lastActiveAt: user.lastActiveAt.toISOString(),
    }));
  }

  static async getStorageExportRows() {
    const files = await prisma.file.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        name: true,
        mimeType: true,
        size: true,
        isVault: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        folder: {
          select: {
            id: true,
            name: true,
            path: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return files.map((file) => ({
      fileId: file.id,
      fileName: file.name,
      mimeType: file.mimeType,
      sizeBytes: Number(file.size),
      ownerId: file.user.id,
      ownerEmail: file.user.email,
      folderId: file.folder?.id || '',
      folderName: file.folder?.name || '',
      folderPath: file.folder?.path || '',
      isVault: file.isVault ? 'yes' : 'no',
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
    }));
  }
}
