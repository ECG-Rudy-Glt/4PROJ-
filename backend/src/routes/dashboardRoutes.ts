import { Router } from 'express';
import { DashboardController } from '../controllers/dashboardController';
import { authenticate } from '../middlewares/auth';
import { requireDelegationPermission } from '../middlewares/delegation';

const router = Router();

router.get('/', authenticate, requireDelegationPermission('read'), DashboardController.getDashboard);

export default router;
