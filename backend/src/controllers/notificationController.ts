import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { NotificationService } from '../services/notificationService';

export class NotificationController {
  static async getNotifications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await NotificationService.getByUser(userId, page, limit);
      const unreadCount = await NotificationService.getUnreadCount(userId);

      res.json({ ...result, unreadCount });
    } catch (error) { next(error); }
  }

  static async markAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await NotificationService.markAsRead(id, userId);
      res.json({ message: 'Notification marquée comme lue' });
    } catch (error) { next(error); }
  }

  static async markAllAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      await NotificationService.markAllAsRead(userId);
      res.json({ message: 'Toutes les notifications marquées comme lues' });
    } catch (error) { next(error); }
  }

  static async deleteNotification(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await NotificationService.delete(id, userId);
      res.json({ message: 'Notification supprimée' });
    } catch (error) { next(error); }
  }
}
