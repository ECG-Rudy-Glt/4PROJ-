import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { VaultController } from '../controllers/vaultController';

const router = Router();

router.use(authenticate);

router.get('/status', VaultController.getStatus);
router.post('/setup', VaultController.setup);
router.post('/unlock', VaultController.unlock);
router.post('/lock', VaultController.lock);
router.post('/rotate-password', VaultController.rotatePassword);

export default router;
