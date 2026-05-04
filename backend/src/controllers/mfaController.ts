import { Request, Response, NextFunction } from 'express';
import { mfaService } from '../services/mfaService';
import { trustedDeviceService } from '../services/trustedDeviceService';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import type { AuthRequest } from '../types';
import { KekService } from '../services/kekService';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_MFA_SECRET = process.env.JWT_MFA_SECRET || (JWT_SECRET + '_mfa');
const TEMP_TOKEN_EXPIRY = '5m'; // Token temporaire valide 5 minutes

/**
 * Génère un token temporaire pour la phase MFA
 */
function generateTempToken(userId: string, wrappedDek?: string): string {
  return jwt.sign(
    { userId, type: 'mfa', ...(wrappedDek ? { wrappedDek } : {}) },
    JWT_MFA_SECRET,
    { expiresIn: TEMP_TOKEN_EXPIRY }
  );
}

import { generateToken } from '../utils/jwt';
import { sendSuccess, sendError } from '../utils/response';

function getWrappedDekFromRequest(req: AuthRequest): string | undefined {
  if (req.wrappedDek) return req.wrappedDek;
  if (!req.dekBuffer) return undefined;
  return KekService.wrapDek(req.dekBuffer);
}

/**
 * Contrôleur MFA
 */
export class MFAController {
  /**
   * POST /api/mfa/setup
   * Génère le secret TOTP et le QR code pour la configuration initiale
   */
  async setupMFA(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const userId = user.id;

      const isMFAEnabled = await mfaService.isMFAEnabled(userId);
      if (isMFAEnabled) {
        sendError(res, 'MFA est déjà activé', 400);
        return;
      }

      const { secret, qrCodeDataUrl, backupCodes } = await mfaService.generateMFASecret(
        userId,
        user.email
      );

      sendSuccess(res, { secret, qrCodeDataUrl, backupCodes });
    } catch (error) { next(error); }
  }

  /**
   * POST /api/mfa/verify-setup
   * Vérifie le code initial et active le MFA
   */
  async verifySetup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const userId = user.id;
      const { token, secret, backupCodes, rememberDevice } = req.body;

      if (!token || !secret || !backupCodes) {
        sendError(res, 'Token, secret et codes de récupération requis', 400);
        return;
      }

      const isValid = mfaService.verifyTOTPCode(secret, token);
      if (!isValid) {
        sendError(res, 'Code invalide', 401);
        return;
      }

      await mfaService.enableMFA(userId, secret, backupCodes);

      if (rememberDevice) {
        await trustedDeviceService.createTrustedDevice(userId, req);
      }

      const wrappedDek = getWrappedDekFromRequest(req as AuthRequest);
      const authToken = generateToken(user.id, user.email, user.tokenVersion || 1, { wrappedDek });

      sendSuccess(res, { message: 'MFA activé avec succès', token: authToken });
    } catch (error) { next(error); }
  }

  /**
   * POST /api/mfa/verify
   * Vérifie le code TOTP lors de la connexion
   */
  async verifyMFA(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { token, rememberDevice } = req.body;

      if (!token) {
        sendError(res, 'token requis', 400);
        return;
      }

      const isValid = await mfaService.verifyUserTOTPCode(userId, token);
      if (!isValid) {
        sendError(res, 'Code invalide', 401);
        return;
      }

      if (rememberDevice) {
        await trustedDeviceService.createTrustedDevice(userId, req);
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatar: true,
          theme: true,
          quotaUsed: true,
          quotaLimit: true,
          createdAt: true,
          // @ts-ignore
          tokenVersion: true,
        },
      });

      const wrappedDek = getWrappedDekFromRequest(req as AuthRequest);
      const authToken = generateToken(user.id, user.email, user.tokenVersion || 1, { wrappedDek });

      sendSuccess(res, { message: 'Authentification réussie', token: authToken, user });
    } catch (error) { next(error); }
  }

  /**
   * POST /api/mfa/verify-backup-code
   * Vérifie un code de récupération
   */
  async verifyBackupCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { backupCode, rememberDevice } = req.body;

      if (!backupCode) {
        sendError(res, 'backupCode requis', 400);
        return;
      }

      const isValid = await mfaService.verifyBackupCode(userId, backupCode);
      if (!isValid) {
        sendError(res, 'Code de récupération invalide ou déjà utilisé', 401);
        return;
      }

      if (rememberDevice) {
        await trustedDeviceService.createTrustedDevice(userId, req);
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatar: true,
          theme: true,
          quotaUsed: true,
          quotaLimit: true,
          createdAt: true,
          // @ts-ignore
          tokenVersion: true,
        },
      });

      const wrappedDek = getWrappedDekFromRequest(req as AuthRequest);
      const authToken = generateToken(user.id, user.email, user.tokenVersion || 1, { wrappedDek });

      const remainingCodes = await mfaService.getRemainingBackupCodesCount(userId);

      sendSuccess(res, {
        message: 'Authentification réussie',
        token: authToken,
        user,
        warning: remainingCodes === 0
          ? 'Vous avez utilisé votre dernier code de récupération. Veuillez en générer de nouveaux.'
          : remainingCodes < 3
            ? `Il vous reste ${remainingCodes} code(s) de récupération.`
            : null,
      });
    } catch (error) { next(error); }
  }

  /**
   * POST /api/mfa/regenerate-codes
   * Régénère les codes de récupération
   */
  async regenerateBackupCodes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { token } = req.body;

      if (!token) {
        sendError(res, 'Code TOTP requis pour régénérer les codes', 400);
        return;
      }

      const isValid = await mfaService.verifyUserTOTPCode(userId, token);
      if (!isValid) {
        sendError(res, 'Code invalide', 401);
        return;
      }

      const backupCodes = await mfaService.regenerateBackupCodes(userId);

      sendSuccess(res, { message: 'Codes de récupération régénérés avec succès', backupCodes });
    } catch (error) { next(error); }
  }

  /**
   * GET /api/mfa/trusted-devices
   * Liste les appareils de confiance
   */
  async getTrustedDevices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const devices = await trustedDeviceService.getUserTrustedDevices(userId);
      sendSuccess(res, { devices });
    } catch (error) { next(error); }
  }

  /**
   * DELETE /api/mfa/trusted-devices/:deviceId
   * Révoque un appareil de confiance
   */
  async revokeTrustedDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { deviceId } = req.params;

      if (!deviceId) {
        sendError(res, 'deviceId requis', 400);
        return;
      }

      await trustedDeviceService.revokeTrustedDevice(userId, deviceId);
      sendSuccess(res, { message: 'Appareil révoqué avec succès' });
    } catch (error) { next(error); }
  }

  /**
   * POST /api/mfa/disable
   * Désactive le MFA
   */
  async disableMFA(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { token } = req.body;

      if (!token) {
        sendError(res, 'Code TOTP requis pour désactiver le MFA', 400);
        return;
      }

      const isValid = await mfaService.verifyUserTOTPCode(userId, token);
      if (!isValid) {
        sendError(res, 'Code invalide', 401);
        return;
      }

      await mfaService.disableMFA(userId);
      sendSuccess(res, { message: 'MFA désactivé avec succès' });
    } catch (error) { next(error); }
  }

  /**
   * GET /api/mfa/status
   * Vérifie le statut MFA de l'utilisateur
   */
  async getMFAStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          mfaEnabled: true,
          mfaSetupAt: true,
          mfaBackupCodes: true,
        },
      });

      if (!user) {
        sendError(res, 'Utilisateur non trouvé', 404);
        return;
      }

      const activeTrustedDevices = await trustedDeviceService.countActiveTrustedDevices(userId);

      sendSuccess(res, {
        mfaEnabled: user.mfaEnabled,
        mfaSetupAt: user.mfaSetupAt,
        remainingBackupCodes: user.mfaBackupCodes?.length || 0,
        activeTrustedDevices,
      });
    } catch (error) { next(error); }
  }
}

export const mfaController = new MFAController();
export { generateTempToken };
