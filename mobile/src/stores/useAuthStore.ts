import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { User, AuthSessionContext } from '../types';

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
    set({ token, user, sessionContext, isAuthenticated: true, isLoading: false });
  },

  setUser: (user) => set({ user }),

  logout: async () => {
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('refreshToken');
    set({ user: null, token: null, sessionContext: null, isAuthenticated: false });
  },

  setLoading: (v) => set({ isLoading: v }),
}));
