import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { AuthRequest } from '../types';
import { generateToken } from '../utils/jwt';
import { AuditService } from '../services/auditService';
import { mfaService } from '../services/mfaService';
import { trustedDeviceService } from '../services/trustedDeviceService';
import { generateTempToken } from './mfaController';
import prisma from '../config/database';
import { clearSwitchSessionCookie } from '../utils/cookies';

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, firstName, lastName } = req.body;

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        res.status(400).json({ error: 'Format d\'email invalide' });
        return;
      }

      if (!password || password.length < 6) {
        res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
        return;
      }

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
      clearSwitchSessionCookie(res);

      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        res.status(400).json({ error: 'Format d\'email invalide' });
        return;
      }

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
          role: user.role,
          accountStatus: user.accountStatus,
          plan: user.plan,
          subscriptionStatus: user.subscriptionStatus,
          vaultEnabled: user.vaultEnabled,
          currentOrganizationId: user.currentOrganizationId,
          quotaUsed: user.quotaUsed,
          quotaLimit: user.quotaLimit,
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
              id: true,
              action: true,
              details: true,
              createdAt: true,
            },
          },
          organizationMemberships: {
            include: {
              organization: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
          switchLinksAsRoot: {
            select: {
              id: true,
              targetUserId: true,
              expiresAt: true,
              lastAuthenticatedAt: true,
              revokedAt: true,
              createdAt: true,
            },
          },
          switchLinksAsTarget: {
            select: {
              id: true,
              rootUserId: true,
              expiresAt: true,
              lastAuthenticatedAt: true,
              revokedAt: true,
              createdAt: true,
            },
          },
          delegationsGiven: {
            select: {
              id: true,
              delegateUserId: true,
              status: true,
              canRead: true,
              canWrite: true,
              canDelete: true,
              canShare: true,
              startsAt: true,
              expiresAt: true,
              revokedAt: true,
              createdAt: true,
            },
          },
          delegationsReceived: {
            select: {
              id: true,
              ownerUserId: true,
              status: true,
              canRead: true,
              canWrite: true,
              canDelete: true,
              canShare: true,
              startsAt: true,
              expiresAt: true,
              revokedAt: true,
              createdAt: true,
            },
          },
        },
      });

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const rows: Array<{
        Section: string;
        Categorie: string;
        ItemId: string;
        Champ: string;
        Valeur: string;
        DateCreation: string;
        DateMiseAJour: string;
      }> = [];

      const pushRow = (
        section: string,
        categorie: string,
        itemId: string,
        champ: string,
        valeur: string | number | boolean | null | undefined,
        dateCreation?: Date | null,
        dateMiseAJour?: Date | null
      ) => {
        rows.push({
          Section: section,
          Categorie: categorie,
          ItemId: itemId,
          Champ: champ,
          Valeur: valeur === null || valeur === undefined ? '' : String(valeur),
          DateCreation: dateCreation ? dateCreation.toISOString() : '',
          DateMiseAJour: dateMiseAJour ? dateMiseAJour.toISOString() : '',
        });
      };

      // Profil & sécurité
      pushRow('Profil', 'Compte', user.id, 'Email', user.email, user.createdAt, user.updatedAt);
      pushRow('Profil', 'Compte', user.id, 'Prénom', user.firstName, user.createdAt, user.updatedAt);
      pushRow('Profil', 'Compte', user.id, 'Nom', user.lastName, user.createdAt, user.updatedAt);
      pushRow('Profil', 'Compte', user.id, 'Rôle', user.role, user.createdAt, user.updatedAt);
      pushRow('Profil', 'Compte', user.id, 'StatutCompte', user.accountStatus, user.createdAt, user.updatedAt);
      pushRow('Profil', 'Compte', user.id, 'Plan', user.plan, user.createdAt, user.updatedAt);
      pushRow('Profil', 'Compte', user.id, 'StatutAbonnement', user.subscriptionStatus, user.createdAt, user.updatedAt);
      pushRow('Profil', 'Compte', user.id, 'MFAActivé', user.mfaEnabled ? 'Oui' : 'Non', user.createdAt, user.updatedAt);
      pushRow('Profil', 'Compte', user.id, 'CoffreFortActivé', user.vaultEnabled ? 'Oui' : 'Non', user.createdAt, user.updatedAt);
      pushRow('Profil', 'Stockage', user.id, 'QuotaUtiliséOctets', user.quotaUsed.toString(), user.createdAt, user.updatedAt);
      pushRow('Profil', 'Stockage', user.id, 'QuotaLimiteOctets', user.quotaLimit.toString(), user.createdAt, user.updatedAt);
      pushRow('Profil', 'Sécurité', user.id, 'DernièreActivité', user.lastActiveAt?.toISOString() || '', user.createdAt, user.updatedAt);

      // Fichiers
      for (const file of user.files) {
        pushRow('Fichiers', 'Métadonnées', file.id, 'Nom', file.name, file.createdAt, file.updatedAt);
        pushRow('Fichiers', 'Métadonnées', file.id, 'TypeMime', file.mimeType, file.createdAt, file.updatedAt);
        pushRow('Fichiers', 'Métadonnées', file.id, 'TailleOctets', file.size.toString(), file.createdAt, file.updatedAt);
        pushRow('Fichiers', 'Métadonnées', file.id, 'DossierParentId', file.folderId || 'Racine', file.createdAt, file.updatedAt);
        pushRow('Fichiers', 'Métadonnées', file.id, 'Favori', file.isFavorite ? 'Oui' : 'Non', file.createdAt, file.updatedAt);
        pushRow('Fichiers', 'Métadonnées', file.id, 'CheminStockage', file.storagePath, file.createdAt, file.updatedAt);
      }

      // Dossiers
      for (const folder of user.folders) {
        pushRow('Dossiers', 'Métadonnées', folder.id, 'Nom', folder.name, folder.createdAt, folder.updatedAt);
        pushRow('Dossiers', 'Métadonnées', folder.id, 'Chemin', folder.path, folder.createdAt, folder.updatedAt);
        pushRow('Dossiers', 'Métadonnées', folder.id, 'ParentId', folder.parentId || 'Racine', folder.createdAt, folder.updatedAt);
      }

      // Partages publics
      for (const link of user.sharedLinks) {
        pushRow('Partages', 'LiensPublics', link.id, 'Token', link.token, link.createdAt, null);
        pushRow('Partages', 'LiensPublics', link.id, 'Type', link.fileId ? 'Fichier' : 'Dossier', link.createdAt, null);
        pushRow('Partages', 'LiensPublics', link.id, 'ObjetId', link.fileId || link.folderId || '', link.createdAt, null);
        pushRow('Partages', 'LiensPublics', link.id, 'Téléchargements', link.downloads, link.createdAt, null);
        pushRow('Partages', 'LiensPublics', link.id, 'Expiration', link.expiresAt ? link.expiresAt.toISOString() : 'Jamais', link.createdAt, null);
      }

      // Appareils de confiance
      for (const device of user.trustedDevices) {
        pushRow('Sécurité', 'AppareilsConfiance', device.id, 'NomAppareil', device.deviceName, device.createdAt, device.lastUsedAt);
        pushRow('Sécurité', 'AppareilsConfiance', device.id, 'AdresseIP', device.ipAddress, device.createdAt, device.lastUsedAt);
        pushRow('Sécurité', 'AppareilsConfiance', device.id, 'ExpireLe', device.expiresAt.toISOString(), device.createdAt, device.lastUsedAt);
      }

      // Organisations
      for (const membership of user.organizationMemberships) {
        pushRow('Organisations', 'Membership', membership.id, 'OrganisationId', membership.organization.id, membership.createdAt, membership.updatedAt);
        pushRow('Organisations', 'Membership', membership.id, 'OrganisationNom', membership.organization.name, membership.createdAt, membership.updatedAt);
        pushRow('Organisations', 'Membership', membership.id, 'OrganisationSlug', membership.organization.slug, membership.createdAt, membership.updatedAt);
        pushRow('Organisations', 'Membership', membership.id, 'Rôle', membership.role, membership.createdAt, membership.updatedAt);
      }

      // Switch comptes
      for (const link of user.switchLinksAsRoot) {
        pushRow('Comptes', 'SwitchSortants', link.id, 'CompteCibleId', link.targetUserId, link.createdAt, link.lastAuthenticatedAt);
        pushRow('Comptes', 'SwitchSortants', link.id, 'ExpireLe', link.expiresAt.toISOString(), link.createdAt, link.lastAuthenticatedAt);
        pushRow('Comptes', 'SwitchSortants', link.id, 'RévoquéLe', link.revokedAt?.toISOString() || '', link.createdAt, link.lastAuthenticatedAt);
      }
      for (const link of user.switchLinksAsTarget) {
        pushRow('Comptes', 'SwitchEntrants', link.id, 'CompteRacineId', link.rootUserId, link.createdAt, link.lastAuthenticatedAt);
        pushRow('Comptes', 'SwitchEntrants', link.id, 'ExpireLe', link.expiresAt.toISOString(), link.createdAt, link.lastAuthenticatedAt);
        pushRow('Comptes', 'SwitchEntrants', link.id, 'RévoquéLe', link.revokedAt?.toISOString() || '', link.createdAt, link.lastAuthenticatedAt);
      }

      // Délégations
      for (const delegation of user.delegationsGiven) {
        pushRow('Délégations', 'Sortantes', delegation.id, 'DelegateUserId', delegation.delegateUserId, delegation.createdAt, delegation.revokedAt);
        pushRow('Délégations', 'Sortantes', delegation.id, 'Statut', delegation.status, delegation.createdAt, delegation.revokedAt);
        pushRow('Délégations', 'Sortantes', delegation.id, 'Permissions', `read=${delegation.canRead};write=${delegation.canWrite};delete=${delegation.canDelete};share=${delegation.canShare}`, delegation.createdAt, delegation.revokedAt);
        pushRow('Délégations', 'Sortantes', delegation.id, 'ExpireLe', delegation.expiresAt?.toISOString() || '', delegation.createdAt, delegation.revokedAt);
      }
      for (const delegation of user.delegationsReceived) {
        pushRow('Délégations', 'Entrantes', delegation.id, 'OwnerUserId', delegation.ownerUserId, delegation.createdAt, delegation.revokedAt);
        pushRow('Délégations', 'Entrantes', delegation.id, 'Statut', delegation.status, delegation.createdAt, delegation.revokedAt);
        pushRow('Délégations', 'Entrantes', delegation.id, 'Permissions', `read=${delegation.canRead};write=${delegation.canWrite};delete=${delegation.canDelete};share=${delegation.canShare}`, delegation.createdAt, delegation.revokedAt);
        pushRow('Délégations', 'Entrantes', delegation.id, 'ExpireLe', delegation.expiresAt?.toISOString() || '', delegation.createdAt, delegation.revokedAt);
      }

      // Historique
      for (const log of user.auditLogs) {
        let parsedDetails = '';
        if (log.details) {
          try {
            parsedDetails = JSON.stringify(JSON.parse(log.details));
          } catch {
            parsedDetails = log.details;
          }
        }
        pushRow('Historique', 'Audit', log.id, 'Action', log.action, log.createdAt, null);
        pushRow('Historique', 'Audit', log.id, 'Détails', parsedDetails, log.createdAt, null);
      }

      const { stringify } = require('csv-stringify/sync');
      const csv = stringify(rows, {
        header: true,
        columns: ['Section', 'Categorie', 'ItemId', 'Champ', 'Valeur', 'DateCreation', 'DateMiseAJour'],
      });

      const filename = `supfile-export-${new Date().toISOString().split('T')[0]}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      // BOM UTF-8 pour meilleure compatibilité Excel
      res.status(200).send(`\uFEFF${csv}`);

    } catch (error: any) {
      console.error('Error exporting user data:', error);
      // Si les headers n'ont pas encore été envoyés, on peut renvoyer une erreur JSON
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  }
}
