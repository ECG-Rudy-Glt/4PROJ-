import api from './api';
import { Notification } from '../types';

export const notificationService = {
  async getNotifications(): Promise<{ notifications: Notification[] }> {
    const res = await api.get('/notifications');
    return res.data;
  },

  async markAsRead(notificationId: string): Promise<void> {
    await api.put(`/notifications/${notificationId}/read`);
  },

  async markAllAsRead(): Promise<void> {
    await api.put('/notifications/read-all');
  },

  async deleteNotification(notificationId: string): Promise<void> {
    await api.delete(`/notifications/${notificationId}`);
  },
};
