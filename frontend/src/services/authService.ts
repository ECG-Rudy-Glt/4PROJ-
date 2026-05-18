import api from './api';
import { AuthSessionContext, User, AuthResponse } from '@/types';

function clearStoredAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('switchSessionId');
  localStorage.removeItem('tempToken');
}

export const authService = {
  async register(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<AuthResponse> {
    const response = await api.post('/auth/register', data);
    return response.data.data || response.data;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await api.post('/auth/login', { email, password });
    return response.data.data || response.data;
  },

  async getProfile(): Promise<{ user: User; session?: AuthSessionContext }> {
    const response = await api.get('/auth/profile');
    return response.data.data || response.data;
  },

  async updateProfile(data: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
    theme?: string;
    language?: string;
  }) {
    const response = await api.put('/auth/profile', data);
    return response.data.data || response.data;
  },

  async changePassword(oldPassword: string, newPassword: string, mfaCode?: string) {
    const response = await api.post('/auth/change-password', {
      oldPassword,
      newPassword,
      mfaCode,
    });
    return response.data.data || response.data;
  },

  async exportUserData() {
    const response = await api.get('/auth/export-data', {
      responseType: 'blob',
    });
    return response.data.data || response.data;
  },

  async deleteAccount(data: {
    confirmationEmail: string;
    currentPassword?: string;
    mfaCode?: string;
  }) {
    const response = await api.delete('/auth/account', { data });
    return response.data.data || response.data;
  },
  async logout(refreshToken: string) {
    const response = await api.post('/auth/logout', { refreshToken });
    return response.data.data || response.data;
  },

  async logoutAll() {
    try {
      const response = await api.post('/auth/logout-all');
      return response.data.data || response.data;
    } finally {
      clearStoredAuth();
    }
  },
};
