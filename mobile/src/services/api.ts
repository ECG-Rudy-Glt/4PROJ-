import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const API_URL =
  Constants.expoConfig?.extra?.apiUrl ??
  // Dev : adresse du Mac sur le réseau local (modifier selon votre IP)
  __DEV__
    ? 'http://localhost:3000/api' // Remplacer par l'IP locale du Mac (ex: 192.168.X.X) pour tester sur device
    : 'https://supfile.fr/api';

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

// ── Response: gérer expiration / 401 ────────────────────
api.interceptors.response.use(
  (response) => response,
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
