import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { isAdmin } from '../middlewares/admin';
import { AdminController } from '../controllers/adminController';

const router = Router();

router.use(authenticate, isAdmin);

router.get('/overview', AdminController.getOverview);
router.get('/users', AdminController.listUsers);
router.get('/export/users.csv', AdminController.exportUsersCsv);
router.get('/export/storage.csv', AdminController.exportStorageCsv);
router.patch('/users/:userId/plan', AdminController.updateUserPlan);
router.post('/reindex', AdminController.reindexAllFiles);

export default router;
