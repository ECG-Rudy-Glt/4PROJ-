import api from './api';

export interface AdminOverview {
  kpis: {
    totalUsers: number;
    totalAdmins: number;
    totalFiles: number;
    totalStorageUsed: number;
    totalQuotaUsed: number;
    totalQuotaLimit: number;
    storageUsagePercent: number;
    activeUsers24h: number;
    newUsers30d: number;
    uploads24h: number;
  };
  distribution: {
    plans: Array<{ plan: string; count: number }>;
  };
  topStorageUsers: Array<{
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    plan: string;
    quotaUsed: number;
    quotaLimit: number;
  }>;
}

export interface AdminUserRow {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'USER' | 'ADMIN';
  plan: 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
  subscriptionStatus: string;
  quotaUsed: number;
  quotaLimit: number;
  createdAt: string;
}

export const adminService = {
  async getOverview(): Promise<AdminOverview> {
    const res = await api.get('/admin/overview');
    return res.data;
  },

  async listUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    plan?: string;
  }): Promise<{ users: AdminUserRow[]; pagination: { page: number; total: number; totalPages: number } }> {
    const res = await api.get('/admin/users', { params });
    return res.data;
  },

  async updateUserPlan(userId: string, plan: 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE'): Promise<{ user: AdminUserRow }> {
    const res = await api.patch(`/admin/users/${userId}/plan`, { plan });
    return res.data;
  },
};
