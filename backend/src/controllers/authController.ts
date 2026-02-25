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

  static async logoutAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const result = await AuthService.logoutGlobal(userId);

      // Audit log
      AuditService.createLog(userId, 'LOGOUT', {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        globalLogout: true,
      }).catch(console.error);

      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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

      // Audit log
      AuditService.createLog(userId, 'PASSWORD_CHANGE', {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }).catch(console.error);

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
            where: { isDeleted: false },
            select: {
              id: true,
              name: true,
              size: true,
              mimeType: true,
              storagePath: true,
              createdAt: true,
              updatedAt: true,
              isFavorite: true,
              folderId: true,
            },
          },
          folders: {
            select: {
              id: true,
              name: true,
              path: true,
              parentId: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          sharedLinks: {
            select: {
              id: true,
              token: true,
              fileId: true,
              folderId: true,
              downloads: true,
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
          auditLogs: {
            orderBy: { createdAt: 'desc' },
            take: 1000, // Limite raisonnable
            select: {
              action: true,
              details: true,
              createdAt: true,
            },
          },
        },
      });

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Configuration de la réponse pour le téléchargement ZIP
      const filename = `supfile-export-${new Date().toISOString().split('T')[0]}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Création de l'archive ZIP
      const archive = require('archiver')('zip', {
        zlib: { level: 9 }, // Compression maximale
      });

      archive.on('error', (err: any) => {
        throw err;
      });

      archive.pipe(res);

      // Helper pour convertir en CSV
      const { stringify } = require('csv-stringify/sync');

      // 1. Profil Utilisateur (CSV)
      const profileData = [{
        ID: user.id,
        Email: user.email,
        Prenom: user.firstName || '',
        Nom: user.lastName || '',
        QuotaUtilise: user.quotaUsed.toString(),
        QuotaLimite: user.quotaLimit.toString(),
        MFA_Active: user.mfaEnabled ? 'Oui' : 'Non',
        DateCreation: user.createdAt.toISOString(),
      }];
      archive.append(stringify(profileData, { header: true }), { name: 'Profil.csv' });

      // 2. Fichiers (CSV)
      const filesData = user.files.map(f => ({
        ID: f.id,
        Nom: f.name,
        Taille: f.size.toString(),
        Type: f.mimeType,
        DossierID: f.folderId || 'Racine',
        Favori: f.isFavorite ? 'Oui' : 'Non',
        DateCreation: f.createdAt.toISOString(),
        DerniereModif: f.updatedAt.toISOString(),
      }));
      archive.append(stringify(filesData, { header: true }), { name: 'Fichiers.csv' });

      // 3. Dossiers (CSV)
      const foldersData = user.folders.map(f => ({
        ID: f.id,
        Nom: f.name,
        Chemin: f.path,
        ParentID: f.parentId || 'Racine',
        DateCreation: f.createdAt.toISOString(),
      }));
      archive.append(stringify(foldersData, { header: true }), { name: 'Dossiers.csv' });

      // 4. Liens de partage (CSV)
      const linksData = user.sharedLinks.map(l => ({
        Token: l.token,
        Type: l.fileId ? 'Fichier' : 'Dossier',
        ID_Objet: l.fileId || l.folderId,
        Telechargements: l.downloads,
        Expiration: l.expiresAt ? l.expiresAt.toISOString() : 'Jamais',
        DateCreation: l.createdAt.toISOString(),
      }));
      archive.append(stringify(linksData, { header: true }), { name: 'Partages.csv' });

      // 5. Appareils de confiance (CSV)
      const devicesData = user.trustedDevices.map(d => ({
        Nom: d.deviceName,
        IP: d.ipAddress,
        DerniereUtilisation: d.lastUsedAt.toISOString(),
        Expiration: d.expiresAt.toISOString(),
      }));
      archive.append(stringify(devicesData, { header: true }), { name: 'Appareils.csv' });

      // 6. Historique d'activité (CSV)
      const logsData = user.auditLogs.map(l => ({
        Action: l.action,
        Details: l.details || '',
        Date: l.createdAt.toISOString(),
      }));
      archive.append(stringify(logsData, { header: true }), { name: 'Activite.csv' });

      // Finaliser l'archive
      await archive.finalize();

    } catch (error: any) {
      console.error('Error exporting user data:', error);
      // Si les headers n'ont pas encore été envoyés, on peut renvoyer une erreur JSON
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  }
}
