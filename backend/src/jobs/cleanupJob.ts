import cron from 'node-cron';
import { AuditService } from '../services/auditService';
import { VersionService } from '../services/versionService';
import logger from '../config/logger';

/**
 * Job de nettoyage automatique
 * S'exécute tous les jours à 2h du matin
 */
export function startCleanupJob() {
  // Nettoyer les logs d'audit tous les jours à 2h00
  cron.schedule('0 2 * * *', async () => {
    logger.info(' Démarrage du job de nettoyage des logs d\'audit...');

    try {
      // Conserver les logs des 90 derniers jours (RGPD)
      const result = await AuditService.cleanOldLogs(90);
      logger.info(` ${result.message}`);
    } catch (error) {
      logger.error({ err: error }, ' Erreur lors du nettoyage des logs d\'audit:');
    }
  });

  logger.info(' Job de nettoyage des logs d\'audit programmé (tous les jours à 2h00)');
}

/**
 * Job de nettoyage manuel (pour tests ou administration)
 */
export async function runCleanupNow(daysToKeep: number = 90) {
  logger.info(` Exécution manuelle du nettoyage (conservation: ${daysToKeep} jours)...`);

  try {
    const result = await AuditService.cleanOldLogs(daysToKeep);
    logger.info(` ${result.message}`);
    return result;
  } catch (error) {
    logger.error({ err: error }, ' Erreur lors du nettoyage:');
    throw error;
  }
}
