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
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (error.response?.data?.code === 'REAUTH_REQUIRED') {
        return Promise.reject(error);
      }

      localStorage.removeItem('token');

      // Check if session expired
      if (error.response?.data?.code === 'SESSION_EXPIRED') {
        window.location.href = '/login?expired=true';
      } else {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
