import api from './api';

export interface VaultStatus {
  enabled: boolean;
  mfaEnabled: boolean;
  unlocked: boolean;
  unlockUntil?: string | null;
  lockedUntil?: string | null;
  failedAttempts: number;
  lastUnlockedAt?: string | null;
}

export interface VaultRootFolder {
  id: string;
  name: string;
  path: string;
  isVault: boolean;
}

export const vaultService = {
  async getStatus(): Promise<{ status: VaultStatus; rootFolder?: VaultRootFolder | null }> {
    const response = await api.get('/vault/status');
    return response.data;
  },

  async setup(password: string, totpCode: string): Promise<{ status: VaultStatus }> {
    const response = await api.post('/vault/setup', { password, totpCode });
    return response.data;
  },

  async unlock(password: string, totpCode: string): Promise<{ status: VaultStatus }> {
    const response = await api.post('/vault/unlock', { password, totpCode });
    return response.data;
  },

  async lock(): Promise<{ status: VaultStatus }> {
    const response = await api.post('/vault/lock');
    return response.data;
  },

  async rotatePassword(oldPassword: string, newPassword: string, totpCode: string): Promise<{ status: VaultStatus }> {
    const response = await api.post('/vault/rotate-password', { oldPassword, newPassword, totpCode });
    return response.data;
  },
};
