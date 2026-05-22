import { create } from 'zustand';
import { AuthSessionContext, User, AuthResponse } from '@/types';
import { authService } from '@/services/authService';

interface AuthState {
  user: User | null;
  token: string | null;
  sessionContext: AuthSessionContext | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  deleteAccount: (data: {
    confirmationEmail: string;
    currentPassword?: string;
    mfaCode?: string;
  }) => Promise<void>;
  setAuthToken: (
    token: string,
    user?: User,
    sessionContext?: AuthSessionContext | null,
    refreshToken?: string
  ) => Promise<void>;
}

function storeAuthTokens(token: string, refreshToken?: string) {
  localStorage.setItem('token', token);
  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken);
  }
}

function clearAuthStorage() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('switchSessionId');
  localStorage.removeItem('tempToken');
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
      if ('mfaRequired' in response || 'mfaSetupRequired' in response) {
        set({ isLoading: false });
        return response;
      }

      // Connexion normale (appareil de confiance)
      if ('token' in response) {
        storeAuthTokens(response.token, response.refreshToken);
        set({ user: response.user, token: response.token, sessionContext: response.session || null, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
      return response;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (data) => {
    set({ isLoading: true });
    try {
      const response = await authService.register(data);
      if ('mfaSetupRequired' in response) {
        set({ isLoading: false });
        return response;
      }
      
      // Connexion normale (ne devrait pas arriver si MFA est obligatoire, mais pour le typage)
      if ('token' in response) {
        storeAuthTokens(response.token, response.refreshToken);
        set({ user: response.user, token: response.token, sessionContext: response.session || null, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
      return response;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
    } finally {
      clearAuthStorage();
      set({ user: null, token: null, sessionContext: null, isAuthenticated: false });
    }
  },

  loadUser: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      clearAuthStorage();
      set({ isAuthenticated: false });
      return;
    }

    set({ isLoading: true });
    try {
      const { user, session } = await authService.getProfile();
      set({ user, sessionContext: session || null, isAuthenticated: true, isLoading: false });
    } catch {
      clearAuthStorage();
      set({ user: null, token: null, sessionContext: null, isAuthenticated: false, isLoading: false });
    }
  },

  updateProfile: async (data) => {
    const { user } = await authService.updateProfile(data);
    set({ user });
  },
  refreshProfile: async () => {
    const { user, session } = await authService.getProfile();
    set({ user, sessionContext: session || null });
  },
  deleteAccount: async (data) => {
    await authService.deleteAccount(data);
    clearAuthStorage();
    set({ user: null, token: null, sessionContext: null, isAuthenticated: false });
    window.location.href = '/login?accountDeleted=true';
  },
  setAuthToken: async (token, user, sessionContext, refreshToken) => {
    storeAuthTokens(token, refreshToken);
    if (user) {
      set({ token, user, sessionContext: sessionContext || null, isAuthenticated: true });
      return;
    }

    set({ token, isAuthenticated: true });
    const { user: loadedUser, session } = await authService.getProfile();
    set({ user: loadedUser, sessionContext: session || null });
  },
}));
