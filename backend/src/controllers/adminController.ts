import { Response, NextFunction } from 'express';
import { Plan } from '@prisma/client';
import { AuthRequest } from '../types';
import { AdminService } from '../services/adminService';
import prisma from '../config/database';
import { FileIndexService } from '../services/fileIndexService';
import logger from '../config/logger';
import { sendCsv, csvFilename } from '../utils/csvExporter';
import { sendSuccess, sendError } from '../utils/response';

const VALID_PLANS = new Set<Plan>([Plan.FREE, Plan.PRO, Plan.BUSINESS, Plan.ENTERPRISE]);
type AdminAccountStatus = 'ACTIVE' | 'SUSPENDED';
const VALID_ACCOUNT_STATUSES = new Set<AdminAccountStatus>(['ACTIVE', 'SUSPENDED']);

export class AdminController {
  static async getOverview(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const overview = await AdminService.getOverview();
      sendSuccess(res, overview);
    } catch (error) { next(error); }
  }

  static async listUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, search, plan } = req.query;
      const requestedPlan = typeof plan === 'string' ? (plan.toUpperCase() as Plan) : undefined;

      if (requestedPlan && !VALID_PLANS.has(requestedPlan)) {
        sendError(res, 'Invalid plan filter', 400);
        return;
      }

      const users = await AdminService.listUsers({
        page: page ? parseInt(String(page), 10) : undefined,
        limit: limit ? parseInt(String(limit), 10) : undefined,
        search: typeof search === 'string' ? search : undefined,
        plan: requestedPlan,
      });

      sendSuccess(res, users);
    } catch (error) { next(error); }
  }

  static async updateUserPlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminUserId = req.user!.id;
      const { userId } = req.params;
      const plan = typeof req.body.plan === 'string' ? req.body.plan.toUpperCase() as Plan : undefined;

      if (!plan || !VALID_PLANS.has(plan)) {
        sendError(res, 'Invalid plan', 400);
        return;
      }

      const updatedUser = await AdminService.updateUserPlan(adminUserId, userId, plan);
      sendSuccess(res, { user: updatedUser });
    } catch (error) { next(error); }
  }

  static async updateUserStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminUserId = req.user!.id;
      const { userId } = req.params;
      const status = typeof req.body.status === 'string'
        ? req.body.status.toUpperCase() as AdminAccountStatus
        : undefined;
      const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : undefined;

      if (!status || !VALID_ACCOUNT_STATUSES.has(status)) {
        sendError(res, 'Invalid account status', 400);
        return;
      }

      const updatedUser = await AdminService.updateUserStatus(adminUserId, userId, status, reason || undefined);
      sendSuccess(res, { user: updatedUser });
    } catch (error) { next(error); }
  }

  static async exportUsersCsv(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const rows = await AdminService.getUsersExportRows();
      sendCsv(res, rows, csvFilename('supfile-admin-users'));
    } catch (error) { next(error); }
  }

  static async exportStorageCsv(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const rows = await AdminService.getStorageExportRows();
      sendCsv(res, rows, csvFilename('supfile-admin-storage'));
    } catch (error) { next(error); }
  }

  static async reindexAllFiles(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const files = await prisma.file.findMany({
        where: { isDeleted: false },
        select: { id: true, userId: true, name: true },
      });

      res.status(202).json({
        success: true,
        data: { message: `Ré-indexation lancée pour ${files.length} fichiers.`, total: files.length },
      });

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
