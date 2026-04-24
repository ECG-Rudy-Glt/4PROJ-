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
 * Envoie une réponse Multi-Status (upload partiel) : { success: true, data? } avec status 207
 */
export function sendMultiStatus(res: Response, data?: object): void {
  sendSuccess(res, data, 207);
}

/**
 * Envoie une réponse d'erreur normalisée : { success: false, error, code?, ...extra? }
 */
export function sendError(res: Response, error: string, status: number, code?: string, extra?: object): void {
  const body: Record<string, unknown> = { success: false, error };
  if (code) body.code = code;
  if (extra) {
    Object.assign(body, extra);
  }
  res.status(status).json(body);
}
