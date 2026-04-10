import { Response } from 'express';

/**
 * Envoie une réponse de succès normalisée : { success: true, data? }
 */
export function sendSuccess(res: Response, data?: object, status = 200): void {
  if (data !== undefined) {
    res.status(status).json({ success: true, data });
  } else {
    res.status(status).json({ success: true });
  }
}

/**
 * Envoie une réponse de création normalisée : { success: true, data? } avec status 201
 */
export function sendCreated(res: Response, data?: object): void {
  sendSuccess(res, data, 201);
}

/**
 * Envoie une réponse d'erreur normalisée : { success: false, error, code? }
 */
export function sendError(res: Response, error: string, status: number, code?: string): void {
  const body: Record<string, unknown> = { success: false, error };
  if (code) body.code = code;
  res.status(status).json(body);
}
