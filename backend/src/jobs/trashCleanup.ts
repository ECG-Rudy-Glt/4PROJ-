import cron from 'node-cron';
import prisma from '../config/database';
import fs from 'fs/promises';
import path from 'path';
import { PlanService } from '../services/planService';
import logger from '../config/logger';

// Cron job qui s'exécute tous les jours à 2h du matin
export const startTrashCleanupJob = () => {
  cron.schedule('0 2 * * *', async () => {
    logger.info('️  Démarrage de la purge automatique de la corbeille...');

    try {
      // Date limite : il y a 90 jours
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      // Récupérer tous les fichiers supprimés depuis plus de 90 jours
      const oldDeletedFiles = await prisma.file.findMany({
        where: {
          isDeleted: true,
          deletedAt: {
            lte: ninetyDaysAgo,
          },
        },
        select: {
          id: true,
          name: true,
          storagePath: true,
          thumbnailPath: true,
          size: true,
          userId: true,
        },
      });

      if (oldDeletedFiles.length === 0) {
        logger.info(' Aucun fichier à purger');
        return;
      }

      logger.info(` ${oldDeletedFiles.length} fichier(s) à purger`);

      let purgedCount = 0;
      let errorCount = 0;

      for (const file of oldDeletedFiles) {
        try {
          // Supprimer le fichier physique
          try {
            await fs.unlink(file.storagePath);
            logger.info(`   Fichier supprimé : ${file.name}`);
          } catch (err) {
            console.warn(`  ️  Impossible de supprimer le fichier physique : ${file.name}`, err);
          }

          // Supprimer la miniature si elle existe
          if (file.thumbnailPath) {
            try {
              await fs.unlink(file.thumbnailPath);
            } catch (err) {
              // Ignorer les erreurs de suppression de miniature
            }
          }

          await prisma.file.delete({
            where: { id: file.id },
          });

          await PlanService.updateQuotaUsed(file.userId, -Number(file.size));

          purgedCount++;
        } catch (error) {
          logger.error(`   Erreur lors de la purge de ${file.name}:`, error);
          errorCount++;
        }
      }

      logger.info(` Purge terminée : ${purgedCount} fichier(s) purgé(s), ${errorCount} erreur(s)`);
    } catch (error) {
      logger.error(' Erreur lors de la purge automatique:', error);
    }
  });

  logger.info(' Job de purge automatique démarré (tous les jours à 2h)');
};
