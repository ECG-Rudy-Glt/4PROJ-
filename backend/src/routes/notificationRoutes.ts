import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.get('/', authenticate, NotificationController.getNotifications);
router.patch('/:id/read', authenticate, NotificationController.markAsRead);
router.patch('/read-all', authenticate, NotificationController.markAllAsRead);
router.delete('/:id', authenticate, NotificationController.deleteNotification);

export default router;
