import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { Response, NextFunction } from 'express';
import { requireDelegationPermission } from '../middlewares/delegation';

const router = Router();

const requireNonDelegatedSession = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.authContext?.authType === 'DELEGATION') {
    res.status(403).json({ error: 'Action interdite pendant une session déléguée' });
    return;
  }
  next();
};

// Search users for sharing
router.get('/search', authenticate, requireDelegationPermission('read'), UserController.searchUsers);
router.put('/plan', authenticate, requireNonDelegatedSession, UserController.updatePlan);
router.get('/:userId', authenticate, requireDelegationPermission('read'), UserController.getUserInfo);

export default router;
