const REDACTED = '[REDACTED]';

const SENSITIVE_QUERY_KEYS = [
  'access_token',
  'token',
  'refreshToken',
  'refresh_token',
  'password',
  'wrappedDek',
  'wrapped_dek',
  'secret',
  'code',
];

function shouldRedactQueryKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_QUERY_KEYS.some((sensitive) => normalized.includes(sensitive.toLowerCase()));
}

function redactOnlyOfficePath(pathname: string): string {
  const segments = pathname.split('/');
  const onlyOfficeIndex = segments.indexOf('onlyoffice');
  if (onlyOfficeIndex === -1) return pathname;

  for (let index = onlyOfficeIndex; index < segments.length; index += 1) {
    const segment = segments[index];
    if ((segment === 'file' || segment === 'callback') && segments[index + 2]) {
      segments[index + 2] = REDACTED;
    }
  }

  return segments.join('/');
}

function redactHash(hash: string): string {
  if (!hash) return hash;

  const value = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(value);
  let changed = false;

  for (const key of Array.from(params.keys())) {
    if (shouldRedactQueryKey(key)) {
      params.set(key, REDACTED);
      changed = true;
    }
  }

  return changed ? `#${params.toString()}` : hash;
}

export function redactUrl(value: string | undefined): string | undefined {
  if (!value) return value;

  try {
    const isAbsolute = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value);
    const url = new URL(value, 'http://local.invalid');

    for (const key of Array.from(url.searchParams.keys())) {
      if (shouldRedactQueryKey(key)) {
        url.searchParams.set(key, REDACTED);
      }
    }

    const pathname = redactOnlyOfficePath(url.pathname);
    const output = `${pathname}${url.search}${redactHash(url.hash)}`;
    return isAbsolute ? `${url.origin}${output}` : output;
  } catch {
    return value.replace(/([?&][^=]*(token|password|secret|code|wrappedDek)[^=]*=)[^&\s]+/gi, `$1${REDACTED}`);
  }
}
