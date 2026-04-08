import { create } from 'zustand';
import { DashboardData } from '../types';
import { dashboardService } from '../services/dashboardService';

interface DashboardState {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  reset: () => void;
}

const initialState = {
  data: null as DashboardData | null,
  loading: false,
  error: null as string | null,
};

export const useDashboardStore = create<DashboardState>((set) => ({
  ...initialState,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const data = await dashboardService.getDashboard();
      set({ data, loading: false });
    } catch {
      set({ error: 'Impossible de charger le tableau de bord', loading: false });
    }
  },

  reset: () => set(initialState),
}));
