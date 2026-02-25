import prisma from '../config/database';
import { NotificationType } from '@prisma/client';
import { SocketService } from './socketService';
import { WebPushService } from './webPushService';

export class NotificationService {
  static async create(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, any>
  ) {
    const notification = await prisma.notification.create({
      data: { userId, type, title, message, data },
    });

    SocketService.emitToUser(userId, 'notification_new', notification);

    // Web Push (navigateur fermé)
    WebPushService.sendToUser(userId, title, message, data).catch(console.error);

    return notification;
  }

  static async getByUser(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId } }),
    ]);

    return { notifications, total, page, limit };
  }

  static async getUnreadCount(userId: string) {
    return prisma.notification.count({
      where: { userId, read: false },
    });
  }

  static async markAsRead(id: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }

  static async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  static async delete(id: string, userId: string) {
    return prisma.notification.deleteMany({
      where: { id, userId },
    });
  }
}
