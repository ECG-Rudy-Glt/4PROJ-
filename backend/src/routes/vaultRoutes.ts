import { Router } from 'express';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { VaultController } from '../controllers/vaultController';
import { Response, NextFunction } from 'express';

const router = Router();

router.use(authenticate);

const requireNonDelegatedSession = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.authContext?.authType === 'DELEGATION') {
    res.status(403).json({ error: 'Action interdite pendant une session déléguée' });
    return;
  }
  next();
};

router.get('/status', VaultController.getStatus);
router.post('/setup', requireNonDelegatedSession, VaultController.setup);
router.post('/unlock', requireNonDelegatedSession, VaultController.unlock);
router.post('/lock', requireNonDelegatedSession, VaultController.lock);
router.post('/rotate-password', requireNonDelegatedSession, VaultController.rotatePassword);

export default router;
