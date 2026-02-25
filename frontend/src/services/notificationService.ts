import api from './api';

export const notificationService = {
  getNotifications: (page = 1, limit = 20) =>
    api.get('/notifications', { params: { page, limit } }).then((r) => r.data),

  markAsRead: (id: string) =>
    api.patch(`/notifications/${id}/read`).then((r) => r.data),

  markAllAsRead: () =>
    api.patch('/notifications/read-all').then((r) => r.data),

  deleteNotification: (id: string) =>
    api.delete(`/notifications/${id}`).then((r) => r.data),
};
