import { Router } from 'express';
import { AuditController } from '../controllers/auditController';
import { authenticate } from '../middlewares/auth';
import { requireDelegationPermission } from '../middlewares/delegation';
import { requirePlanFeature } from '../middlewares/planFeature';

const router = Router();

router.use(authenticate);

router.get('/audit/logs', requireDelegationPermission('read'), requirePlanFeature('auditLogs'), AuditController.getUserLogs);
router.get('/audit/stats', requireDelegationPermission('read'), requirePlanFeature('auditLogs'), AuditController.getActivityStats);
router.get('/audit/export/csv', requireDelegationPermission('read'), requirePlanFeature('auditLogs'), AuditController.exportUserLogsCsv);

export default router;
