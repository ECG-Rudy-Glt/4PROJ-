import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AuthService } from '../services/authService';
import { AuthRequest } from '../types';
import { generateToken } from '../utils/jwt';
import { AuditService } from '../services/auditService';
import { validateEmail, validatePasswordStrength } from '../utils/validators';
import { mfaService } from '../services/mfaService';
import { trustedDeviceService } from '../services/trustedDeviceService';
import { AccountDeletionService } from '../services/accountDeletionService';
import { generateTempToken } from './mfaController';
import { clearSwitchSessionCookie } from '../utils/cookies';
import logger from '../config/logger';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import prisma from '../config/database';

export { UserProfileController } from './userProfileController';
export { DataExportController } from './dataExportController';

function getBearerToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  return authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
}

const OAUTH_CODE_TTL_MS = 2 * 60 * 1000;
const pendingOAuthCodes = new Map<string, { token: string; expiresAt: number }>();

function cleanupExpiredOAuthCodes(now = Date.now()): void {
  for (const [code, payload] of pendingOAuthCodes.entries()) {
    if (payload.expiresAt <= now) {
      pendingOAuthCodes.delete(code);
    }
  }
}

function createOAuthCode(token: string): string {
  cleanupExpiredOAuthCodes();
  const code = crypto.randomBytes(32).toString('base64url');
  pendingOAuthCodes.set(code, {
    token,
    expiresAt: Date.now() + OAUTH_CODE_TTL_MS,
  });
  return code;
}

function consumeOAuthCode(code: string): string | null {
  const payload = pendingOAuthCodes.get(code);
  pendingOAuthCodes.delete(code);

  if (!payload || payload.expiresAt <= Date.now()) {
    return null;
  }

  return payload.token;
}

export class AuthController {
  static async getOAuthProviders(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, {
      google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    });
  }

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
          const refreshToken = await AuthService.createRefreshToken(user.id);
          sendSuccess(res, { token: result.token, refreshToken, user: result.user });
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

  static async deleteAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AccountDeletionService.deleteAccount(req.user!.id, {
        confirmationEmail: String(req.body.confirmationEmail || ''),
        currentPassword: typeof req.body.currentPassword === 'string' ? req.body.currentPassword : undefined,
        mfaCode: typeof req.body.mfaCode === 'string' ? req.body.mfaCode : undefined,
      });

      clearSwitchSessionCookie(res);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async oauthCallback(req: AuthRequest, res: Response, _next: NextFunction): Promise<void> {
    try {
      const user = await prisma.user.update({
        where: { id: req.user!.id },
        data: { lastActiveAt: new Date() },
      });
      const token = generateToken(user.id, user.email, user.tokenVersion || 1);
      const state = typeof req.query?.state === 'string' ? req.query.state : '';
      if (state === 'mobile') {
        res.redirect(`supfile://auth/callback#token=${encodeURIComponent(token)}`);
        return;
      }
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const oauthCode = createOAuthCode(token);
      res.redirect(`${frontendUrl}/auth/callback?oauthCode=${encodeURIComponent(oauthCode)}`);
    } catch (error) {
      const msg = encodeURIComponent(error instanceof Error ? error.message : 'Unknown error');
      const state = typeof req.query?.state === 'string' ? req.query.state : '';
      if (state === 'mobile') {
        res.redirect(`supfile://auth/callback?error=${msg}`);
        return;
      }
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/callback?error=${msg}`);
    }
  }

  static async exchangeOAuthCode(req: Request, res: Response): Promise<void> {
    const oauthCode = typeof req.body?.oauthCode === 'string'
      ? req.body.oauthCode
      : typeof req.body?.code === 'string'
        ? req.body.code
        : '';

    if (!oauthCode) {
      sendError(res, 'OAuth code required', 400, 'OAUTH_CODE_REQUIRED');
      return;
    }

    const token = consumeOAuthCode(oauthCode);
    if (!token) {
      sendError(res, 'OAuth code invalid or expired', 401, 'OAUTH_CODE_INVALID');
      return;
    }

    sendSuccess(res, { token });
  }

  static async requestPasswordReset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, lang, platform } = req.body;
      if (!validateEmail(email)) {
        sendError(res, "L'adresse e-mail doit être dans un format valide (ex: nom@domaine.com)", 400);
        return;
      }

      const result = await AuthService.requestPasswordReset(email, lang, platform);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async getResetTokenInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = typeof req.body?.token === 'string' ? req.body.token : undefined;
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
      const { token, newPassword, mfaCode, forceReset } = req.body;
      if (!token || !newPassword) {
        sendError(res, 'Token et nouveau mot de passe requis', 400);
        return;
      }
      const pwdCheck = validatePasswordStrength(newPassword);
      if (!pwdCheck.valid) {
        sendError(res, pwdCheck.error!, 400);
        return;
      }

      const result = await AuthService.resetPassword(token, newPassword, mfaCode, !!forceReset);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}
