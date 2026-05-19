import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

type ThemeMode = 'light' | 'dark' | 'system';

// Simple SecureStore adapter for zustand persist
const secureStorage = {
  getItem: async (name: string) => {
    try { return await SecureStore.getItemAsync(name); } catch { return null; }
  },
  setItem: async (name: string, value: string) => {
    try { await SecureStore.setItemAsync(name, value); } catch { /* noop */ }
  },
  removeItem: async (name: string) => {
    try { await SecureStore.deleteItemAsync(name); } catch { /* noop */ }
  },
};

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'light',
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'theme-preference',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
