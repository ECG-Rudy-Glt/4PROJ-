import { Response, Request } from 'express';
import crypto from 'crypto';

export const SWITCH_SESSION_COOKIE = 'sf_switch_sid';

const isHttpsEnforced = process.env.ENFORCE_HTTPS === 'true';

const cookieOptions = {
  httpOnly: true as const,
  secure: isHttpsEnforced,
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
};

export const getCookieValue = (req: Request, name: string): string | null => {
  const raw = req.headers.cookie;
  if (!raw) return null;

  const parts = raw.split(';');
  for (const part of parts) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
};

export const ensureSwitchSessionId = (req: Request, res: Response): string => {
  const existing = getCookieValue(req, SWITCH_SESSION_COOKIE);
  if (existing && existing.length >= 32) {
    return existing;
  }

  const generated = crypto.randomBytes(32).toString('hex');
  res.cookie(SWITCH_SESSION_COOKIE, generated, cookieOptions);
  return generated;
};

export const clearSwitchSessionCookie = (res: Response) => {
  res.clearCookie(SWITCH_SESSION_COOKIE, {
    ...cookieOptions,
    maxAge: undefined,
  });
};

