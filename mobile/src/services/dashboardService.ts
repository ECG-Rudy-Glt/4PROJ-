import api from './api';
import { DashboardData } from '../types';

export const dashboardService = {
  async getDashboard(): Promise<DashboardData> {
    const res = await api.get('/dashboard');
    // Backend wraps via sendSuccess: { success: true, data: DashboardData }
    return res.data?.data ?? res.data;
  },
};
