import api from './api';
import * as SecureStore from 'expo-secure-store';

export interface MFASetupResponse {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
}

export interface MFAVerifyResponse {
  message: string;
  token: string;
  user?: any;
  warning?: string;
}

export interface TrustedDevice {
  id: string;
  deviceName: string;
  ipAddress: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string;
}

export interface MFAStatusResponse {
  mfaEnabled: boolean;
  mfaSetupAt: string | null;
  remainingBackupCodes: number;
  activeTrustedDevices: number;
}

/**
 * Reads the temp token from SecureStore (set during login MFA flow)
 * and builds an Authorization header if present.
 */
async function tempAuthHeader(): Promise<{ Authorization: string } | undefined> {
  const tempToken = await SecureStore.getItemAsync('tempToken');
  return tempToken ? { Authorization: `Bearer ${tempToken}` } : undefined;
}

export const mfaService = {
  async setupMFA(): Promise<MFASetupResponse> {
    const headers = await tempAuthHeader();
    const res = await api.post('/mfa/setup', {}, { headers });
    return res.data;
  },

  async verifySetup(
    token: string,
    secret: string,
    backupCodes: string[],
    rememberDevice: boolean,
  ): Promise<{ message: string; token: string }> {
    const headers = await tempAuthHeader();
    const res = await api.post(
      '/mfa/verify-setup',
      { token, secret, backupCodes, rememberDevice },
      { headers },
    );
    return res.data;
  },

  async verifyMFA(userId: string, token: string, rememberDevice: boolean): Promise<MFAVerifyResponse> {
    const res = await api.post('/mfa/verify', { userId, token, rememberDevice });
    return res.data;
  },

  async verifyBackupCode(userId: string, backupCode: string, rememberDevice: boolean): Promise<MFAVerifyResponse> {
    const res = await api.post('/mfa/verify-backup-code', { userId, backupCode, rememberDevice });
    return res.data;
  },

  async regenerateBackupCodes(token: string): Promise<{ backupCodes: string[] }> {
    const res = await api.post('/mfa/regenerate-codes', { token });
    return res.data;
  },

  async getTrustedDevices(): Promise<TrustedDevice[]> {
    const res = await api.get('/mfa/trusted-devices');
    return res.data.devices;
  },

  async revokeTrustedDevice(deviceId: string): Promise<void> {
    await api.delete(`/mfa/trusted-devices/${deviceId}`);
  },

  async disableMFA(token: string): Promise<void> {
    await api.post('/mfa/disable', { token });
  },

  async getMFAStatus(): Promise<MFAStatusResponse> {
    const res = await api.get('/mfa/status');
    return res.data;
  },
};
