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

type RefreshResult = {
  token: string;
  refreshToken: string;
};

type RetriableRequestConfig = NonNullable<Parameters<typeof api>[0]> & {
  _retry?: boolean;
  headers?: any;
  url?: string;
};

let refreshPromise: Promise<RefreshResult> | null = null;

async function clearStoredAuth() {
  await SecureStore.deleteItemAsync('token');
  await SecureStore.deleteItemAsync('refreshToken');
  await SecureStore.deleteItemAsync('tempToken');
  await SecureStore.deleteItemAsync('switchSessionId');
  delete api.defaults.headers.common['Authorization'];
  delete api.defaults.headers.common['X-Switch-Session'];
}

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

function requestUrl(config?: RetriableRequestConfig) {
  return config?.url || '';
}

function isRefreshRequest(config?: RetriableRequestConfig) {
  return requestUrl(config).includes('/auth/refresh');
}

function isLogoutRequest(config?: RetriableRequestConfig) {
  return requestUrl(config).includes('/auth/logout');
}

function getHeader(headers: any, name: string): unknown {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') return headers.get(name);
  return headers[name] || headers[name.toLowerCase()];
}

async function hasSwitchSession(config?: RetriableRequestConfig) {
  return Boolean(
    await SecureStore.getItemAsync('switchSessionId')
      || getHeader(config?.headers, 'x-switch-session')
      || getHeader(config?.headers, 'X-Switch-Session')
  );
}

function setAuthorizationHeader(config: RetriableRequestConfig, token: string) {
  config.headers = config.headers || {};
  if (typeof config.headers.set === 'function') {
    config.headers.set('Authorization', `Bearer ${token}`);
    return;
  }
  config.headers.Authorization = `Bearer ${token}`;
}

function unwrapRefreshResponse(data: unknown): RefreshResult {
  const body = unwrapBackendResponse(data);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Réponse de rafraîchissement invalide');
  }

  const refreshBody = body as Record<string, unknown>;
  if (typeof refreshBody.token !== 'string' || typeof refreshBody.refreshToken !== 'string') {
    throw new Error('Réponse de rafraîchissement invalide');
  }

  return {
    token: refreshBody.token,
    refreshToken: refreshBody.refreshToken,
  };
}

function refreshAccessToken(refreshToken: string, oldToken: string | null) {
  if (!refreshPromise) {
    refreshPromise = axios.post(`${API_URL}/auth/refresh`, { refreshToken }, {
      timeout: 30_000,
      headers: oldToken ? { Authorization: `Bearer ${oldToken}` } : undefined,
    })
      .then((response) => unwrapRefreshResponse(response.data))
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
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

      const originalRequest = error.config as RetriableRequestConfig | undefined;
      if (!originalRequest
        || originalRequest._retry
        || isRefreshRequest(originalRequest)
        || isLogoutRequest(originalRequest)
        || await hasSwitchSession(originalRequest)
      ) {
        await clearStoredAuth();
        return Promise.reject(error);
      }

      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (!refreshToken) {
        await clearStoredAuth();
        return Promise.reject(error);
      }

      try {
        const oldToken = await SecureStore.getItemAsync('token');
        const refreshed = await refreshAccessToken(refreshToken, oldToken);

        await SecureStore.setItemAsync('token', refreshed.token);
        await SecureStore.setItemAsync('refreshToken', refreshed.refreshToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${refreshed.token}`;
        originalRequest._retry = true;
        setAuthorizationHeader(originalRequest, refreshed.token);

        return api(originalRequest);
      } catch (refreshError) {
        await clearStoredAuth();
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  },
);

export default api;
