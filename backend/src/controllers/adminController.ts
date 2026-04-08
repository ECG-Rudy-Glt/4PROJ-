import { Response, NextFunction } from 'express';
import { Plan } from '@prisma/client';
import { AuthRequest } from '../types';
import { AdminService } from '../services/adminService';
import prisma from '../config/database';
import { FileIndexService } from '../services/fileIndexService';
import logger from '../config/logger';

const VALID_PLANS = new Set<Plan>([Plan.FREE, Plan.PRO, Plan.BUSINESS, Plan.ENTERPRISE]);

export class AdminController {
  static async getOverview(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const overview = await AdminService.getOverview();
      res.status(200).json(overview);
    } catch (error) { next(error); }
  }

  static async listUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
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
    } catch (error) { next(error); }
  }

  static async updateUserPlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
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
    } catch (error) { next(error); }
  }

  static async exportUsersCsv(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const rows = await AdminService.getUsersExportRows();
      const { stringify } = require('csv-stringify/sync');
      const csv = stringify(rows, { header: true });
      const fileName = `supfile-admin-users-${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.status(200).send(csv);
    } catch (error) { next(error); }
  }

  static async exportStorageCsv(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const rows = await AdminService.getStorageExportRows();
      const { stringify } = require('csv-stringify/sync');
      const csv = stringify(rows, { header: true });
      const fileName = `supfile-admin-storage-${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.status(200).send(csv);
    } catch (error) { next(error); }
  }

  static async reindexAllFiles(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const files = await prisma.file.findMany({
        where: { isDeleted: false },
        select: { id: true, userId: true, name: true },
      });

      res.status(202).json({ message: `Ré-indexation lancée pour ${files.length} fichiers.`, total: files.length });

      // Fire-and-forget after response
      (async () => {
        let indexed = 0;
        for (const file of files) {
          try {
            await FileIndexService.indexFile(file.id, file.userId);
            indexed++;
          } catch (err) {
            logger.warn({ fileId: file.id, err }, '[reindex] skipped file');
          }
        }
        logger.info(`[reindex] Done: ${indexed}/${files.length} files indexed`);
      })();
    } catch (error) { next(error); }
  }
}
