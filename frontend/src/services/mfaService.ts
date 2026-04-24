import api from './api';

export interface MFASetupResponse {
  secret: string;
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
 * Service MFA (Multi-Factor Authentication)
 */
export const mfaService = {
  /**
   * Génère le secret TOTP et le QR code pour la configuration initiale
   */
  async setupMFA(): Promise<MFASetupResponse> {
    const tempToken = localStorage.getItem('tempToken');
    const response = await api.post('/mfa/setup', {}, {
      headers: tempToken ? {
        Authorization: `Bearer ${tempToken}`
      } : undefined
    });
    return response.data;
  },

  /**
   * Vérifie le code TOTP initial et active le MFA
   */
  async verifySetup(
    token: string,
    secret: string,
    backupCodes: string[],
    rememberDevice: boolean
  ): Promise<{ message: string; token: string }> {
    const tempToken = localStorage.getItem('tempToken');
    const response = await api.post('/mfa/verify-setup', {
      token,
      secret,
      backupCodes,
      rememberDevice,
    }, {
      headers: tempToken ? {
        Authorization: `Bearer ${tempToken}`
      } : undefined
    });
    return response.data;
  },

  /**
   * Vérifie un code TOTP lors de la connexion
   */
  async verifyMFA(
    token: string,
    rememberDevice: boolean
  ): Promise<MFAVerifyResponse> {
    const tempToken = localStorage.getItem('tempToken');
    const response = await api.post('/mfa/verify', {
      token,
      rememberDevice,
    }, {
      headers: tempToken ? {
        Authorization: `Bearer ${tempToken}`
      } : undefined
    });
    return response.data;
  },

  /**
   * Vérifie un code de récupération
   */
  async verifyBackupCode(
    backupCode: string,
    rememberDevice: boolean
  ): Promise<MFAVerifyResponse> {
    const tempToken = localStorage.getItem('tempToken');
    const response = await api.post('/mfa/verify-backup-code', {
      backupCode,
      rememberDevice,
    }, {
      headers: tempToken ? {
        Authorization: `Bearer ${tempToken}`
      } : undefined
    });
    return response.data;
  },

  /**
   * Régénère les codes de récupération
   */
  async regenerateBackupCodes(token: string): Promise<{ backupCodes: string[] }> {
    const response = await api.post('/mfa/regenerate-codes', { token });
    return response.data;
  },

  /**
   * Récupère la liste des appareils de confiance
   */
  async getTrustedDevices(): Promise<TrustedDevice[]> {
    const response = await api.get('/mfa/trusted-devices');
    return response.data.devices;
  },

  /**
   * Révoque un appareil de confiance
   */
  async revokeTrustedDevice(deviceId: string): Promise<void> {
    await api.delete(`/mfa/trusted-devices/${deviceId}`);
  },

  /**
   * Désactive le MFA
   */
  async disableMFA(token: string): Promise<void> {
    await api.post('/mfa/disable', { token });
  },

  /**
   * Récupère le statut MFA de l'utilisateur
   */
  async getMFAStatus(): Promise<MFAStatusResponse> {
    const response = await api.get('/mfa/status');
    return response.data;
  },
};
