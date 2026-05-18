import { Response } from 'express';
import type { AuthRequest } from '../types';
import { sendError } from './response';

export const DEK_UNLOCK_REQUIRED = 'DEK_UNLOCK_REQUIRED';

export function requiresDekUnlock(req: AuthRequest): boolean {
  return Boolean(req.user?.encryptedDek && !req.dekBuffer);
}

export function ensureDekUnlocked(req: AuthRequest, res: Response): boolean {
  if (!requiresDekUnlock(req)) return true;

  sendError(
    res,
    'Le compte utilise un chiffrement utilisateur et doit etre deverrouille avant cette operation.',
    401,
    DEK_UNLOCK_REQUIRED
  );
  return false;
}
