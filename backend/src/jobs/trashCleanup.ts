import cron from 'node-cron';
import prisma from '../config/database';
import fs from 'fs/promises';
import { PlanService } from '../services/planService';
import logger from '../config/logger';

export const startTrashCleanupJob = () => {
  cron.schedule('0 2 * * *', async () => {
    logger.info('Démarrage de la purge automatique de la corbeille...');

    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

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
        logger.info('Aucun fichier à purger');
        return;
      }

      logger.info(`${oldDeletedFiles.length} fichier(s) à purger`);

      let purgedCount = 0;
      let errorCount = 0;

      for (const file of oldDeletedFiles) {
        try {
          try {
            await fs.unlink(file.storagePath);
            logger.info(`Fichier supprimé : ${file.name}`);
          } catch (err) {
            console.warn(`Impossible de supprimer le fichier physique : ${file.name}`, err);
          }

          if (file.thumbnailPath) {
            try {
              await fs.unlink(file.thumbnailPath);
            } catch {
              // thumbnail deletion is best-effort
            }
          }

          await prisma.file.delete({
            where: { id: file.id },
          });

          await PlanService.updateQuotaUsed(file.userId, -file.size);

          purgedCount++;
        } catch (error) {
          logger.error(`Erreur lors de la purge de ${file.name}: ${error}`);
          errorCount++;
        }
      }

      logger.info(`Purge terminée : ${purgedCount} fichier(s) purgé(s), ${errorCount} erreur(s)`);

      const oldDeletedFolders = await prisma.folder.findMany({
        where: {
          isDeleted: true,
          deletedAt: {
            lte: ninetyDaysAgo,
          },
        },
      });

      if (oldDeletedFolders.length > 0) {
        logger.info(`${oldDeletedFolders.length} dossier(s) à purger`);
        for (const folder of oldDeletedFolders) {
          try {
            const filesInFolder = await prisma.file.findMany({
              where: {
                OR: [
                  { folderId: folder.id },
                  { folder: { path: { startsWith: `${folder.path}/` } } }
                ]
              },
              select: {
                id: true,
                name: true,
                storagePath: true,
                thumbnailPath: true,
                size: true,
                userId: true,
              }
            });

            for (const file of filesInFolder) {
              try {
                await fs.unlink(file.storagePath);
                if (file.thumbnailPath) await fs.unlink(file.thumbnailPath).catch(() => {});
                await PlanService.updateQuotaUsed(file.userId, -file.size);
                // File->Folder is onDelete: SetNull in the schema, so files must be deleted manually.
                await prisma.file.delete({ where: { id: file.id } });
              } catch (err) {
                logger.error(`Erreur purge fichier ${file.id} dans dossier ${folder.id}: ${err}`);
              }
            }

            await prisma.folder.delete({
              where: { id: folder.id },
            });
            logger.info(`Dossier et contenu purgés : ${folder.name}`);
          } catch (err) {
            logger.error(`Erreur lors de la purge du dossier ${folder.id}: ${err}`);
          }
        }
      }
    } catch (error) {
      logger.error(`Erreur lors de la purge automatique: ${error}`);
    }
  });

  logger.info('Job de purge automatique démarré (tous les jours à 2h)');
};
