import api from './api';
import { AdminOverview, AdminUserRow } from '@/types';

export const adminService = {
  async getOverview(): Promise<AdminOverview> {
    const response = await api.get('/admin/overview');
    return response.data;
  },

  async listUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    plan?: 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
  }): Promise<{
    users: AdminUserRow[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const response = await api.get('/admin/users', { params });
    return response.data;
  },

  async updateUserPlan(userId: string, plan: 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE') {
    const response = await api.patch(`/admin/users/${userId}/plan`, { plan });
    return response.data;
  },
};
