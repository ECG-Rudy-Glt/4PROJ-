import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { VaultService } from '../services/vaultService';
import { AuditService } from '../services/auditService';
import { sendSuccess, sendError } from '../utils/response';

export class VaultController {
  static async getStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = await VaultService.getStatus(req.user!.id);
      const rootFolder = await VaultService.getVaultRootFolder(req.user!.id);
      sendSuccess(res, { status, rootFolder });
    } catch (error) { next(error); }
  }

  static async setup(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { password, totpCode } = req.body;

      if (!password || !totpCode) {
        sendError(res, 'password et totpCode sont requis', 400);
        return;
      }

      const status = await VaultService.setupVault(userId, String(password), String(totpCode));
      await AuditService.createLog(userId, 'VAULT_SETUP', { enabled: true });
      sendSuccess(res, { status });
    } catch (error) { next(error); }
  }

  static async unlock(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { password, totpCode } = req.body;

      if (!password || !totpCode) {
        sendError(res, 'password et totpCode sont requis', 400);
        return;
      }

      const status = await VaultService.unlockVault(userId, String(password), String(totpCode));
      await AuditService.createLog(userId, 'VAULT_UNLOCK', { success: true });
      sendSuccess(res, { status });
    } catch (error) { next(error); }
  }

  static async lock(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const status = await VaultService.lockVault(userId);
      await AuditService.createLog(userId, 'VAULT_LOCK', { success: true });
      sendSuccess(res, { status });
    } catch (error) { next(error); }
  }

  static async rotatePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { oldPassword, newPassword, totpCode } = req.body;

      if (!oldPassword || !newPassword || !totpCode) {
        sendError(res, 'oldPassword, newPassword et totpCode sont requis', 400);
        return;
      }

      const status = await VaultService.rotateVaultPassword(
        userId,
        String(oldPassword),
        String(newPassword),
        String(totpCode)
      );
      await AuditService.createLog(userId, 'VAULT_PASSWORD_ROTATE', { success: true });
      sendSuccess(res, { status });
    } catch (error) { next(error); }
  }
}
