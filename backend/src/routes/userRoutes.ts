import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Search users for sharing
router.get('/search', authenticate, UserController.searchUsers);
router.put('/plan', authenticate, UserController.updatePlan);
router.get('/:userId', authenticate, UserController.getUserInfo);

export default router;
