import { Router } from 'express';
import { AuditController } from '../controllers/auditController';
import { authenticate } from '../middlewares/auth';
import { requireDelegationPermission } from '../middlewares/delegation';
import { requirePlanFeature } from '../middlewares/planFeature';

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// GET /api/audit/logs - Récupérer les logs d'audit de l'utilisateur
router.get('/audit/logs', requireDelegationPermission('read'), requirePlanFeature('auditLogs'), AuditController.getUserLogs);

// GET /api/audit/stats - Récupérer les statistiques d'activité
router.get('/audit/stats', requireDelegationPermission('read'), requirePlanFeature('auditLogs'), AuditController.getActivityStats);
router.get('/audit/export/csv', requireDelegationPermission('read'), requirePlanFeature('auditLogs'), AuditController.exportUserLogsCsv);

export default router;
