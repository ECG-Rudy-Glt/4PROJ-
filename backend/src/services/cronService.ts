import cron from 'node-cron';
import prisma from '../config/database';
import { MailService } from './mailService';
import { startTrashCleanupJob } from '../jobs/trashCleanup';
import logger from '../config/logger';

export class CronService {
    static init() {
        logger.info(' Initialisation du service Cron...');

        // Démarrer le job de nettoyage de la corbeille existant
        startTrashCleanupJob();

        // Démarrer le job de vérification des expirations
        this.startExpirationCheckJob();

        logger.info(' Service Cron démarré');
    }

    /**
     * Vérifie tous les jours à 9h du matin les expirations à venir (J-7 et J-1)
     */
    static startExpirationCheckJob() {
        // Run at 9:00 AM every day
        cron.schedule('0 9 * * *', async () => {
            logger.info(' Démarrage de la vérification des expirations...');

            try {
                await this.checkSharedLinkExpirations();
            } catch (error) {
                logger.error({ err: error }, ' Erreur lors de la vérification des expirations:');
            }
        });

        // Run immediately in dev for testing purposes (commented out for production)
        if (process.env.NODE_ENV === 'development') {
            // setTimeout(() => this.checkSharedLinkExpirations(), 5000); 
        }
    }

    static async checkSharedLinkExpirations() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);

        // Définir les plages de recherche (pour éviter de spammer, on cherche ceux qui expirent ce jour précis)
        const tomorrowStart = new Date(tomorrow.setHours(0, 0, 0, 0));
        const tomorrowEnd = new Date(tomorrow.setHours(23, 59, 59, 999));

        const nextWeekStart = new Date(nextWeek.setHours(0, 0, 0, 0));
        const nextWeekEnd = new Date(nextWeek.setHours(23, 59, 59, 999));

        // 1. Alertes J-1
        const linksExpiringTomorrow = await prisma.sharedLink.findMany({
            where: {
                expiresAt: {
                    gte: tomorrowStart,
                    lte: tomorrowEnd,
                },
            },
            include: {
                user: true,
                file: true,
                folder: true,
            },
        });

        for (const link of linksExpiringTomorrow) {
            const itemName = link.file?.name || link.folder?.name || 'Élément partagé';
            await MailService.sendExpirationAlert(
                link.user.email,
                link.user.firstName || 'Utilisateur',
                itemName,
                1,
                `${process.env.FRONTEND_URL || 'http://localhost:3000'}/share/${link.token}`
            );
        }

        // 2. Alertes J-7
        const linksExpiringNextWeek = await prisma.sharedLink.findMany({
            where: {
                expiresAt: {
                    gte: nextWeekStart,
                    lte: nextWeekEnd,
                },
            },
            include: {
                user: true,
                file: true,
                folder: true,
            },
        });

        for (const link of linksExpiringNextWeek) {
            const itemName = link.file?.name || link.folder?.name || 'Élément partagé';
            await MailService.sendExpirationAlert(
                link.user.email,
                link.user.firstName || 'Utilisateur',
                itemName,
                7,
                `${process.env.FRONTEND_URL || 'http://localhost:3000'}/share/${link.token}`
            );
        }

        logger.info(` Vérification expirations terminée. J-1: ${linksExpiringTomorrow.length}, J-7: ${linksExpiringNextWeek.length}`);
    }
}
