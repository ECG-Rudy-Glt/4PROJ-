import cron from 'node-cron';
import { AuditService } from '../services/auditService';
import { VersionService } from '../services/versionService';

/**
 * Job de nettoyage automatique
 * S'exécute tous les jours à 2h du matin
 */
export function startCleanupJob() {
  // Nettoyer les logs d'audit tous les jours à 2h00
  cron.schedule('0 2 * * *', async () => {
    console.log('🧹 Démarrage du job de nettoyage des logs d\'audit...');

    try {
      // Conserver les logs des 90 derniers jours (RGPD)
      const result = await AuditService.cleanOldLogs(90);
      console.log(`✅ ${result.message}`);
    } catch (error) {
      console.error('❌ Erreur lors du nettoyage des logs d\'audit:', error);
    }
  });

  console.log('✅ Job de nettoyage des logs d\'audit programmé (tous les jours à 2h00)');
}

/**
 * Job de nettoyage manuel (pour tests ou administration)
 */
export async function runCleanupNow(daysToKeep: number = 90) {
  console.log(`🧹 Exécution manuelle du nettoyage (conservation: ${daysToKeep} jours)...`);

  try {
    const result = await AuditService.cleanOldLogs(daysToKeep);
    console.log(`✅ ${result.message}`);
    return result;
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
    throw error;
  }
}
