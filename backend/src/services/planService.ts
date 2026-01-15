import { Plan, User } from '@prisma/client';
import prisma from '../config/database';

export const PLAN_LIMITS = {
    [Plan.FREE]: {
        storage: BigInt(10) * BigInt(1024 * 1024 * 1024), // 10 GB
        features: {
            mfa: true,
            prioritySupport: false,
            auditLogs: false,
        },
    },
    [Plan.PRO]: {
        storage: BigInt(200) * BigInt(1024 * 1024 * 1024), // 200 GB
        features: {
            mfa: true,
            prioritySupport: true,
            auditLogs: true,
        },
    },
    [Plan.BUSINESS]: {
        storage: BigInt(2048) * BigInt(1024 * 1024 * 1024), // 2 TB
        features: {
            mfa: true,
            prioritySupport: true,
            auditLogs: true,
        },
    },
    [Plan.ENTERPRISE]: {
        storage: BigInt(1024 * 1024) * BigInt(1024 * 1024 * 1024), // ~Unlimited (1 PB)
        features: {
            mfa: true,
            prioritySupport: true,
            auditLogs: true,
        },
    },
};

export class PlanService {
    /**
     * Retourne la limite de stockage pour un plan donné
     */
    static getStorageLimit(plan: Plan): bigint {
        return PLAN_LIMITS[plan]?.storage || PLAN_LIMITS[Plan.FREE].storage;
    }

    /**
     * Vérifie si l'utilisateur a assez d'espace pour un nouveau fichier
     */
    static async checkQuota(userId: string, incomingFileSize: number | bigint): Promise<boolean> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { quotaUsed: true, quotaLimit: true },
        });

        if (!user) throw new Error('Utilisateur non trouvé');

        const used = BigInt(user.quotaUsed);
        const limit = BigInt(user.quotaLimit);
        const incoming = BigInt(incomingFileSize);

        return used + incoming <= limit;
    }

    /**
     * Met à jour le quota (utilisé) de l'utilisateur
     */
    static async updateQuotaUsed(userId: string, sizeChange: number | bigint): Promise<void> {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return;

        const currentUsed = BigInt(user.quotaUsed);
        const change = BigInt(sizeChange);
        let newUsed = currentUsed + change;

        if (newUsed < 0) newUsed = BigInt(0);

        await prisma.user.update({
            where: { id: userId },
            data: { quotaUsed: newUsed },
        });
    }

    /**
     * Force la mise à jour de la limite de quota d'un utilisateur selon son plan
     * (Utile lors d'un upgrade ou d'une maintenance)
     */
    static async syncUserQuotaLimit(userId: string): Promise<void> {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return;

        const limit = this.getStorageLimit(user.plan);

        if (limit !== user.quotaLimit) {
            await prisma.user.update({
                where: { id: userId },
                data: { quotaLimit: limit },
            });
        }
    }
}
