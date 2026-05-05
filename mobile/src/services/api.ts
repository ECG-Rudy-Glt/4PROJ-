import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://supfile.fr/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

const hasOwn = Object.prototype.hasOwnProperty;

function shouldUnwrapResponse(responseType?: string): boolean {
  return !responseType || responseType === 'json';
}

function unwrapBackendResponse(data: unknown): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return data;
  }

  const body = data as Record<string, unknown>;
  if (body.success === true && hasOwn.call(body, 'data')) {
    return body.data;
  }

  return data;
}

// ── Request: injecter le token ──────────────────────────
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('token');
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response: gérer expiration / 401 ────────────────────
api.interceptors.response.use(
  (response) => {
    if (shouldUnwrapResponse(response.config.responseType)) {
      response.data = unwrapBackendResponse(response.data);
    }
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      if (error.response?.data?.code === 'REAUTH_REQUIRED') {
        return Promise.reject(error);
      }
      // Nettoyer le token expiré — le store gère la redirection
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('refreshToken');
    }
    return Promise.reject(error);
  },
);

export default api;
