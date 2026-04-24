import { Response, NextFunction } from 'express';
import { DashboardService } from '../services/dashboardService';
import { AuthRequest } from '../types';
import { sendSuccess } from '../utils/response';

export class DashboardController {
  static async getDashboard(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const dashboardData = await DashboardService.getDashboardData(userId);
      sendSuccess(res, dashboardData);
    } catch (error) { next(error); }
  }
}
