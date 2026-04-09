import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { AuthService } from '../services/authService';
import { AuditService } from '../services/auditService';
import logger from '../config/logger';

export class UserProfileController {
  static async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;

      res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
          role: user.role,
          accountStatus: user.accountStatus,
          plan: user.plan,
          subscriptionStatus: user.subscriptionStatus,
          vaultEnabled: user.vaultEnabled,
          currentOrganizationId: user.currentOrganizationId,
          quotaUsed: Number(user.quotaUsed),
          quotaLimit: Number(user.quotaLimit),
          theme: user.theme,
          createdAt: user.createdAt,
        },
        session: {
          authType: req.authContext?.authType || 'DIRECT',
          rootUserId: req.authContext?.rootUserId || user.id,
          actorUserId: req.authContext?.actorUserId || user.id,
          delegation: req.authContext?.delegation || null,
        },
      });
    } catch (error) { next(error); }
  }

  static async updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { firstName, lastName, avatar, theme } = req.body;

      const user = await AuthService.updateProfile(userId, { firstName, lastName, avatar, theme });
      res.status(200).json({ user });
    } catch (error) { next(error); }
  }

  static async changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { oldPassword, newPassword } = req.body;

      const result = await AuthService.changePassword(userId, oldPassword, newPassword);

      AuditService.createLog(userId, 'PASSWORD_CHANGE', {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }).catch((e) => logger.error(e));

      res.status(200).json(result);
    } catch (error) { next(error); }
  }

  static async uploadAvatar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const avatarUrl = `/uploads/avatars/${file.filename}`;
      const user = await AuthService.updateProfile(userId, { avatar: avatarUrl });

      res.status(200).json({ avatarUrl, user });
    } catch (error) { next(error); }
  }
}
