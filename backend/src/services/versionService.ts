import prisma from '../config/database';
import fs from 'fs';
import path from 'path';
import { deleteFile } from '../utils/fileUtils';
import { StorageService } from './storageService';
import { PlanService } from './planService';
import { EncryptionService } from './encryptionService';
import { FileIndexService } from './fileIndexService';
import { VaultService } from './vaultService';

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
    newMimeType: string
  ) {
    const file = await prisma.file.findFirst({
      where: { id: fileId, userId, isDeleted: false },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } }
    });

    if (!file) {
      throw new Error('Fichier introuvable');
    }
    if (file.isVault && file.userId !== userId) {
      throw new Error('Accès interdit au contenu coffre-fort');
    }
    await VaultService.assertUnlockedIfVault(userId, file.isVault && file.userId === userId);

    const currentVersionCount = await prisma.fileVersion.count({
      where: { fileId },
    });
    await PlanService.assertLimit(userId, 'maxVersions', currentVersionCount);

    // Obtenir le numéro de la nouvelle version
    const lastVersion = file.versions[0];
    const newVersionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;

    if (!fs.existsSync(newFilePath)) {
      throw new Error('Nouveau fichier introuvable sur le disque');
    }

    // Chiffrer et uploader la nouvelle version vers S3
    const s3Key = `versions/${fileId}/${newVersionNumber}-${path.basename(newFilePath)}`;
    await EncryptionService.encryptFileToS3(newFilePath, s3Key);

    // Créer la nouvelle version en sauvegardant l'ancien storagePath (S3 ou local)
    const version = await prisma.fileVersion.create({
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
    await prisma.file.update({
      where: { id: fileId },
      data: {
        name: newFileName,
        size: BigInt(newFileSize),
        storagePath: s3Key,
        mimeType: newMimeType,
      },
    });

    // Nettoyer les anciennes versions si on dépasse le maximum
    await this.cleanOldVersions(fileId, userId);
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
                some: { sharedWithId: userId },
              },
            },
          },
          {
            sharedWith: {
              some: {
                sharedWithId: userId,
                canRead: true,
              },
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
      if (fs.existsSync(currentFilePath)) {
        fs.copyFileSync(currentFilePath, currentBackupPath);
      }
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
  private static async cleanOldVersions(fileId: string, userId: string) {
    const maxVersions = await PlanService.getNumericLimit(userId, 'maxVersions');
    if (maxVersions === null) {
      return;
    }

    const versions = await prisma.fileVersion.findMany({
      where: { fileId },
      orderBy: { versionNumber: 'desc' },
    });

    if (versions.length > maxVersions) {
      const versionsToDelete = versions.slice(maxVersions);

      for (const version of versionsToDelete) {
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
