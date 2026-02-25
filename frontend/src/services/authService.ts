import api from './api';
import { User } from '@/types';

export const authService = {
  async register(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  async login(email: string, password: string) {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  async getProfile(): Promise<{ user: User }> {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  async updateProfile(data: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
    theme?: string;
  }) {
    const response = await api.put('/auth/profile', data);
    return response.data;
  },

  async changePassword(oldPassword: string, newPassword: string) {
    const response = await api.post('/auth/change-password', {
      oldPassword,
      newPassword,
    });
    return response.data;
  },

  async exportUserData() {
    const response = await api.get('/auth/export-data', {
      responseType: 'blob',
    });
    return response.data;
  },

  async logoutAll() {
    const response = await api.post('/auth/logout-all');
    return response.data;
  },
};
