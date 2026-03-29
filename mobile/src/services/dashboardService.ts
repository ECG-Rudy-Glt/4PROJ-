import api from './api';
import { DashboardData } from '../types';

export const dashboardService = {
  async getDashboard(): Promise<DashboardData> {
    const res = await api.get('/dashboard');
    return res.data;
  },
};
