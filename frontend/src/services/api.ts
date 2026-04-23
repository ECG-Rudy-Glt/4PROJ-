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
  (error) => {
    if (error.response?.status === 401) {
      if (error.response?.data?.code === 'REAUTH_REQUIRED') {
        return Promise.reject(error);
      }

      localStorage.removeItem('token');

      // Ne pas rediriger si on est déjà sur les pages d'auth
      const path = window.location.pathname;
      if (!path.startsWith('/login') && !path.startsWith('/register') && !path.startsWith('/mfa-verify') && !path.startsWith('/auth/callback')) {
        // Check if session expired
        if (error.response?.data?.code === 'SESSION_EXPIRED') {
          window.location.href = '/login?expired=true';
        } else {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
