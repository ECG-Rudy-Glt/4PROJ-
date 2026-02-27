const DEFAULT_LOCAL_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

export const normalizeOrigin = (origin: string) => origin.replace(/\/+$/, '');

export const buildAllowedOrigins = (): string[] => {
  const frontendUrls = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const fromEnv = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const combined = [...frontendUrls, ...DEFAULT_LOCAL_ORIGINS, ...fromEnv];
  const unique = Array.from(new Set(combined.map(normalizeOrigin)));
  return unique;
};

export const isOriginAllowed = (allowedOrigins: string[], origin?: string | null): boolean => {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  return allowedOrigins.some((allowed) => normalizeOrigin(allowed) === normalized);
};
