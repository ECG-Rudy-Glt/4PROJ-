import { Response, NextFunction } from 'express';
import { AuditService, AuditAction } from '../services/auditService';
import { AuthRequest } from '../types';
import { clampLimit } from '../utils/validators';
import { sendCsv, csvFilename } from '../utils/csvExporter';

export class AuditController {
  static async getUserLogs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { limit, offset, action, dateFrom, dateTo } = req.query;

      const options = {
        limit: clampLimit(limit, 50),
        offset: clampLimit(offset, 0),
        action: action as AuditAction | undefined,
        dateFrom: dateFrom ? new Date(String(dateFrom)) : undefined,
        dateTo: dateTo ? new Date(String(dateTo)) : undefined,
      };

      const result = await AuditService.getUserLogs(userId, options);

      res.status(200).json(result);
    } catch (error) { next(error); }
  }

  static async getActivityStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { days } = req.query;

      const stats = await AuditService.getActivityStats(
        userId,
        clampLimit(days, 7, 1, 365)
      );

      res.status(200).json(stats);
    } catch (error) { next(error); }
  }

  static async exportUserLogsCsv(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { logs } = await AuditService.getUserLogs(userId, {
        limit: 5000,
        offset: 0,
      });

      const rows = logs.map((log) => ({
        id: log.id,
        action: log.action,
        date: log.createdAt.toISOString(),
        details: JSON.stringify(log.details || {}),
      }));

      sendCsv(res, rows, csvFilename('supfile-activity'));
    } catch (error) { next(error); }
  }
}
