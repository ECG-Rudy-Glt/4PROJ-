import { Response, NextFunction } from 'express';
import { DashboardService } from '../services/dashboardService';
import { AuthRequest } from '../types';

export class DashboardController {
  static async getDashboard(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const dashboardData = await DashboardService.getDashboardData(userId);

      res.status(200).json(dashboardData);
    } catch (error) { next(error); }
  }
}
