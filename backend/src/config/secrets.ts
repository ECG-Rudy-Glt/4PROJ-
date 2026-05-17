const INSECURE_SECRET_VALUES = new Set([
  'your-secret-key',
  'secret',
  'super-secret-jwt-key-change-in-production-12345',
  'your-secret-key-change-in-production',
  'your-dek-wrap-secret-key-change-in-production',
  'default-secret-key-32-chars-long!!',
]);

const INSECURE_SECRET_MARKERS = [
  'change_me',
  'change-me',
  'changeme',
  'changez_moi',
  'changez-moi',
  'changezmoi',
  'password',
  'mot_de_passe',
];

type SecretOptions = {
  minLength?: number;
};

function isTestEnv(): boolean {
  return process.env.NODE_ENV === 'test';
}

function isClearlyInsecureSecret(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    INSECURE_SECRET_VALUES.has(normalized) ||
    INSECURE_SECRET_MARKERS.some((marker) => normalized.includes(marker))
  );
}

export function getRequiredSecret(name: string, options: SecretOptions = {}): string {
  const value = process.env[name]?.trim();
  const minLength = options.minLength ?? 32;

  if (!value) {
    throw new Error(`[FATAL] ${name} environment variable is required.`);
  }

  if (!isTestEnv()) {
    if (value.length < minLength) {
      throw new Error(`[FATAL] ${name} must be at least ${minLength} characters.`);
    }

    if (isClearlyInsecureSecret(value)) {
      throw new Error(`[FATAL] ${name} uses an insecure placeholder value.`);
    }
  }

  return value;
}

export function getJwtSecret(): string {
  return getRequiredSecret('JWT_SECRET');
}

export function getJwtMfaSecret(): string {
  return getRequiredSecret('JWT_MFA_SECRET');
}

export function getDekWrapSecret(): string {
  return getRequiredSecret('DEK_WRAP_SECRET');
}

export function getFileEncryptionSecret(): string {
  return getRequiredSecret('FILE_ENCRYPTION_KEY');
}

export function getOnlyOfficeJwtSecret(): string {
  return getRequiredSecret('ONLYOFFICE_JWT_SECRET');
}

export function getShareAccessSecret(): string {
  return `${getJwtSecret()}:share-access`;
}
