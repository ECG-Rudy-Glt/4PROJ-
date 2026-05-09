import api from './api';

export interface VaultStatus {
  available?: boolean;
  plan?: string;
  enabled: boolean;
  mfaEnabled: boolean;
  unlocked: boolean;
  unlockUntil?: string | null;
  lockedUntil?: string | null;
  failedAttempts: number;
  lastUnlockedAt?: string | null;
}

export const vaultService = {
  async getStatus(): Promise<{ status: VaultStatus; rootFolder?: { id: string; name: string } | null }> {
    const res = await api.get('/vault/status');
    return res.data;
  },

  async setup(password: string, totpCode: string): Promise<{ status: VaultStatus }> {
    const res = await api.post('/vault/setup', { password, totpCode });
    return res.data;
  },

  async unlock(password: string, totpCode: string): Promise<{ status: VaultStatus }> {
    const res = await api.post('/vault/unlock', { password, totpCode });
    return res.data;
  },

  async lock(): Promise<{ status: VaultStatus }> {
    const res = await api.post('/vault/lock');
    return res.data;
  },

  async rotatePassword(oldPassword: string, newPassword: string, totpCode: string): Promise<{ status: VaultStatus }> {
    const res = await api.post('/vault/rotate-password', { oldPassword, newPassword, totpCode });
    return res.data;
  },
};
