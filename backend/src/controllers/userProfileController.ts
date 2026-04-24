import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { AuthService } from '../services/authService';
import { AuditService } from '../services/auditService';
import logger from '../config/logger';
import { sendSuccess, sendError } from '../utils/response';
import { validatePasswordStrength } from '../utils/validators';

export class UserProfileController {
  static async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;

      sendSuccess(res, {
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
          language: user.language,
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
      const { firstName, lastName, avatar, theme, language } = req.body;

      const user = await AuthService.updateProfile(userId, { firstName, lastName, avatar, theme, language });
      sendSuccess(res, { user });
    } catch (error) { next(error); }
  }

  static async changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { oldPassword, newPassword, mfaCode } = req.body;

      const pwdCheck = validatePasswordStrength(newPassword);
      if (!pwdCheck.valid) {
        sendError(res, pwdCheck.error!, 400);
        return;
      }

      const result = await AuthService.changePassword(userId, oldPassword, newPassword, mfaCode);

      AuditService.createLog(userId, 'PASSWORD_CHANGE', {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }).catch((e) => logger.error(e));

      sendSuccess(res, result);
    } catch (error) { next(error); }
  }

  static async uploadAvatar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const file = req.file;

      if (!file) {
        sendError(res, 'No file uploaded', 400);
        return;
      }

      const avatarUrl = `/uploads/avatars/${file.filename}`;
      const user = await AuthService.updateProfile(userId, { avatar: avatarUrl });

      sendSuccess(res, { avatarUrl, user });
    } catch (error) { next(error); }
  }
}
