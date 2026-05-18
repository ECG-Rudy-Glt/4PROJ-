import api from './api';
import {
  LoginPayload,
  RegisterPayload,
  MfaVerifyPayload,
  AuthResponse,
  MfaRequiredResponse,
  User,
  AuthSessionContext,
} from '../types';

type MfaSetupRequiredResponse = {
  mfaSetupRequired: true;
  tempToken: string;
  userId: string;
  user?: Pick<User, 'email' | 'firstName' | 'lastName'>;
};

type AuthStartResponse = AuthResponse | MfaRequiredResponse | MfaSetupRequiredResponse;

function unwrap<T>(data: any): T {
  return (data?.success === true && 'data' in data) ? data.data : data;
}

export const authService = {
  async login(data: LoginPayload): Promise<AuthStartResponse> {
    const res = await api.post('/auth/login', data);
    return unwrap(res.data);
  },

  async register(data: RegisterPayload): Promise<AuthStartResponse> {
    const res = await api.post('/auth/register', data);
    return unwrap(res.data);
  },

  async verifyMfa(data: MfaVerifyPayload): Promise<AuthResponse> {
    const res = await api.post(
      '/mfa/verify',
      {
        token: data.code,
        rememberDevice: data.trustDevice ?? false,
      },
      {
        headers: { Authorization: `Bearer ${data.tempToken}` },
      },
    );
    return unwrap(res.data);
  },

  async getProfile(): Promise<{ user: User; session?: AuthSessionContext }> {
    const res = await api.get('/auth/profile');
    return unwrap(res.data);
  },

  async updateProfile(data: Partial<Pick<User, 'firstName' | 'lastName' | 'theme'>>): Promise<{ user: User }> {
    const res = await api.put('/auth/profile', data);
    return unwrap(res.data);
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await api.post('/auth/change-password', { oldPassword, newPassword });
  },

  async logout(refreshToken: string): Promise<void> {
    await api.post('/auth/logout', { refreshToken });
  },

  async logoutAll(): Promise<void> {
    await api.post('/auth/logout-all');
  },

  async uploadAvatar(localUri: string): Promise<{ avatarUrl: string; user: User }> {
    const formData = new FormData();
    const filename = localUri.split('/').pop() ?? 'avatar.jpg';
    const ext = filename.split('.').pop() ?? 'jpg';
    (formData as any).append('avatar', { uri: localUri, name: filename, type: `image/${ext}` });
    const res = await api.post('/auth/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap(res.data);
  },

  /**
   * RGPD: downloads the user's data export (CSV) using the bearer token,
   * writes it to the cache directory and returns the local file URI.
   */
  async exportUserData(): Promise<string> {
    const FileSystem = await import('expo-file-system/legacy').catch(() => import('expo-file-system'));
    const res = await api.get('/auth/export-data', { responseType: 'text' });
    const date = new Date().toISOString().slice(0, 10);
    const fileUri = `${(FileSystem as any).cacheDirectory}supfile-export-${date}.csv`;
    await (FileSystem as any).writeAsStringAsync(fileUri, typeof res.data === 'string' ? res.data : String(res.data));
    return fileUri;
  },
};
