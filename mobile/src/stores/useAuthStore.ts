import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { User, AuthSessionContext } from '../types';
import api from '../services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  sessionContext: AuthSessionContext | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  setAuth: (token: string, user: User, sessionContext?: AuthSessionContext | null) => Promise<void>;
  setUser: (user: User) => void;
  setSessionContext: (ctx: AuthSessionContext | null) => void;
  logout: () => Promise<void>;
  setLoading: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  sessionContext: null,
  isLoading: true,
  isAuthenticated: false,
  hydrated: false,

  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        // Restore switch session header if present
        const switchSession = await SecureStore.getItemAsync('switchSessionId');
        if (switchSession) {
          api.defaults.headers.common['X-Switch-Session'] = switchSession;
        }
        set({ token, isAuthenticated: true, isLoading: false, hydrated: true });
      } else {
        set({ isAuthenticated: false, isLoading: false, hydrated: true });
      }
    } catch {
      set({ isAuthenticated: false, isLoading: false, hydrated: true });
    }
  },

  setAuth: async (token, user, sessionContext = null) => {
    await SecureStore.setItemAsync('token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    set({ token, user, sessionContext, isAuthenticated: true, isLoading: false, hydrated: true });
  },

  setUser: (user) => set({ user }),

  setSessionContext: (ctx) => set({ sessionContext: ctx }),

  logout: async () => {
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('switchSessionId');
    delete api.defaults.headers.common['Authorization'];
    delete api.defaults.headers.common['X-Switch-Session'];
    set({ user: null, token: null, sessionContext: null, isAuthenticated: false });
  },

  setLoading: (v) => set({ isLoading: v }),
}));
