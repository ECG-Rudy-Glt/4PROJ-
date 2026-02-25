import { create } from 'zustand';
import { vaultService, VaultRootFolder, VaultStatus } from '@/services/vaultService';

interface VaultState {
  status: VaultStatus | null;
  rootFolder: VaultRootFolder | null;
  isInVaultContext: boolean;
  isLoading: boolean;
  refreshStatus: () => Promise<void>;
  setInVaultContext: (value: boolean) => void;
  reset: () => void;
}

export const useVaultStore = create<VaultState>((set) => ({
  status: null,
  rootFolder: null,
  isInVaultContext: false,
  isLoading: false,
  refreshStatus: async () => {
    set({ isLoading: true });
    try {
      const { status, rootFolder } = await vaultService.getStatus();
      set({
        status,
        rootFolder: rootFolder || null,
        isLoading: false,
      });
    } catch {
      set({
        status: null,
        rootFolder: null,
        isLoading: false,
      });
    }
  },
  setInVaultContext: (value) => set({ isInVaultContext: value }),
  reset: () =>
    set({
      status: null,
      rootFolder: null,
      isInVaultContext: false,
      isLoading: false,
    }),
}));

