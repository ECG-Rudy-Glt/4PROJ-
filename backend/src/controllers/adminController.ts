import { Response } from 'express';
import { Plan } from '@prisma/client';
import { AuthRequest } from '../types';
import { AdminService } from '../services/adminService';

const VALID_PLANS = new Set<Plan>([Plan.FREE, Plan.PRO, Plan.BUSINESS, Plan.ENTERPRISE]);

export class AdminController {
  static async getOverview(req: AuthRequest, res: Response): Promise<void> {
    try {
      const overview = await AdminService.getOverview();
      res.status(200).json(overview);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async listUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { page, limit, search, plan } = req.query;
      const requestedPlan = typeof plan === 'string' ? (plan.toUpperCase() as Plan) : undefined;

      if (requestedPlan && !VALID_PLANS.has(requestedPlan)) {
        res.status(400).json({ error: 'Invalid plan filter' });
        return;
      }

      const users = await AdminService.listUsers({
        page: page ? parseInt(String(page), 10) : undefined,
        limit: limit ? parseInt(String(limit), 10) : undefined,
        search: typeof search === 'string' ? search : undefined,
        plan: requestedPlan,
      });

      res.status(200).json(users);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateUserPlan(req: AuthRequest, res: Response): Promise<void> {
    try {
      const adminUserId = req.user!.id;
      const { userId } = req.params;
      const plan = typeof req.body.plan === 'string' ? req.body.plan.toUpperCase() as Plan : undefined;

      if (!plan || !VALID_PLANS.has(plan)) {
        res.status(400).json({ error: 'Invalid plan' });
        return;
      }

      const updatedUser = await AdminService.updateUserPlan(adminUserId, userId, plan);
      res.status(200).json({ user: updatedUser });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async exportUsersCsv(req: AuthRequest, res: Response): Promise<void> {
    try {
      const rows = await AdminService.getUsersExportRows();
      const { stringify } = require('csv-stringify/sync');
      const csv = stringify(rows, { header: true });
      const fileName = `supfile-admin-users-${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.status(200).send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async exportStorageCsv(req: AuthRequest, res: Response): Promise<void> {
    try {
      const rows = await AdminService.getStorageExportRows();
      const { stringify } = require('csv-stringify/sync');
      const csv = stringify(rows, { header: true });
      const fileName = `supfile-admin-storage-${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.status(200).send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
