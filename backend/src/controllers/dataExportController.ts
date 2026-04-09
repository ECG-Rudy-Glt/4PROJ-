import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import prisma from '../config/database';
import logger from '../config/logger';
import { sendCsv, csvFilename } from '../utils/csvExporter';

export class DataExportController {
  static async exportUserData(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          files: {
            where: { isDeleted: false },
            select: { id: true, name: true, size: true, mimeType: true, storagePath: true, createdAt: true, updatedAt: true, isFavorite: true, folderId: true },
          },
          folders: {
            select: { id: true, name: true, path: true, parentId: true, createdAt: true, updatedAt: true },
          },
          sharedLinks: {
            select: { id: true, token: true, fileId: true, folderId: true, downloads: true, expiresAt: true, createdAt: true },
          },
          trustedDevices: {
            select: { id: true, deviceName: true, ipAddress: true, createdAt: true, expiresAt: true, lastUsedAt: true },
          },
          auditLogs: {
            orderBy: { createdAt: 'desc' },
            take: 1000,
            select: { id: true, action: true, details: true, createdAt: true },
          },
          organizationMemberships: {
            include: { organization: { select: { id: true, name: true, slug: true } } },
          },
          switchLinksAsRoot: {
            select: { id: true, targetUserId: true, expiresAt: true, lastAuthenticatedAt: true, revokedAt: true, createdAt: true },
          },
          switchLinksAsTarget: {
            select: { id: true, rootUserId: true, expiresAt: true, lastAuthenticatedAt: true, revokedAt: true, createdAt: true },
          },
          delegationsGiven: {
            select: { id: true, delegateUserId: true, status: true, canRead: true, canWrite: true, canDelete: true, canShare: true, startsAt: true, expiresAt: true, revokedAt: true, createdAt: true },
          },
          delegationsReceived: {
            select: { id: true, ownerUserId: true, status: true, canRead: true, canWrite: true, canDelete: true, canShare: true, startsAt: true, expiresAt: true, revokedAt: true, createdAt: true },
          },
        },
      });

      if (!user) { res.status(404).json({ error: 'User not found' }); return; }

      type Row = { Section: string; Categorie: string; ItemId: string; Champ: string; Valeur: string; DateCreation: string; DateMiseAJour: string };
      const rows: Row[] = [];

      const pushRow = (section: string, categorie: string, itemId: string, champ: string, valeur: string | number | boolean | null | undefined, dateCreation?: Date | null, dateMiseAJour?: Date | null) => {
        rows.push({
          Section: section, Categorie: categorie, ItemId: itemId, Champ: champ,
          Valeur: valeur === null || valeur === undefined ? '' : String(valeur),
          DateCreation: dateCreation ? dateCreation.toISOString() : '',
          DateMiseAJour: dateMiseAJour ? dateMiseAJour.toISOString() : '',
        });
      };

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

      for (const file of user.files) {
        pushRow('Fichiers', 'Métadonnées', file.id, 'Nom', file.name, file.createdAt, file.updatedAt);
        pushRow('Fichiers', 'Métadonnées', file.id, 'TypeMime', file.mimeType, file.createdAt, file.updatedAt);
        pushRow('Fichiers', 'Métadonnées', file.id, 'TailleOctets', file.size.toString(), file.createdAt, file.updatedAt);
        pushRow('Fichiers', 'Métadonnées', file.id, 'DossierParentId', file.folderId || 'Racine', file.createdAt, file.updatedAt);
        pushRow('Fichiers', 'Métadonnées', file.id, 'Favori', file.isFavorite ? 'Oui' : 'Non', file.createdAt, file.updatedAt);
        pushRow('Fichiers', 'Métadonnées', file.id, 'CheminStockage', file.storagePath, file.createdAt, file.updatedAt);
      }

      for (const folder of user.folders) {
        pushRow('Dossiers', 'Métadonnées', folder.id, 'Nom', folder.name, folder.createdAt, folder.updatedAt);
        pushRow('Dossiers', 'Métadonnées', folder.id, 'Chemin', folder.path, folder.createdAt, folder.updatedAt);
        pushRow('Dossiers', 'Métadonnées', folder.id, 'ParentId', folder.parentId || 'Racine', folder.createdAt, folder.updatedAt);
      }

      for (const link of user.sharedLinks) {
        pushRow('Partages', 'LiensPublics', link.id, 'Token', link.token, link.createdAt, null);
        pushRow('Partages', 'LiensPublics', link.id, 'Type', link.fileId ? 'Fichier' : 'Dossier', link.createdAt, null);
        pushRow('Partages', 'LiensPublics', link.id, 'ObjetId', link.fileId || link.folderId || '', link.createdAt, null);
        pushRow('Partages', 'LiensPublics', link.id, 'Téléchargements', link.downloads, link.createdAt, null);
        pushRow('Partages', 'LiensPublics', link.id, 'Expiration', link.expiresAt ? link.expiresAt.toISOString() : 'Jamais', link.createdAt, null);
      }

      for (const device of user.trustedDevices) {
        pushRow('Sécurité', 'AppareilsConfiance', device.id, 'NomAppareil', device.deviceName, device.createdAt, device.lastUsedAt);
        pushRow('Sécurité', 'AppareilsConfiance', device.id, 'AdresseIP', device.ipAddress, device.createdAt, device.lastUsedAt);
        pushRow('Sécurité', 'AppareilsConfiance', device.id, 'ExpireLe', device.expiresAt.toISOString(), device.createdAt, device.lastUsedAt);
      }

      for (const membership of user.organizationMemberships) {
        pushRow('Organisations', 'Membership', membership.id, 'OrganisationId', membership.organization.id, membership.createdAt, membership.updatedAt);
        pushRow('Organisations', 'Membership', membership.id, 'OrganisationNom', membership.organization.name, membership.createdAt, membership.updatedAt);
        pushRow('Organisations', 'Membership', membership.id, 'Rôle', membership.role, membership.createdAt, membership.updatedAt);
      }

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

      for (const delegation of user.delegationsGiven) {
        pushRow('Délégations', 'Sortantes', delegation.id, 'DelegateUserId', delegation.delegateUserId, delegation.createdAt, delegation.revokedAt);
        pushRow('Délégations', 'Sortantes', delegation.id, 'Statut', delegation.status, delegation.createdAt, delegation.revokedAt);
        pushRow('Délégations', 'Sortantes', delegation.id, 'Permissions', `read=${delegation.canRead};write=${delegation.canWrite};delete=${delegation.canDelete};share=${delegation.canShare}`, delegation.createdAt, delegation.revokedAt);
      }

      for (const delegation of user.delegationsReceived) {
        pushRow('Délégations', 'Entrantes', delegation.id, 'OwnerUserId', delegation.ownerUserId, delegation.createdAt, delegation.revokedAt);
        pushRow('Délégations', 'Entrantes', delegation.id, 'Statut', delegation.status, delegation.createdAt, delegation.revokedAt);
        pushRow('Délégations', 'Entrantes', delegation.id, 'Permissions', `read=${delegation.canRead};write=${delegation.canWrite};delete=${delegation.canDelete};share=${delegation.canShare}`, delegation.createdAt, delegation.revokedAt);
      }

      for (const log of user.auditLogs) {
        let parsedDetails = '';
        if (log.details) {
          try { parsedDetails = JSON.stringify(JSON.parse(log.details)); }
          catch { parsedDetails = log.details; }
        }
        pushRow('Historique', 'Audit', log.id, 'Action', log.action, log.createdAt, null);
        pushRow('Historique', 'Audit', log.id, 'Détails', parsedDetails, log.createdAt, null);
      }

      sendCsv(res, rows, csvFilename('supfile-export'), {
        columns: ['Section', 'Categorie', 'ItemId', 'Champ', 'Valeur', 'DateCreation', 'DateMiseAJour'],
        bom: true,
      });

    } catch (error) {
      logger.error({ err: error }, 'Error exporting user data');
      if (!res.headersSent) next(error);
    }
  }
}
