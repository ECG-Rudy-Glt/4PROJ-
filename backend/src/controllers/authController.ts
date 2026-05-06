import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { AuthRequest } from '../types';
import { generateToken } from '../utils/jwt';
import { AuditService } from '../services/auditService';
import { validateEmail, validatePasswordStrength } from '../utils/validators';
import { mfaService } from '../services/mfaService';
import { trustedDeviceService } from '../services/trustedDeviceService';
import { generateTempToken } from './mfaController';
import { clearSwitchSessionCookie } from '../utils/cookies';
import logger from '../config/logger';
import { sendSuccess, sendCreated, sendError } from '../utils/response';

export { UserProfileController } from './userProfileController';
export { DataExportController } from './dataExportController';

function getBearerToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  return authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
}

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!validateEmail(email)) {
        sendError(res, "L'adresse e-mail doit être dans un format valide (ex: nom@domaine.com)", 400);
        return;
      }

      const pwdCheck = validatePasswordStrength(password);
      if (!pwdCheck.valid) {
        sendError(res, pwdCheck.error!, 400);
        return;
      }

      const result = await AuthService.register(email, password, firstName, lastName);
      const tempToken = generateTempToken(result.user.id, result.wrappedDek);
      sendCreated(res, {
        mfaSetupRequired: true,
        tempToken,
        userId: result.user.id,
        user: { email: result.user.email, firstName: result.user.firstName, lastName: result.user.lastName },
      });
    } catch (error) { next(error); }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!validateEmail(email)) {
        sendError(res, "L'adresse e-mail doit être dans un format valide (ex: nom@domaine.com)", 400);
        return;
      }

      const result = await AuthService.login(email, password);
      const user = result.user;

      const isMFAEnabled = await mfaService.isMFAEnabled(user.id);

      if (isMFAEnabled) {
        const isTrusted = await trustedDeviceService.isTrustedDeviceFromRequest(user.id, req);

        if (isTrusted) {
          await AuditService.createLog(user.id, 'LOGIN', {
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            mfaUsed: false,
            trustedDevice: true,
          });
          sendSuccess(res, { token: result.token, user: result.user });
          return;
        }

        const tempToken = generateTempToken(user.id, result.wrappedDek);
        sendSuccess(res, { mfaRequired: true, tempToken, userId: user.id });
        return;
      }

      const tempToken = generateTempToken(user.id, result.wrappedDek);
      sendSuccess(res, {
        mfaSetupRequired: true,
        tempToken,
        userId: user.id,
        user: { email: user.email, firstName: user.firstName, lastName: user.lastName },
      });
    } catch (error) {
      next(error);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken || typeof refreshToken !== 'string') {
        sendError(res, 'Refresh token requis', 400);
        return;
      }

      const result = await AuthService.rotateRefreshToken(refreshToken, getBearerToken(req));
      sendSuccess(res, result);
    } catch (error) { next(error); }
  }

  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken || typeof refreshToken !== 'string') {
        sendError(res, 'Refresh token requis', 400);
        return;
      }

      const result = await AuthService.revokeRefreshToken(refreshToken);
      sendSuccess(res, result);
    } catch (error) { next(error); }
  }

  static async logoutAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const result = await AuthService.logoutGlobal(userId);

      AuditService.createLog(userId, 'LOGOUT', {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        globalLogout: true,
      }).catch((e) => logger.error(e));
      clearSwitchSessionCookie(res);

      sendSuccess(res, result);
    } catch (error) { next(error); }
  }

  static async oauthCallback(req: AuthRequest, res: Response, _next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const token = generateToken(user.id, user.email, user.tokenVersion || 1);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
    } catch (error) {
      const msg = encodeURIComponent(error instanceof Error ? error.message : 'Unknown error');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/callback?error=${msg}`);
    }
  }

  static async requestPasswordReset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, lang } = req.body;
      if (!validateEmail(email)) {
        sendError(res, "L'adresse e-mail doit être dans un format valide (ex: nom@domaine.com)", 400);
        return;
      }

      const result = await AuthService.requestPasswordReset(email, lang);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async getResetTokenInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.query;
      if (!token || typeof token !== 'string') {
        sendError(res, 'Token manquant ou invalide', 400);
        return;
      }

      const result = await AuthService.getResetTokenInfo(token);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, newPassword, mfaCode } = req.body;
      if (!token || !newPassword) {
        sendError(res, 'Token et nouveau mot de passe requis', 400);
        return;
      }
      if (newPassword.length < 6) {
        sendError(res, 'Le mot de passe doit contenir au moins 6 caractères', 400);
        return;
      }

      const result = await AuthService.resetPassword(token, newPassword, mfaCode);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}
