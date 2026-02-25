import { Response } from 'express';
import { AuthRequest } from '../types';
import { VaultService } from '../services/vaultService';
import { AuditService } from '../services/auditService';

export class VaultController {
  static async getStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const status = await VaultService.getStatus(req.user!.id);
      const rootFolder = await VaultService.getVaultRootFolder(req.user!.id);
      res.status(200).json({ status, rootFolder });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async setup(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { password, totpCode } = req.body;

      if (!password || !totpCode) {
        res.status(400).json({ error: 'password et totpCode sont requis' });
        return;
      }

      const status = await VaultService.setupVault(userId, String(password), String(totpCode));
      await AuditService.createLog(userId, 'VAULT_SETUP', { enabled: true });
      res.status(200).json({ status });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async unlock(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { password, totpCode } = req.body;
      if (!password || !totpCode) {
        res.status(400).json({ error: 'password et totpCode sont requis' });
        return;
      }

      const status = await VaultService.unlockVault(userId, String(password), String(totpCode));
      await AuditService.createLog(userId, 'VAULT_UNLOCK', { success: true });
      res.status(200).json({ status });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async lock(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const status = await VaultService.lockVault(userId);
      await AuditService.createLog(userId, 'VAULT_LOCK', { success: true });
      res.status(200).json({ status });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async rotatePassword(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { oldPassword, newPassword, totpCode } = req.body;
      if (!oldPassword || !newPassword || !totpCode) {
        res.status(400).json({ error: 'oldPassword, newPassword et totpCode sont requis' });
        return;
      }

      const status = await VaultService.rotateVaultPassword(
        userId,
        String(oldPassword),
        String(newPassword),
        String(totpCode)
      );
      await AuditService.createLog(userId, 'VAULT_PASSWORD_ROTATE', { success: true });
      res.status(200).json({ status });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}
