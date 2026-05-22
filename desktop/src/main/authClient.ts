import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import mime from 'mime-types';
import type { AuthUser } from '../shared/types';

type ApiEnvelope<T> = { success?: boolean; data?: T } & T;

type AuthTokens = {
  token?: string;
  refreshToken?: string;
  tempToken?: string;
};

type TokenChangeHandler = (tokens: AuthTokens) => void | Promise<void>;

function normalizeServerUrl(serverUrl: string) {
  return serverUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
}

function unwrap<T>(response: AxiosResponse<ApiEnvelope<T>>): T {
  const data = response.data;
  if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
    return data.data as T;
  }
  return data as T;
}

export class AuthClient {
  private axios: AxiosInstance;
  private tokens: AuthTokens = {};
  private refreshing: Promise<AuthTokens> | null = null;
  private onTokensChanged?: TokenChangeHandler;
  serverUrl: string;

  constructor(serverUrl: string) {
    this.serverUrl = normalizeServerUrl(serverUrl);
    this.axios = axios.create({
      baseURL: `${this.serverUrl}/api`,
      timeout: 60000,
    });
  }

  setServerUrl(serverUrl: string) {
    this.serverUrl = normalizeServerUrl(serverUrl);
    this.axios.defaults.baseURL = `${this.serverUrl}/api`;
  }

  setTokens(tokens: AuthTokens) {
    this.tokens = { ...this.tokens, ...tokens };
  }

  getTokens() {
    return { ...this.tokens };
  }

  setTokenChangeHandler(handler: TokenChangeHandler) {
    this.onTokensChanged = handler;
  }

  private async notifyTokensChanged() {
    await this.onTokensChanged?.(this.getTokens());
  }

  private async refresh() {
    if (!this.tokens.refreshToken) throw new Error('Session expirée');
    if (!this.refreshing) {
      const oldToken = this.tokens.token;
      this.refreshing = this.axios.post('/auth/refresh', {
        refreshToken: this.tokens.refreshToken,
      }, {
        headers: oldToken ? { Authorization: `Bearer ${oldToken}` } : undefined,
      }).then((response) => unwrap<AuthTokens>(response))
        .then(async (tokens) => {
          this.tokens = {
            ...this.tokens,
            token: tokens.token,
            refreshToken: tokens.refreshToken,
          };
          await this.notifyTokensChanged();
          return this.tokens;
        })
        .finally(() => {
          this.refreshing = null;
        });
    }
    return this.refreshing;
  }

  async request<T>(config: AxiosRequestConfig, retry = true): Promise<T> {
    try {
      const headers = {
        ...(config.headers || {}),
        ...(this.tokens.token ? { Authorization: `Bearer ${this.tokens.token}` } : {}),
      };
      return unwrap<T>(await this.axios.request<ApiEnvelope<T>>({ ...config, headers }));
    } catch (error: any) {
      if (retry && error.response?.status === 401 && this.tokens.refreshToken) {
        await this.refresh();
        return this.request<T>(config, false);
      }
      throw error;
    }
  }

  async login(email: string, password: string) {
    const result = await this.request<any>({
      method: 'POST',
      url: '/auth/login',
      data: { email, password },
    }, false);

    if (result.token) {
      this.setTokens({ token: result.token, refreshToken: result.refreshToken });
    } else if (result.tempToken) {
      this.setTokens({ tempToken: result.tempToken });
    }

    return result;
  }

  async setupMfa() {
    return this.request<{ secret: string; qrCodeDataUrl: string; backupCodes: string[] }>({
      method: 'POST',
      url: '/mfa/setup',
      headers: this.tokens.tempToken ? { Authorization: `Bearer ${this.tokens.tempToken}` } : undefined,
      data: {},
    }, false);
  }

  async verifyMfa(token: string, rememberDevice: boolean) {
    const result = await this.request<any>({
      method: 'POST',
      url: '/mfa/verify',
      headers: this.tokens.tempToken ? { Authorization: `Bearer ${this.tokens.tempToken}` } : undefined,
      data: { token, rememberDevice },
    }, false);
    this.setTokens({ token: result.token, refreshToken: result.refreshToken, tempToken: undefined });
    return result;
  }

  async verifyBackupCode(backupCode: string, rememberDevice: boolean) {
    const result = await this.request<any>({
      method: 'POST',
      url: '/mfa/verify-backup-code',
      headers: this.tokens.tempToken ? { Authorization: `Bearer ${this.tokens.tempToken}` } : undefined,
      data: { backupCode, rememberDevice },
    }, false);
    this.setTokens({ token: result.token, refreshToken: result.refreshToken, tempToken: undefined });
    return result;
  }

  async verifyMfaSetup(payload: {
    token: string;
    secret: string;
    backupCodes: string[];
    rememberDevice: boolean;
  }) {
    const result = await this.request<any>({
      method: 'POST',
      url: '/mfa/verify-setup',
      headers: this.tokens.tempToken ? { Authorization: `Bearer ${this.tokens.tempToken}` } : undefined,
      data: payload,
    }, false);
    this.setTokens({ token: result.token, refreshToken: result.refreshToken, tempToken: undefined });
    return result;
  }

  async getProfile() {
    return this.request<{ user: AuthUser }>({ method: 'GET', url: '/auth/profile' });
  }

  async logout() {
    if (!this.tokens.refreshToken) return;
    await this.request({ method: 'POST', url: '/auth/logout', data: { refreshToken: this.tokens.refreshToken } }, false)
      .catch(() => undefined);
  }

  async uploadFile(filePath: string, fields: Record<string, string | undefined>) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      if (value) form.append(key, value);
    }
    form.append('file', fs.createReadStream(filePath), {
      filename: fields.fileName || undefined,
      contentType: mime.lookup(filePath) || 'application/octet-stream',
    });

    return this.request<{ file: any }>({
      method: 'POST',
      url: '/sync/files/upload',
      headers: form.getHeaders(),
      data: form,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 0,
    });
  }

  async downloadFile(fileId: string, retry = true): Promise<NodeJS.ReadableStream> {
    try {
      const response = await this.axios.request<NodeJS.ReadableStream>({
        method: 'GET',
        url: `/files/${fileId}/download`,
        responseType: 'stream',
        headers: this.tokens.token ? { Authorization: `Bearer ${this.tokens.token}` } : undefined,
        timeout: 0,
      });
      return response.data;
    } catch (error: any) {
      if (retry && error.response?.status === 401 && this.tokens.refreshToken) {
        await this.refresh();
        return this.downloadFile(fileId, false);
      }
      throw error;
    }
  }
}
