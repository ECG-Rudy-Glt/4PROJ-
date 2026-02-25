import { Plan, Role } from '@prisma/client';
import prisma from '../config/database';
import { PlanService } from './planService';
import { AuditService } from './auditService';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

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
        ...user,
        quotaUsed: Number(user.quotaUsed),
        quotaLimit: Number(user.quotaLimit),
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
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        plan: true,
        subscriptionStatus: true,
        quotaUsed: true,
        quotaLimit: true,
        createdAt: true,
        lastActiveAt: true,
      },
    });

    await PlanService.syncUserQuotaLimit(targetUserId);

    await AuditService.createLog(adminUserId, 'ADMIN_PLAN_CHANGE', {
      targetUserId,
      previousPlan: existingUser.plan,
      newPlan: plan,
    });

    const refreshedUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        plan: true,
        subscriptionStatus: true,
        quotaUsed: true,
        quotaLimit: true,
        createdAt: true,
        lastActiveAt: true,
      },
    });

    return {
      ...(refreshedUser || updatedUser),
      quotaUsed: Number((refreshedUser || updatedUser).quotaUsed),
      quotaLimit: Number((refreshedUser || updatedUser).quotaLimit),
    };
  }
}
