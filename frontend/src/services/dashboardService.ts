import api from './api';
import { DashboardData } from '@/types';

export const dashboardService = {
  async getDashboard(): Promise<DashboardData> {
    const response = await api.get('/dashboard');
    return response.data;
  },
};
