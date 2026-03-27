import { create } from 'zustand';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
}

export const useAuthStore = create<AuthState>(() => ({
  isAuthenticated: false,
  isLoading: false,
}));
