import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { AuthRequest } from '../types';
import { generateToken } from '../utils/jwt';
import { AuditService } from '../services/auditService';
import { mfaService } from '../services/mfaService';
import { trustedDeviceService } from '../services/trustedDeviceService';
import { generateTempToken } from './mfaController';
import prisma from '../config/database';

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, firstName, lastName } = req.body;

      const result = await AuthService.register(email, password, firstName, lastName);

      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      const result = await AuthService.login(email, password);
      const user = result.user;

      // Vérifier si le MFA est activé
      const isMFAEnabled = await mfaService.isMFAEnabled(user.id);

      if (isMFAEnabled) {
        // Vérifier si l'appareil est de confiance
        const isTrusted = await trustedDeviceService.isTrustedDeviceFromRequest(user.id, req);

        if (isTrusted) {
          // Appareil de confiance : connexion directe
          await AuditService.createLog(user.id, 'LOGIN', {
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            mfaUsed: false,
            trustedDevice: true,
          });

          res.status(200).json(result);
          return;
        } else {
          // MFA requis : retourner un token temporaire
          const tempToken = generateTempToken(user.id);

          res.status(200).json({
            mfaRequired: true,
            tempToken,
            userId: user.id,
          });
          return;
        }
      } else {
        // MFA non activé : setup obligatoire
        const tempToken = generateTempToken(user.id);

        res.status(200).json({
          mfaSetupRequired: true,
          tempToken,
          userId: user.id,
          user: {
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
        });
        return;
      }
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  }

  static async getProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;

      res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
          quotaUsed: user.quotaUsed,
          quotaLimit: user.quotaLimit,
          theme: user.theme,
          createdAt: user.createdAt,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { firstName, lastName, avatar, theme } = req.body;

      const user = await AuthService.updateProfile(userId, {
        firstName,
        lastName,
        avatar,
        theme,
      });

      res.status(200).json({ user });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async changePassword(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { oldPassword, newPassword } = req.body;

      const result = await AuthService.changePassword(userId, oldPassword, newPassword);

      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async oauthCallback(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const token = generateToken(user.id, user.email);

      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
    } catch (error: any) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/callback?error=${error.message}`);
    }
  }

  static async uploadAvatar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      // Generate avatar URL
      const avatarUrl = `/uploads/avatars/${file.filename}`;

      // Update user profile with new avatar
      const user = await AuthService.updateProfile(userId, {
        avatar: avatarUrl,
      });

      res.status(200).json({ avatarUrl, user });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async exportUserData(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      // Récupérer toutes les données de l'utilisateur
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          files: {
            select: {
              id: true,
              name: true,
              size: true,
              mimeType: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          folders: {
            select: {
              id: true,
              name: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          sharedLinks: {
            select: {
              id: true,
              token: true,
              expiresAt: true,
              createdAt: true,
            },
          },
          trustedDevices: {
            select: {
              id: true,
              deviceName: true,
              ipAddress: true,
              createdAt: true,
              expiresAt: true,
              lastUsedAt: true,
            },
          },
        },
      });

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Formater les tailles de fichiers en GB
      const formatBytes = (bytes: bigint) => {
        const gb = Number(bytes) / (1024 * 1024 * 1024);
        return `${gb.toFixed(2)} GB`;
      };

      // Préparer les données pour l'export (supprimer les champs sensibles)
      const exportData = {
        exportMetadata: {
          exportDate: new Date().toISOString(),
          exportVersion: '1.0',
          platform: 'SUPFILE - Stockage Cloud Sécurisé',
        },
        userProfile: {
          userId: user.id,
          email: user.email,
          personalInfo: {
            firstName: user.firstName || 'Non renseigné',
            lastName: user.lastName || 'Non renseigné',
          },
          preferences: {
            theme: user.theme,
          },
          storage: {
            quotaUsed: formatBytes(user.quotaUsed),
            quotaUsedBytes: user.quotaUsed.toString(),
            quotaLimit: formatBytes(user.quotaLimit),
            quotaLimitBytes: user.quotaLimit.toString(),
            percentageUsed: `${((Number(user.quotaUsed) / Number(user.quotaLimit)) * 100).toFixed(2)}%`,
          },
          accountCreatedAt: user.createdAt.toISOString(),
          lastUpdatedAt: user.updatedAt.toISOString(),
        },
        security: {
          multiFactorAuthentication: {
            enabled: user.mfaEnabled,
            setupDate: user.mfaSetupAt?.toISOString() || null,
          },
          trustedDevices: {
            count: user.trustedDevices.length,
            devices: user.trustedDevices.map(device => ({
              deviceName: device.deviceName,
              ipAddress: device.ipAddress,
              addedAt: device.createdAt.toISOString(),
              expiresAt: device.expiresAt.toISOString(),
              lastUsedAt: device.lastUsedAt.toISOString(),
            })),
          },
        },
        files: {
          totalCount: user.files.length,
          items: user.files.map(file => ({
            name: file.name,
            size: `${(Number(file.size) / (1024 * 1024)).toFixed(2)} MB`,
            sizeBytes: file.size.toString(),
            type: file.mimeType,
            createdAt: file.createdAt.toISOString(),
            lastModifiedAt: file.updatedAt.toISOString(),
          })),
        },
        folders: {
          totalCount: user.folders.length,
          items: user.folders.map(folder => ({
            name: folder.name,
            createdAt: folder.createdAt.toISOString(),
            lastModifiedAt: folder.updatedAt.toISOString(),
          })),
        },
        sharedLinks: {
          totalCount: user.sharedLinks.length,
          items: user.sharedLinks.map(link => ({
            token: link.token,
            createdAt: link.createdAt.toISOString(),
            expiresAt: link.expiresAt?.toISOString() || 'Jamais',
          })),
        },
      };

      // Convertir en JSON avec indentation pour meilleure lisibilité
      const jsonString = JSON.stringify(exportData, null, 2);

      // Retourner les données en JSON formaté
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="supfile-export-${new Date().toISOString().split('T')[0]}.json"`
      );
      res.send(jsonString);
    } catch (error: any) {
      console.error('Error exporting user data:', error);
      res.status(500).json({ error: error.message });
    }
  }
}
