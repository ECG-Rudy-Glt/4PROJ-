import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { AccountAccessController } from '../controllers/accountAccessController';

const router = Router();

const requireNonDelegatedSession = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.authContext?.authType === 'DELEGATION') {
    res.status(403).json({ error: 'Action interdite pendant une session déléguée' });
    return;
  }
  next();
};

router.use(authenticate);

router.get('/switch-links', requireNonDelegatedSession, AccountAccessController.listSwitchLinks);
router.post('/switch-links', requireNonDelegatedSession, AccountAccessController.addSwitchLink);
router.delete('/switch-links/:linkId', requireNonDelegatedSession, AccountAccessController.revokeSwitchLink);
router.post('/switch-links/:linkId/switch', requireNonDelegatedSession, AccountAccessController.switchToLinkedAccount);
router.post('/switch/back', AccountAccessController.switchBack);

router.get('/delegations', AccountAccessController.listDelegations);
router.post('/delegations', requireNonDelegatedSession, AccountAccessController.grantDelegation);
router.patch('/delegations/:delegationId/revoke', requireNonDelegatedSession, AccountAccessController.revokeDelegation);
router.post('/delegations/:delegationId/assume', requireNonDelegatedSession, AccountAccessController.assumeDelegation);

export default router;

