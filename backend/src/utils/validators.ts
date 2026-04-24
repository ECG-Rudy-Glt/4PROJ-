const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Vérifie qu'une chaîne est un email valide.
 */
export function validateEmail(email: unknown): email is string {
  return typeof email === 'string' && EMAIL_REGEX.test(email);
}

/**
 * Clampe un paramètre `limit` entre min et max.
 * Retourne defaultValue si la valeur est absente ou invalide.
 */
export function clampLimit(
  value: unknown,
  defaultValue: number,
  min = 0,
  max = 1000
): number {
  const n = typeof value === 'string' ? parseInt(value, 10) : Number(value);
  if (!Number.isFinite(n)) return defaultValue;
  return Math.min(Math.max(n, min), max);
}

/**
 * Tronque une query string à maxLength caractères.
 * Lance une Error si la valeur n'est pas une string.
 */
export function sanitizeQuery(value: unknown, maxLength = 100): string {
  if (typeof value !== 'string') throw new Error('Query must be a string');
  return value.slice(0, maxLength);
}

/**
 * Vérifie la force du mot de passe selon les recommandations de l'ANSSI:
 * - Au moins 12 caractères
 * - Au moins une majuscule
 * - Au moins une minuscule
 * - Au moins un chiffre
 * - Au moins un caractère spécial
 */
export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 12) {
    return { valid: false, error: 'Le mot de passe doit contenir au moins 12 caractères' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Le mot de passe doit contenir au moins une majuscule' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Le mot de passe doit contenir au moins une minuscule' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Le mot de passe doit contenir au moins un chiffre' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, error: 'Le mot de passe doit contenir au moins un caractère spécial' };
  }
  return { valid: true };
}
