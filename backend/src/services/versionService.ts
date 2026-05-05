import prisma from '../config/database';
import fs from 'fs';
import path from 'path';

import { StorageService } from './storageService';
import { PlanService } from './planService';
import { EncryptionService } from './encryptionService';
import { FileIndexService } from './fileIndexService';
import { VaultService } from './vaultService';
import { acceptedSharePermissionWhere } from '../middlewares/permissions';
import logger from '../config/logger';

export class VersionService {
  /**
   * Créer une nouvelle version d'un fichier
   */
  static async createVersion(
    fileId: string,
    userId: string,
    newFilePath: string,
    newFileName: string,
    newFileSize: number,
    newMimeType: string,
    dek?: Buffer
  ) {
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        isDeleted: false,
        OR: [
          { userId },
          {
            sharedWith: {
              some: acceptedSharePermissionWhere(userId, 'write'),
            },
          },
          {
            folder: {
              sharedWith: {
                some: acceptedSharePermissionWhere(userId, 'write'),
              },
            },
          },
        ],
      },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } }
    });

    if (!file) {
      throw new Error('Fichier introuvable');
    }
    if (file.isVault && file.userId !== userId) {
      throw new Error('Accès interdit au contenu coffre-fort');
    }
    await VaultService.assertUnlockedIfVault(userId, file.isVault && file.userId === userId);

    const quotaOwnerId = file.userId;
    const maxVersions = await PlanService.getNumericLimit(quotaOwnerId, 'maxVersions');
    if (maxVersions !== null) {
      if (maxVersions <= 0) {
        throw new Error('Limite de 0 versions atteinte pour votre plan');
      }

      await this.cleanOldVersions(fileId, quotaOwnerId, file.storagePath, maxVersions - 1);

      const currentVersionCount = await prisma.fileVersion.count({
        where: { fileId },
      });
      if (currentVersionCount >= maxVersions) {
        throw new Error(`Limite de ${maxVersions} versions atteinte pour votre plan`);
      }
    }

    // Obtenir le numéro de la nouvelle version
    const lastVersion = file.versions[0];
    const newVersionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;

    if (!fs.existsSync(newFilePath)) {
      throw new Error('Nouveau fichier introuvable sur le disque');
    }

    // Chiffrer et uploader la nouvelle version vers S3
    const s3Key = `versions/${fileId}/${newVersionNumber}-${path.basename(newFilePath)}`;
    if (file.storagePath === s3Key) {
      throw new Error('Chemin de stockage de version ambigu');
    }

    const hasSpace = await PlanService.checkQuota(quotaOwnerId, newFileSize);
    if (!hasSpace) {
      throw new Error('Quota exceeded');
    }

    await EncryptionService.encryptFileToS3(newFilePath, s3Key, dek);

    let version;
    try {
      version = await prisma.$transaction(async (tx) => {
        // Créer la nouvelle version en sauvegardant l'ancien storagePath (S3 ou local)
        const createdVersion = await tx.fileVersion.create({
          data: {
            fileId,
            versionNumber: newVersionNumber,
            name: file.name,
            size: file.size,
            storagePath: file.storagePath,
            mimeType: file.mimeType,
            createdById: userId,
          },
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        });

        // Mettre à jour le fichier principal avec la nouvelle clé S3
        await tx.file.update({
          where: { id: fileId },
          data: {
            name: newFileName,
            size: BigInt(newFileSize),
            storagePath: s3Key,
            mimeType: newMimeType,
          },
        });

        await tx.user.update({
          where: { id: quotaOwnerId },
          data: {
            quotaUsed: {
              increment: BigInt(newFileSize),
            },
          },
        });

        return createdVersion;
      });
    } catch (error) {
      try {
        await StorageService.deleteStorageFile(s3Key);
      } catch (cleanupError) {
        logger.error({ cleanupError, s3Key }, 'Failed to cleanup uploaded version object after DB error');
      }
      throw error;
    }

    FileIndexService.indexFileAsync(fileId, userId);

    return version;
  }

  /**
   * Récupérer toutes les versions d'un fichier
   */
  static async getFileVersions(fileId: string, userId: string) {
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        isDeleted: false,
        OR: [
          { userId },
          {
            folder: {
              sharedWith: {
                some: acceptedSharePermissionWhere(userId, 'read'),
              },
            },
          },
          {
            sharedWith: {
              some: acceptedSharePermissionWhere(userId, 'read'),
            },
          },
        ],
      },
    });

    if (!file) {
      throw new Error('Fichier introuvable');
    }
    if (file.isVault && file.userId !== userId) {
      throw new Error('Accès interdit au contenu coffre-fort');
    }
    await VaultService.assertUnlockedIfVault(userId, file.isVault && file.userId === userId);

    return await prisma.fileVersion.findMany({
      where: { fileId },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { versionNumber: 'desc' },
    });
  }

  /**
   * Restaurer une version spécifique
   */
  static async restoreVersion(versionId: string, fileId: string, userId: string) {
    const file = await prisma.file.findFirst({
      where: { id: fileId, userId, isDeleted: false },
    });

    if (!file) {
      throw new Error('Fichier introuvable');
    }
    await VaultService.assertUnlockedIfVault(userId, file.isVault);

    const version = await prisma.fileVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.fileId !== fileId) {
      throw new Error('Version introuvable');
    }

    const currentVersionCount = await prisma.fileVersion.count({
      where: { fileId },
    });
    await PlanService.assertLimit(userId, 'maxVersions', currentVersionCount);

    // Créer une version de l'état actuel avant de restaurer
    const lastVersion = await prisma.fileVersion.findFirst({
      where: { fileId },
      orderBy: { versionNumber: 'desc' },
    });

    const newVersionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;

    // Copier le fichier actuel vers un nouvel emplacement pour la version
    const uploadDir = process.env.UPLOAD_DIR || './uploads';

    // Sauvegarder l'état actuel comme nouvelle version
    let currentBackupPath: string;
    if (StorageService.isS3Key(file.storagePath)) {
      // Copie S3 vers S3
      currentBackupPath = `versions/${fileId}/${newVersionNumber}-backup-${path.basename(file.storagePath)}`;
      await StorageService.copy(file.storagePath, currentBackupPath);
    } else {
      // Copie locale (fichiers pré-migration)
      currentBackupPath = path.join(uploadDir, `${Date.now()}-backup-${path.basename(file.storagePath)}`);
      const currentFilePath = file.storagePath.startsWith('/') ? file.storagePath : path.join(uploadDir, file.storagePath);
      if (!fs.existsSync(currentFilePath)) {
        throw new Error(`Impossible de créer une version : fichier courant introuvable (${currentFilePath})`);
      }
      fs.copyFileSync(currentFilePath, currentBackupPath);
    }

    await prisma.fileVersion.create({
      data: {
        fileId,
        versionNumber: newVersionNumber,
        name: file.name,
        size: file.size,
        storagePath: currentBackupPath,
        mimeType: file.mimeType,
        createdById: userId,
      },
    });

    // Restaurer la version cible
    let restoredPath: string;
    if (StorageService.isS3Key(version.storagePath)) {
      restoredPath = `versions/${fileId}/restored-${Date.now()}-${path.basename(version.storagePath)}`;
      await StorageService.copy(version.storagePath, restoredPath);
    } else {
      const versionFilePath = version.storagePath.startsWith('/') ? version.storagePath : path.join(uploadDir, version.storagePath);
      if (!fs.existsSync(versionFilePath)) {
        throw new Error('Fichier de version introuvable sur le disque');
      }
      restoredPath = path.join(uploadDir, `${Date.now()}-restored-${version.name}`);
      fs.copyFileSync(versionFilePath, restoredPath);
    }

    // Mettre à jour le fichier principal
    await prisma.file.update({
      where: { id: fileId },
      data: {
        name: version.name,
        size: version.size,
        storagePath: restoredPath,
        mimeType: version.mimeType,
      },
    });

    // Nettoyer les anciennes versions
    await this.cleanOldVersions(fileId, userId);
    FileIndexService.indexFileAsync(fileId, userId);

    return await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        versions: {
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { versionNumber: 'desc' },
        },
      },
    });
  }

  /**
   * Supprimer une version spécifique
   */
  static async deleteVersion(versionId: string, fileId: string, userId: string) {
    const file = await prisma.file.findFirst({
      where: { id: fileId, userId, isDeleted: false },
    });

    if (!file) {
      throw new Error('Fichier introuvable');
    }
    await VaultService.assertUnlockedIfVault(userId, file.isVault);

    const version = await prisma.fileVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.fileId !== fileId) {
      throw new Error('Version introuvable');
    }
    this.assertVersionStorageCanBeDeleted(version.storagePath, file.storagePath, version.id, fileId);

    // Supprimer l'objet (S3 ou local)
    await StorageService.deleteStorageFile(version.storagePath);

    // Supprimer l'entrée en base
    await prisma.fileVersion.delete({
      where: { id: versionId },
    });

    // Mettre à jour le quota utilisateur
    await prisma.user.update({
      where: { id: userId },
      data: {
        quotaUsed: {
          decrement: version.size,
        },
      },
    });

    return { message: 'Version supprimée' };
  }

  /**
   * Nettoyer les anciennes versions au-delà de MAX_VERSIONS
   */
  private static async cleanOldVersions(
    fileId: string,
    userId: string,
    currentFileStoragePath?: string,
    keepCountOverride?: number
  ) {
    let keepCount = keepCountOverride;
    if (keepCount === undefined) {
      const maxVersions = await PlanService.getNumericLimit(userId, 'maxVersions');
      if (maxVersions === null) {
        return;
      }
      keepCount = maxVersions;
    }

    keepCount = Math.max(keepCount, 0);

    const versions = await prisma.fileVersion.findMany({
      where: { fileId },
      orderBy: { versionNumber: 'desc' },
    });

    if (versions.length > keepCount) {
      const versionsToDelete = versions.slice(keepCount);

      for (const version of versionsToDelete) {
        this.assertVersionStorageCanBeDeleted(version.storagePath, currentFileStoragePath, version.id, fileId);
        await StorageService.deleteStorageFile(version.storagePath);

        await prisma.fileVersion.delete({
          where: { id: version.id },
        });

        await prisma.user.update({
          where: { id: userId },
          data: {
            quotaUsed: {
              decrement: version.size,
            },
          },
        });
      }
    }
  }

  private static assertVersionStorageCanBeDeleted(
    versionStoragePath: string,
    currentFileStoragePath: string | undefined,
    versionId: string,
    fileId: string
  ): void {
    if (!currentFileStoragePath || versionStoragePath !== currentFileStoragePath) {
      return;
    }

    logger.warn({ fileId, versionId, storagePath: versionStoragePath }, 'Refusing to delete version storage used by current file');
    throw new Error('Impossible de supprimer une version qui référence le fichier courant');
  }

  /**
   * Obtenir la taille totale des versions pour le calcul du quota
   */
  static async getTotalVersionsSize(userId: string): Promise<bigint> {
    const result = await prisma.fileVersion.aggregate({
      where: {
        file: {
          userId,
        },
      },
      _sum: {
        size: true,
      },
    });

    return result._sum.size || BigInt(0);
  }
}
