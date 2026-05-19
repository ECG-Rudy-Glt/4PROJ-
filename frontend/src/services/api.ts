import axios from 'axios';

// Use environment variable or fallback to relative URL
// VITE_API_URL should be the server root (e.g. https://domain.com), /api is appended automatically
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '').replace(/\/$/, '')}/api`
  : '/api';

const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

function clearStoredAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('switchSessionId');
  localStorage.removeItem('tempToken');
}

function isAuthPage() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  return path.startsWith('/login')
    || path.startsWith('/register')
    || path.startsWith('/mfa-verify')
    || path.startsWith('/auth/callback');
}

function redirectToLogin(expired = false) {
  if (typeof window === 'undefined' || isAuthPage()) return;
  window.location.href = expired ? '/login?expired=true' : '/login';
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

function hasSwitchSession(config?: RetriableRequestConfig) {
  return Boolean(
    localStorage.getItem('switchSessionId')
      || getHeader(config?.headers, 'x-switch-session')
      || getHeader(config?.headers, 'X-Switch-Session')
  );
}

function isFatalAuth401(error: any) {
  const code = error.response?.data?.code;
  const message = error.response?.data?.error;

  if (code === 'SESSION_EXPIRED') return true;
  if (code === 'REAUTH_REQUIRED' || code === 'DEK_UNLOCK_REQUIRED') return false;

  return [
    'No token provided',
    'Access denied: full authentication required',
    'User not found',
    'Session expired (global logout)',
    'Invalid switch session cookie',
    'Delegation is no longer valid',
    'Delegate account inactive',
    'Root session account inactive',
    'Invalid token',
  ].includes(message);
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
  let body = data;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const responseBody = body as Record<string, unknown>;
    if (responseBody.success === true && 'data' in responseBody) {
      body = responseBody.data;
    }
  }

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
    refreshPromise = axios.post(`${baseURL}/auth/refresh`, { refreshToken }, {
      withCredentials: true,
      headers: oldToken ? { Authorization: `Bearer ${oldToken}` } : undefined,
    })
      .then((response) => unwrapRefreshResponse(response.data))
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// Add auth token to requests
api.interceptors.request.use((config) => {
  const requireHttps = import.meta.env.VITE_REQUIRE_HTTPS === 'true';
  if (requireHttps && typeof window !== 'undefined') {
    const url = new URL(config.baseURL || window.location.origin, window.location.origin);
    const isLocalhost = ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.protocol !== 'https:' && !isLocalhost) {
      throw new Error('Connexion non sécurisée bloquée (HTTPS requis)');
    }
  }

  const token = localStorage.getItem('token');
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const switchSessionId = localStorage.getItem('switchSessionId');
  if (switchSessionId) {
    config.headers['x-switch-session'] = switchSessionId;
  }
  return config;
});

// Handle token expiration and format normalization
api.interceptors.response.use(
  (response) => {
    // Normalisation globale: si le back renvoie { success: true, data: ... } on désencapsule data
    if (response.data && typeof response.data === 'object' && 'success' in response.data) {
      if ('data' in response.data) {
        response.data = response.data.data;
      } else {
        // Supprime le flag success si y'a pas de data, ou laisse tel quel (ex: { message: 'Ok' })
        delete response.data.success;
      }
    }
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      if (error.response?.data?.code === 'REAUTH_REQUIRED') {
        return Promise.reject(error);
      }

      const originalRequest = error.config as RetriableRequestConfig | undefined;
      const expired = error.response?.data?.code === 'SESSION_EXPIRED';

      if (hasSwitchSession(originalRequest)) {
        if (isFatalAuth401(error)) {
          clearStoredAuth();
          redirectToLogin(expired);
        }
        return Promise.reject(error);
      }

      if (!originalRequest
        || originalRequest._retry
        || isRefreshRequest(originalRequest)
        || isLogoutRequest(originalRequest)
      ) {
        clearStoredAuth();
        redirectToLogin(expired);
        return Promise.reject(error);
      }

      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        clearStoredAuth();
        redirectToLogin(expired);
        return Promise.reject(error);
      }

      try {
        const oldToken = localStorage.getItem('token');
        const refreshed = await refreshAccessToken(refreshToken, oldToken);

        localStorage.setItem('token', refreshed.token);
        localStorage.setItem('refreshToken', refreshed.refreshToken);
        originalRequest._retry = true;
        setAuthorizationHeader(originalRequest, refreshed.token);

        return api(originalRequest);
      } catch (refreshError) {
        clearStoredAuth();
        redirectToLogin(true);
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
