import { create } from 'zustand';
import { AuthSessionContext, User } from '@/types';
import { authService } from '@/services/authService';

interface AuthState {
  user: User | null;
  token: string | null;
  sessionContext: AuthSessionContext | null;
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
  setAuthToken: (token: string, user?: User, sessionContext?: AuthSessionContext | null) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  sessionContext: null,
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
      set({ user, token, sessionContext: null, isAuthenticated: true, isLoading: false });
      return response;
    } catch {
      set({ isLoading: false });
      throw new Error('Login failed');
    }
  },

  register: async (data) => {
    set({ isLoading: true });
    try {
      const { user, token } = await authService.register(data);
      localStorage.setItem('token', token);
      set({ user, token, sessionContext: null, isAuthenticated: true, isLoading: false });
    } catch {
      set({ isLoading: false });
      throw new Error('Registration failed');
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, sessionContext: null, isAuthenticated: false });
  },

  loadUser: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isAuthenticated: false });
      return;
    }

    set({ isLoading: true });
    try {
      const { user, session } = await authService.getProfile();
      set({ user, sessionContext: session || null, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null, sessionContext: null, isAuthenticated: false, isLoading: false });
    }
  },

  updateProfile: async (data) => {
    try {
      const { user } = await authService.updateProfile(data);
      set({ user });
    } catch {
      throw new Error('Update profile failed');
    }
  },
  refreshProfile: async () => {
    const { user, session } = await authService.getProfile();
    set({ user, sessionContext: session || null });
  },
  setAuthToken: async (token, user, sessionContext) => {
    localStorage.setItem('token', token);
    if (user) {
      set({ token, user, sessionContext: sessionContext || null, isAuthenticated: true });
      return;
    }

    set({ token, isAuthenticated: true });
    const { user: loadedUser, session } = await authService.getProfile();
    set({ user: loadedUser, sessionContext: session || null });
  },
}));
