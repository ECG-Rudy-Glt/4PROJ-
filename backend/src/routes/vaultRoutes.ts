import { Router } from 'express';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { VaultController } from '../controllers/vaultController';
import { Response, NextFunction } from 'express';
import { requirePlanFeature } from '../middlewares/planFeature';

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
router.post('/setup', requireNonDelegatedSession, requirePlanFeature('vault'), VaultController.setup);
router.post('/unlock', requireNonDelegatedSession, requirePlanFeature('vault'), VaultController.unlock);
router.post('/lock', requireNonDelegatedSession, requirePlanFeature('vault'), VaultController.lock);
router.post('/rotate-password', requireNonDelegatedSession, requirePlanFeature('vault'), VaultController.rotatePassword);

export default router;
