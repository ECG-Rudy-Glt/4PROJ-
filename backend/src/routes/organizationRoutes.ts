import { Router } from 'express';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { OrganizationController } from '../controllers/organizationController';
import { NextFunction, Response } from 'express';

const router = Router();

router.use(authenticate);

const requireNonDelegatedSession = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.authContext?.authType === 'DELEGATION') {
    res.status(403).json({ error: 'Action interdite pendant une session déléguée' });
    return;
  }
  next();
};

router.get('/mine', requireNonDelegatedSession, OrganizationController.listMine);
router.post('/', requireNonDelegatedSession, OrganizationController.create);
router.get('/:orgId', requireNonDelegatedSession, OrganizationController.getById);
router.post('/:orgId/members', requireNonDelegatedSession, OrganizationController.addMember);
router.patch('/:orgId/members/:memberId', requireNonDelegatedSession, OrganizationController.updateMemberRole);
router.delete('/:orgId/members/:memberId', requireNonDelegatedSession, OrganizationController.removeMember);
router.post('/:orgId/switch', requireNonDelegatedSession, OrganizationController.switchCurrent);

export default router;
