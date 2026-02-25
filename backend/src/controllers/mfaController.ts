import { Request, Response } from 'express';
import { mfaService } from '../services/mfaService';
import { trustedDeviceService } from '../services/trustedDeviceService';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const TEMP_TOKEN_EXPIRY = '5m'; // Token temporaire valide 5 minutes

/**
 * Génère un token temporaire pour la phase MFA
 */
function generateTempToken(userId: string): string {
  return jwt.sign({ userId, temp: true }, JWT_SECRET, { expiresIn: TEMP_TOKEN_EXPIRY });
}

import { generateToken } from '../utils/jwt';

/**
 * Contrôleur MFA
 */
export class MFAController {
  /**
   * POST /api/mfa/setup
   * Génère le secret TOTP et le QR code pour la configuration initiale
   */
  async setupMFA(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const userId = user.id;

      // Vérifier si le MFA est déjà activé
      const isMFAEnabled = await mfaService.isMFAEnabled(userId);
      if (isMFAEnabled) {
        res.status(400).json({ error: 'MFA est déjà activé' });
        return;
      }

      // Générer le secret et le QR code
      const { secret, qrCodeDataUrl, backupCodes } = await mfaService.generateMFASecret(
        userId,
        user.email
      );

      // Stocker temporairement le secret et les codes dans la session/response
      // (ne pas les activer tout de suite, attendre la vérification)
      res.json({
        secret,
        qrCodeDataUrl,
        backupCodes,
      });
    } catch (error: any) {
      console.error('Error in setupMFA:', error);
      res.status(500).json({ error: error.message || 'Échec de la configuration MFA' });
    }
  }

  /**
   * POST /api/mfa/verify-setup
   * Vérifie le code initial et active le MFA
   */
  async verifySetup(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const userId = user.id;
      const { token, secret, backupCodes, rememberDevice } = req.body;

      if (!token || !secret || !backupCodes) {
        res.status(400).json({ error: 'Token, secret et codes de récupération requis' });
        return;
      }

      // Vérifier le code TOTP
      const isValid = mfaService.verifyTOTPCode(secret, token);
      if (!isValid) {
        res.status(400).json({ error: 'Code invalide' });
        return;
      }

      // Activer le MFA
      await mfaService.enableMFA(userId, secret, backupCodes);

      // Si "remember device", créer un appareil de confiance
      if (rememberDevice) {
        await trustedDeviceService.createTrustedDevice(userId, req);
      }

      // Générer un token permanent
      // @ts-ignore
      const authToken = generateToken(user.id, user.email, user.tokenVersion || 1);

      res.json({
        message: 'MFA activé avec succès',
        token: authToken,
      });
    } catch (error: any) {
      console.error('Error in verifySetup:', error);
      res.status(500).json({ error: error.message || 'Échec de la vérification' });
    }
  }

  /**
   * POST /api/mfa/verify
   * Vérifie le code TOTP lors de la connexion
   */
  async verifyMFA(req: Request, res: Response): Promise<void> {
    try {
      const { userId, token, rememberDevice } = req.body;

      if (!userId || !token) {
        res.status(400).json({ error: 'userId et token requis' });
        return;
      }

      // Vérifier le code TOTP
      const isValid = await mfaService.verifyUserTOTPCode(userId, token);
      if (!isValid) {
        res.status(400).json({ error: 'Code invalide' });
        return;
      }

      // Si "remember device", créer un appareil de confiance
      if (rememberDevice) {
        await trustedDeviceService.createTrustedDevice(userId, req);
      }

      // Récupérer les infos utilisateur
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

      // Générer un token permanent
      // @ts-ignore
      const authToken = generateToken(user.id, user.email, user.tokenVersion || 1);

      res.json({
        message: 'Authentification réussie',
        token: authToken,
        user,
      });
    } catch (error: any) {
      console.error('Error in verifyMFA:', error);
      res.status(500).json({ error: error.message || 'Échec de la vérification' });
    }
  }

  /**
   * POST /api/mfa/verify-backup-code
   * Vérifie un code de récupération
   */
  async verifyBackupCode(req: Request, res: Response): Promise<void> {
    try {
      const { userId, backupCode, rememberDevice } = req.body;

      if (!userId || !backupCode) {
        res.status(400).json({ error: 'userId et backupCode requis' });
        return;
      }

      // Vérifier le code de récupération
      const isValid = await mfaService.verifyBackupCode(userId, backupCode);
      if (!isValid) {
        res.status(400).json({ error: 'Code de récupération invalide ou déjà utilisé' });
        return;
      }

      // Si "remember device", créer un appareil de confiance
      if (rememberDevice) {
        await trustedDeviceService.createTrustedDevice(userId, req);
      }

      // Récupérer les infos utilisateur
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

      // Générer un token permanent
      // @ts-ignore
      const authToken = generateToken(user.id, user.email, user.tokenVersion || 1);

      // Vérifier le nombre de codes restants
      const remainingCodes = await mfaService.getRemainingBackupCodesCount(userId);

      res.json({
        message: 'Authentification réussie',
        token: authToken,
        user,
        warning: remainingCodes === 0
          ? 'Vous avez utilisé votre dernier code de récupération. Veuillez en générer de nouveaux.'
          : remainingCodes < 3
            ? `Il vous reste ${remainingCodes} code(s) de récupération.`
            : null,
      });
    } catch (error: any) {
      console.error('Error in verifyBackupCode:', error);
      res.status(500).json({ error: error.message || 'Échec de la vérification' });
    }
  }

  /**
   * POST /api/mfa/regenerate-codes
   * Régénère les codes de récupération
   */
  async regenerateBackupCodes(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { token } = req.body;

      if (!token) {
        res.status(400).json({ error: 'Code TOTP requis pour régénérer les codes' });
        return;
      }

      // Vérifier le code TOTP pour sécuriser l'opération
      const isValid = await mfaService.verifyUserTOTPCode(userId, token);
      if (!isValid) {
        res.status(400).json({ error: 'Code invalide' });
        return;
      }

      // Régénérer les codes
      const backupCodes = await mfaService.regenerateBackupCodes(userId);

      res.json({
        message: 'Codes de récupération régénérés avec succès',
        backupCodes,
      });
    } catch (error: any) {
      console.error('Error in regenerateBackupCodes:', error);
      res.status(500).json({ error: error.message || 'Échec de la régénération' });
    }
  }

  /**
   * GET /api/mfa/trusted-devices
   * Liste les appareils de confiance
   */
  async getTrustedDevices(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;

      const devices = await trustedDeviceService.getUserTrustedDevices(userId);

      res.json({ devices });
    } catch (error: any) {
      console.error('Error in getTrustedDevices:', error);
      res.status(500).json({ error: error.message || 'Échec de la récupération des appareils' });
    }
  }

  /**
   * DELETE /api/mfa/trusted-devices/:deviceId
   * Révoque un appareil de confiance
   */
  async revokeTrustedDevice(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { deviceId } = req.params;

      if (!deviceId) {
        res.status(400).json({ error: 'deviceId requis' });
        return;
      }

      await trustedDeviceService.revokeTrustedDevice(userId, deviceId);

      res.json({ message: 'Appareil révoqué avec succès' });
    } catch (error: any) {
      console.error('Error in revokeTrustedDevice:', error);
      res.status(500).json({ error: error.message || 'Échec de la révocation' });
    }
  }

  /**
   * POST /api/mfa/disable
   * Désactive le MFA
   */
  async disableMFA(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { token } = req.body;

      if (!token) {
        res.status(400).json({ error: 'Code TOTP requis pour désactiver le MFA' });
        return;
      }

      // Vérifier le code TOTP
      const isValid = await mfaService.verifyUserTOTPCode(userId, token);
      if (!isValid) {
        res.status(400).json({ error: 'Code invalide' });
        return;
      }

      // Désactiver le MFA
      await mfaService.disableMFA(userId);

      res.json({ message: 'MFA désactivé avec succès' });
    } catch (error: any) {
      console.error('Error in disableMFA:', error);
      res.status(500).json({ error: error.message || 'Échec de la désactivation' });
    }
  }

  /**
   * GET /api/mfa/status
   * Vérifie le statut MFA de l'utilisateur
   */
  async getMFAStatus(req: Request, res: Response): Promise<void> {
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
        res.status(404).json({ error: 'Utilisateur non trouvé' });
        return;
      }

      const activeTrustedDevices = await trustedDeviceService.countActiveTrustedDevices(userId);

      res.json({
        mfaEnabled: user.mfaEnabled,
        mfaSetupAt: user.mfaSetupAt,
        remainingBackupCodes: user.mfaBackupCodes?.length || 0,
        activeTrustedDevices,
      });
    } catch (error: any) {
      console.error('Error in getMFAStatus:', error);
      res.status(500).json({ error: error.message || 'Échec de la récupération du statut' });
    }
  }
}

export const mfaController = new MFAController();
export { generateTempToken };
