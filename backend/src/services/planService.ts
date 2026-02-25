import { Plan, User } from '@prisma/client';
import prisma from '../config/database';

const GB = BigInt(1024 * 1024 * 1024);
const MB = BigInt(1024 * 1024);

export const PLAN_LIMITS = {
    [Plan.FREE]: {
        storage: BigInt(30) * GB, // 30 GB
        maxFileSize: BigInt(30) * GB, // 30 GB per file
        maxShares: 5,
        maxVersions: 3,
        maxTags: 10,
        features: {
            mfa: true,
            prioritySupport: false,
            auditLogs: false,
            aiChat: false,
        },
    },
    [Plan.PRO]: {
        storage: BigInt(200) * GB, // 200 GB
        maxFileSize: BigInt(500) * MB, // 500 MB per file
        maxShares: 50,
        maxVersions: 10,
        maxTags: 50,
        features: {
            mfa: true,
            prioritySupport: true,
            auditLogs: true,
            aiChat: true,
        },
    },
    [Plan.BUSINESS]: {
        storage: BigInt(2048) * GB, // 2 TB
        maxFileSize: BigInt(2048) * MB, // 2 GB per file
        maxShares: 200,
        maxVersions: 25,
        maxTags: 200,
        features: {
            mfa: true,
            prioritySupport: true,
            auditLogs: true,
            aiChat: true,
        },
    },
    [Plan.ENTERPRISE]: {
        storage: BigInt(1024 * 1024) * GB, // ~Unlimited (1 PB)
        maxFileSize: BigInt(10240) * MB, // 10 GB per file
        maxShares: -1, // unlimited
        maxVersions: -1, // unlimited
        maxTags: -1, // unlimited
        features: {
            mfa: true,
            prioritySupport: true,
            auditLogs: true,
            aiChat: true,
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

    /**
     * Vérifie si la taille du fichier ne dépasse pas la limite du plan
     */
    static async checkFileSize(userId: string, fileSize: number | bigint): Promise<boolean> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { plan: true },
        });
        if (!user) throw new Error('Utilisateur non trouvé');

        const limits = PLAN_LIMITS[user.plan] || PLAN_LIMITS[Plan.FREE];
        return BigInt(fileSize) <= limits.maxFileSize;
    }

    /**
     * Vérifie si l'utilisateur n'a pas dépassé une limite de son plan
     * @param limitName - 'maxShares' | 'maxVersions' | 'maxTags'
     * @param currentCount - nombre actuel
     */
    static async checkLimit(userId: string, limitName: 'maxShares' | 'maxVersions' | 'maxTags', currentCount: number): Promise<boolean> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { plan: true },
        });
        if (!user) throw new Error('Utilisateur non trouvé');

        const limits = PLAN_LIMITS[user.plan] || PLAN_LIMITS[Plan.FREE];
        const max = limits[limitName];
        if (max === -1) return true; // unlimited
        return currentCount < max;
    }

    /**
     * Vérifie si une fonctionnalité est disponible pour le plan de l'utilisateur
     */
    static async checkFeature(userId: string, feature: string): Promise<boolean> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { plan: true },
        });
        if (!user) throw new Error('Utilisateur non trouvé');

        const limits = PLAN_LIMITS[user.plan] || PLAN_LIMITS[Plan.FREE];
        return (limits.features as any)[feature] === true;
    }

    /**
     * Retourne les limites complètes du plan de l'utilisateur
     */
    static async getPlanLimits(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { plan: true },
        });
        if (!user) throw new Error('Utilisateur non trouvé');
        return { plan: user.plan, ...PLAN_LIMITS[user.plan] };
    }
}
