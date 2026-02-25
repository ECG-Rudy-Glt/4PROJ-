import { create } from 'zustand';
import { User } from '@/types';
import { authService } from '@/services/authService';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<any>;
  register: (data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: false,
  isAuthenticated: !!localStorage.getItem('token'),

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const response = await authService.login(email, password);

      // Si MFA requis ou setup requis, ne pas stocker le token et retourner la réponse
      if (response.mfaRequired || response.mfaSetupRequired) {
        set({ isLoading: false });
        return response;
      }

      // Connexion normale (appareil de confiance)
      const { user, token } = response;
      localStorage.setItem('token', token);
      set({ user, token, isAuthenticated: true, isLoading: false });
      return response;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (data) => {
    set({ isLoading: true });
    try {
      const { user, token } = await authService.register(data);
      localStorage.setItem('token', token);
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadUser: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isAuthenticated: false });
      return;
    }

    set({ isLoading: true });
    try {
      const { user } = await authService.getProfile();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      localStorage.removeItem('token');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },

  updateProfile: async (data) => {
    try {
      const { user } = await authService.updateProfile(data);
      set({ user });
    } catch (error) {
      throw error;
    }
  },
  refreshProfile: async () => {
    const { user } = await authService.getProfile();
    set({ user });
  },
}));
