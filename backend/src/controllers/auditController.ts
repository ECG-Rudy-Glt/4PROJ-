import { Response, NextFunction } from 'express';
import { AuditService, AuditAction } from '../services/auditService';
import { AuthRequest } from '../types';

export class AuditController {
  static async getUserLogs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { limit, offset, action, dateFrom, dateTo } = req.query;

      const options = {
        limit: limit ? parseInt(String(limit)) : 50,
        offset: offset ? parseInt(String(offset)) : 0,
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
        days ? parseInt(String(days)) : 7
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

      const { stringify } = require('csv-stringify/sync');
      const csv = stringify(rows, { header: true });
      const fileName = `supfile-activity-${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.status(200).send(csv);
    } catch (error) { next(error); }
  }
}
