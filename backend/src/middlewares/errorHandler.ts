import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { PlanService, PlanUpgradeRequiredError } from '../services/planService';
import { redactUrl } from '../utils/redaction';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof PlanUpgradeRequiredError) {
    res.status(403).json({
      success: false,
      error: err.message,
      code: err.code,
      ...PlanService.getUpgradeRequirement(err.feature),
    });
    return;
  }

  if (err instanceof AppError) {
    const body: Record<string, unknown> = { error: err.message };
    if (err.code) body.code = err.code;
    if (err.statusCode >= 500) {
      logger.error({ err, method: req.method, url: redactUrl(req.originalUrl) }, err.message);
    } else {
      logger.warn({ statusCode: err.statusCode, method: req.method, url: redactUrl(req.originalUrl) }, err.message);
    }
    res.status(err.statusCode).json(body);
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    logger.error({ err, method: req.method, url: redactUrl(req.originalUrl) }, message);
  }

  res.status(status).json({ error: status >= 500 ? 'Internal server error' : message });
}
