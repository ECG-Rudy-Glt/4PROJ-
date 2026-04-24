import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://supfile.fr/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request: injecter le token ──────────────────────────
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('token');
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response: dénormaliser { success: true, data: X } → X ──
api.interceptors.response.use(
  (response) => {
    if (response.data?.success === true && 'data' in response.data) {
      return { ...response, data: response.data.data };
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
