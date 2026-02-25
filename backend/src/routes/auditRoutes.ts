import { Router } from 'express';
import { AuditController } from '../controllers/auditController';
import { authenticate } from '../middlewares/auth';
import { requireDelegationPermission } from '../middlewares/delegation';

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// GET /api/audit/logs - Récupérer les logs d'audit de l'utilisateur
router.get('/audit/logs', requireDelegationPermission('read'), AuditController.getUserLogs);

// GET /api/audit/stats - Récupérer les statistiques d'activité
router.get('/audit/stats', requireDelegationPermission('read'), AuditController.getActivityStats);
router.get('/audit/export/csv', requireDelegationPermission('read'), AuditController.exportUserLogsCsv);

export default router;
