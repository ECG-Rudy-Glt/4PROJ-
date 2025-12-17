import cron from 'node-cron';
import prisma from '../config/database';
import fs from 'fs/promises';
import path from 'path';

// Cron job qui s'exécute tous les jours à 2h du matin
export const startTrashCleanupJob = () => {
  cron.schedule('0 2 * * *', async () => {
    console.log('🗑️  Démarrage de la purge automatique de la corbeille...');

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
        console.log('✅ Aucun fichier à purger');
        return;
      }

      console.log(`📋 ${oldDeletedFiles.length} fichier(s) à purger`);

      let purgedCount = 0;
      let errorCount = 0;

      for (const file of oldDeletedFiles) {
        try {
          // Supprimer le fichier physique
          try {
            await fs.unlink(file.storagePath);
            console.log(`  ✓ Fichier supprimé : ${file.name}`);
          } catch (err) {
            console.warn(`  ⚠️  Impossible de supprimer le fichier physique : ${file.name}`, err);
          }

          // Supprimer la miniature si elle existe
          if (file.thumbnailPath) {
            try {
              await fs.unlink(file.thumbnailPath);
            } catch (err) {
              // Ignorer les erreurs de suppression de miniature
            }
          }

          // Supprimer l'enregistrement en base de données
          await prisma.file.delete({
            where: { id: file.id },
          });

          // Décrémenter le quota de l'utilisateur
          await prisma.user.update({
            where: { id: file.userId },
            data: {
              quotaUsed: {
                decrement: file.size,
              },
            },
          });

          purgedCount++;
        } catch (error) {
          console.error(`  ✗ Erreur lors de la purge de ${file.name}:`, error);
          errorCount++;
        }
      }

      console.log(`✅ Purge terminée : ${purgedCount} fichier(s) purgé(s), ${errorCount} erreur(s)`);
    } catch (error) {
      console.error('❌ Erreur lors de la purge automatique:', error);
    }
  });

  console.log('✅ Job de purge automatique démarré (tous les jours à 2h)');
};
