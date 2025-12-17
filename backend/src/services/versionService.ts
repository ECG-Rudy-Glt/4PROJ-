import prisma from '../config/database';
import fs from 'fs';
import path from 'path';
import { deleteFile } from '../utils/fileUtils';

const MAX_VERSIONS = 10; // Nombre maximum de versions à conserver

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

    // Obtenir le numéro de la nouvelle version
    const lastVersion = file.versions[0];
    const newVersionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;

    // Créer la nouvelle version en sauvegardant l'ancien fichier
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

    // Mettre à jour le fichier principal avec les nouvelles données
    await prisma.file.update({
      where: { id: fileId },
      data: {
        name: newFileName,
        size: BigInt(newFileSize),
        storagePath: newFilePath,
        mimeType: newMimeType,
      },
    });

    // Nettoyer les anciennes versions si on dépasse le maximum
    await this.cleanOldVersions(fileId, userId);

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

    const version = await prisma.fileVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.fileId !== fileId) {
      throw new Error('Version introuvable');
    }

    // Créer une version de l'état actuel avant de restaurer
    const lastVersion = await prisma.fileVersion.findFirst({
      where: { fileId },
      orderBy: { versionNumber: 'desc' },
    });

    const newVersionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;

    // Copier le fichier actuel vers un nouvel emplacement pour la version
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const currentBackupFileName = `${Date.now()}-backup-${path.basename(file.storagePath)}`;
    const currentBackupPath = path.join(uploadDir, currentBackupFileName);

    // Copier le fichier actuel vers le backup
    const currentFilePath = file.storagePath.startsWith('/') ? file.storagePath : path.join(uploadDir, file.storagePath);
    if (fs.existsSync(currentFilePath)) {
      fs.copyFileSync(currentFilePath, currentBackupPath);
    }

    // Créer la version avec le nouveau chemin de backup
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

    // Copier le fichier de la version vers un nouvel emplacement
    const newFileName = `${Date.now()}-restored-${version.name}`;
    const newFilePath = path.join(uploadDir, newFileName);

    // Copier le fichier de la version
    const versionFilePath = version.storagePath.startsWith('/') ? version.storagePath : path.join(uploadDir, version.storagePath);
    if (fs.existsSync(versionFilePath)) {
      fs.copyFileSync(versionFilePath, newFilePath);
    } else {
      throw new Error('Fichier de version introuvable sur le disque');
    }

    // Mettre à jour le fichier principal
    await prisma.file.update({
      where: { id: fileId },
      data: {
        name: version.name,
        size: version.size,
        storagePath: newFilePath,
        mimeType: version.mimeType,
      },
    });

    // Nettoyer les anciennes versions
    await this.cleanOldVersions(fileId, userId);

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

    const version = await prisma.fileVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.fileId !== fileId) {
      throw new Error('Version introuvable');
    }

    // Supprimer le fichier physique
    await deleteFile(version.storagePath);

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
    const versions = await prisma.fileVersion.findMany({
      where: { fileId },
      orderBy: { versionNumber: 'desc' },
    });

    if (versions.length > MAX_VERSIONS) {
      const versionsToDelete = versions.slice(MAX_VERSIONS);

      for (const version of versionsToDelete) {
        await deleteFile(version.storagePath);

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
