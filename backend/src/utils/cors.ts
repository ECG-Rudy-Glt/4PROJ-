const DEFAULT_LOCAL_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

export const normalizeOrigin = (origin: string) => origin.replace(/\/+$/, '');

const splitOriginList = (value?: string) => (value || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const buildHostIpOrigins = (): string[] => {
  const hostIp = process.env.HOST_IP?.trim();
  if (!hostIp || hostIp === 'localhost' || hostIp === '127.0.0.1') {
    return [];
  }

  const frontendPort = process.env.FRONTEND_PORT || '3000';
  return [`http://${hostIp}:${frontendPort}`];
};

export const buildAllowedOrigins = (): string[] => {
  const frontendUrls = splitOriginList(process.env.FRONTEND_URL || 'http://localhost:3000');
  const fromEnv = splitOriginList(process.env.CORS_ALLOWED_ORIGINS);
  const hostIpOrigins = buildHostIpOrigins();

  const combined = [...frontendUrls, ...DEFAULT_LOCAL_ORIGINS, ...hostIpOrigins, ...fromEnv];
  const unique = Array.from(new Set(combined.map(normalizeOrigin)));
  return unique;
};

export const isOriginAllowed = (allowedOrigins: string[], origin?: string | null): boolean => {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  return allowedOrigins.some((allowed) => normalizeOrigin(allowed) === normalized);
};
