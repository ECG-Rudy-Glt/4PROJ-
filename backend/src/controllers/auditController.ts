import { Response } from 'express';
import { AuditService, AuditAction } from '../services/auditService';
import { AuthRequest } from '../types';

export class AuditController {
  static async getUserLogs(req: AuthRequest, res: Response): Promise<void> {
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
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getActivityStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { days } = req.query;

      const stats = await AuditService.getActivityStats(
        userId,
        days ? parseInt(String(days)) : 7
      );

      res.status(200).json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
