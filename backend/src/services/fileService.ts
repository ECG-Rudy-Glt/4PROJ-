import prisma from '../config/database';
import { deleteFile } from '../utils/fileUtils';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { VersionService } from './versionService';
import { AuditService } from './auditService';
import { SocketService } from './socketService';
import { EncryptionService } from './encryptionService';
import { PlanService } from './planService';

export class FileService {
  // Fonction pour déterminer la catégorie basée sur le mimeType
  private static getCategoryFromMimeType(mimeType: string): string {
    if (mimeType.startsWith('image/')) {
      return 'image';
    } else if (mimeType.startsWith('video/')) {
      return 'video';
    } else if (mimeType.startsWith('audio/')) {
      return 'audio';
    } else if (
      mimeType.includes('pdf') ||
      mimeType.includes('document') ||
      mimeType.includes('word') ||
      mimeType.includes('excel') ||
      mimeType.includes('spreadsheet') ||
      mimeType.includes('presentation') ||
      mimeType.includes('powerpoint') ||
      mimeType.includes('text/')
    ) {
      return 'doc';
    } else {
      return 'other';
    }
  }

  // Fonction utilitaire pour gérer les noms de fichiers en doublon
  private static async getUniqueFileName(
    name: string,
    folderId: string | undefined,
    userId: string
  ): Promise<string> {
    const lastDotIndex = name.lastIndexOf('.');
    const baseName = lastDotIndex > 0 ? name.substring(0, lastDotIndex) : name;
    const extension = lastDotIndex > 0 ? name.substring(lastDotIndex) : '';

    // Vérifier si le nom existe déjà
    const existingFiles = await prisma.file.findMany({
      where: {
        userId,
        folderId: folderId || null,
        isDeleted: false,
        name: {
          startsWith: baseName,
        },
      },
      select: { name: true },
    });

    if (existingFiles.length === 0 || !existingFiles.some(f => f.name === name)) {
      return name;
    }

    // Trouver un nom unique avec pattern "(1)", "(2)", etc.
    let counter = 1;
    let newName = `${baseName} (${counter})${extension}`;

    while (existingFiles.some(f => f.name === newName)) {
      counter++;
      newName = `${baseName} (${counter})${extension}`;
    }

    return newName;
  }

  static async createFiles(
    userId: string,
    files: Express.Multer.File[],
    folderId?: string
  ) {
    const createdFiles: any[] = [];
    const errors: Array<{ fileName: string; error: string }> = [];

    for (const uploadedFile of files) {
      try {
        const createdFile = await this.createFile(
          userId,
          uploadedFile.originalname,
          uploadedFile.originalname,
          uploadedFile.mimetype,
          uploadedFile.size,
          uploadedFile.path,
          folderId
        );
        createdFiles.push(createdFile);
      } catch (error: any) {
        // Best effort cleanup if file processing failed before deletion
        await deleteFile(uploadedFile.path).catch(() => undefined);

        errors.push({
          fileName: uploadedFile.originalname,
          error: error?.message || 'Upload failed',
        });
      }
    }

    return { files: createdFiles, errors };
  }

  static async createFile(
    userId: string,
    name: string,
    originalName: string,
    mimeType: string,
    size: number,
    storagePath: string,
    folderId?: string
  ) {
    // Check file size limit per plan
    const fileSizeAllowed = await PlanService.checkFileSize(userId, size);
    if (!fileSizeAllowed) {
      await deleteFile(storagePath);
      throw new Error('Fichier trop volumineux pour votre plan. Passez à un plan supérieur.');
    }

    // Check quota via PlanService
    const hasSpace = await PlanService.checkQuota(userId, size);

    if (!hasSpace) {
      // Delete uploaded file if quota exceeded
      await deleteFile(storagePath);
      throw new Error('Quota exceeded');
    }

    // Obtenir un nom unique pour éviter les doublons
    const uniqueName = await this.getUniqueFileName(name, folderId, userId);

    // Encrypt file
    await EncryptionService.encryptFile(storagePath);

    // Déterminer la catégorie basée sur le mimeType
    const category = this.getCategoryFromMimeType(mimeType);

    // Create file record
    const file = await prisma.file.create({
      data: {
        name: uniqueName,
        originalName,
        mimeType,
        size: BigInt(size),
        storagePath,
        userId,
        folderId,
        category,
      },
      include: {
        folder: true,
      },
    });

    // Update user quota via PlanService
    await PlanService.updateQuotaUsed(userId, size);

    // Audit log
    await AuditService.createLog(userId, 'UPLOAD', {
      fileName: uniqueName,
      fileId: file.id,
      folderId: folderId,
    });


    // Emit socket event
    SocketService.emitToUser(userId, 'file_uploaded', file);
    if (folderId) {
      SocketService.emitToUser(userId, 'folder_updated', { folderId });
    }

    return file;
  }

  static async getFile(fileId: string, userId: string) {
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId,
        isDeleted: false,
      },
      include: {
        folder: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!file) {
      throw new Error('File not found');
    }

    return file;
  }

  static async listFiles(
    userId: string,
    folderId?: string,
    sortBy: string = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
    filters?: {
      minSize?: number;
      maxSize?: number;
      mimeType?: string;
      dateFrom?: Date;
      dateTo?: Date;
    }
  ) {
    // Validation des champs de tri autorisés
    const allowedSortFields = ['name', 'size', 'createdAt', 'updatedAt', 'mimeType'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    // Construction de la clause WHERE
    const whereClause: any = {
      userId,
      folderId: folderId || null,
      isDeleted: false,
    };

    // Application des filtres
    if (filters) {
      if (filters.minSize !== undefined) {
        whereClause.size = { ...whereClause.size, gte: BigInt(filters.minSize) };
      }
      if (filters.maxSize !== undefined) {
        whereClause.size = { ...whereClause.size, lte: BigInt(filters.maxSize) };
      }
      if (filters.mimeType) {
        whereClause.mimeType = { contains: filters.mimeType, mode: 'insensitive' };
      }
      if (filters.dateFrom) {
        whereClause.createdAt = { ...whereClause.createdAt, gte: filters.dateFrom };
      }
      if (filters.dateTo) {
        whereClause.createdAt = { ...whereClause.createdAt, lte: filters.dateTo };
      }
    }

    // Check if folder is shared with user
    let sharedFolderPermissions: any = null;
    if (folderId) {
      sharedFolderPermissions = await prisma.sharedFolder.findFirst({
        where: {
          folderId,
          sharedWithId: userId,
        },
      });
    }

    // If folder is shared with user, return files from that folder with shared permissions
    if (folderId && sharedFolderPermissions) {
      const files = await prisma.file.findMany({
        where: {
          folderId,
          isDeleted: false,
          // Nous n'appliquons PAS les filtres ici pour les dossiers partagés pour l'instant (complexité)
          // Mais on pourrait le faire si nécessaire via include -> permissions
        },
        include: {
          folder: true,
          tags: {
            include: {
              tag: true,
            },
          },
          sharedWith: {
            where: {
              sharedWithId: userId,
            },
          },
        },
        orderBy: {
          [safeSortBy]: sortOrder,
        },
      });

      // Map files to include shared permissions
      return files.map((file: any) => ({
        ...file,
        // Include shared folder permissions for UI
        _sharedFolderPermissions: {
          canRead: sharedFolderPermissions.canRead,
          canWrite: sharedFolderPermissions.canWrite,
          canDelete: sharedFolderPermissions.canDelete,
          canShare: sharedFolderPermissions.canShare,
        },
      }));
    }

    return await prisma.file.findMany({
      where: whereClause,
      include: {
        folder: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: {
        [safeSortBy]: sortOrder,
      },
    });
  }

  static async updateFile(fileId: string, userId: string, data: { name?: string }) {
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId,
        isDeleted: false,
      },
    });

    if (!file) {
      throw new Error('File not found');
    }

    const updatedFile = await prisma.file.update({
      where: { id: fileId },
      data,
    });

    // Audit log for rename
    if (data.name && data.name !== file.name) {
      await AuditService.createLog(userId, 'RENAME_FILE', {
        fileName: data.name,
        fileId: file.id,
        oldName: file.name,
      });


      // Emit socket event
      SocketService.emitToUser(userId, 'file_updated', updatedFile);
    }

    return updatedFile;
  }

  static async replaceFileContent(
    fileId: string,
    userId: string,
    newFilePath: string,
    newFileName: string,
    newFileSize: number,
    newMimeType: string
  ) {
    // Créer une version de l'ancien fichier avant de le remplacer
    await VersionService.createVersion(
      fileId,
      userId,
      newFilePath,
      newFileName,
      newFileSize,
      newMimeType
    );

    // Le fichier principal est déjà mis à jour par createVersion
    return await this.getFile(fileId, userId);
  }

  static async moveFile(fileId: string, userId: string, targetFolderId?: string) {
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId,
        isDeleted: false,
      },
    });

    if (!file) {
      throw new Error('File not found');
    }

    // Verify target folder exists and belongs to user
    if (targetFolderId) {
      const targetFolder = await prisma.folder.findFirst({
        where: {
          id: targetFolderId,
          userId,
        },
      });

      if (!targetFolder) {
        throw new Error('Target folder not found');
      }
    }

    const movedFile = await prisma.file.update({
      where: { id: fileId },
      data: {
        folderId: targetFolderId || null,
      },
    });

    // Audit log
    await AuditService.createLog(userId, 'MOVE_FILE', {
      fileName: file.name,
      fileId: file.id,
      folderId: targetFolderId,
    });

    return movedFile;
  }

  static async deleteFile(fileId: string, userId: string, permanent: boolean = false) {
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId,
      },
    });

    if (!file) {
      throw new Error('File not found');
    }

    if (permanent || file.isDeleted) {
      // Permanently delete
      await deleteFile(file.storagePath);
      await prisma.file.delete({
        where: { id: fileId },
      });

      // Update user quota
      await PlanService.updateQuotaUsed(userId, -Number(file.size));
    } else {
      // Move to trash
      await prisma.file.update({
        where: { id: fileId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });
    }

    // Audit log
    await AuditService.createLog(userId, 'DELETE', {
      fileName: file.name,
      fileId: file.id,
      permanent,
    });

    // Emit socket event
    SocketService.emitToUser(userId, 'file_deleted', { fileId });

    return { message: 'File deleted successfully' };
  }

  static async restoreFile(fileId: string, userId: string) {
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId,
        isDeleted: true,
      },
    });

    if (!file) {
      throw new Error('File not found in trash');
    }

    const restoredFile = await prisma.file.update({
      where: { id: fileId },
      data: {
        isDeleted: false,
        deletedAt: null,
      },
    });

    // Audit log
    await AuditService.createLog(userId, 'RESTORE', {
      fileName: file.name,
      fileId: file.id,
    });

    return restoredFile;
  }

  static async getDeletedFiles(userId: string) {
    return await prisma.file.findMany({
      where: {
        userId,
        isDeleted: true,
      },
      include: {
        folder: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: {
        deletedAt: 'desc',
      },
    });
  }

  static async searchFiles(userId: string, query: string, filters?: {
    mimeType?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }) {
    const where: any = {
      userId,
      isDeleted: false,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { originalName: { contains: query, mode: 'insensitive' } },
      ],
    };

    if (filters?.mimeType) {
      where.mimeType = { startsWith: filters.mimeType };
    }

    if (filters?.dateFrom) {
      where.createdAt = { ...where.createdAt, gte: filters.dateFrom };
    }

    if (filters?.dateTo) {
      where.createdAt = { ...where.createdAt, lte: filters.dateTo };
    }

    return await prisma.file.findMany({
      where,
      include: {
        folder: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  static async getRecentFiles(userId: string, limit: number = 5) {
    return await prisma.file.findMany({
      where: {
        userId,
        isDeleted: false,
      },
      include: {
        folder: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: limit,
    });
  }

  static async toggleFavorite(fileId: string, userId: string) {
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId,
        isDeleted: false,
      },
    });

    if (!file) {
      throw new Error('Fichier introuvable');
    }

    const updatedFile = await prisma.file.update({
      where: { id: fileId },
      data: {
        isFavorite: !file.isFavorite,
      },
      include: {
        folder: true,
      },
    });

    return updatedFile;
  }

  static async getFavoriteFiles(userId: string) {
    return await prisma.file.findMany({
      where: {
        userId,
        isDeleted: false,
        isFavorite: true,
      },
      include: {
        folder: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  // Get accepted shared files and folders for a user (to display in FilesPage)
  static async getAcceptedShares(userId: string) {
    const [sharedFolders, sharedFiles] = await Promise.all([
      prisma.sharedFolder.findMany({
        where: {
          sharedWithId: userId,
          accepted: true,
        },
        include: {
          folder: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
          },
          sharedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      }),
      prisma.sharedFile.findMany({
        where: {
          sharedWithId: userId,
          accepted: true,
        },
        include: {
          file: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
              tags: {
                include: {
                  tag: true,
                },
              },
            },
          },
          sharedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      }),
    ]);

    return {
      folders: sharedFolders,
      files: sharedFiles,
    };
  }

  static async incrementViewCount(fileId: string) {
    await prisma.file.update({
      where: { id: fileId },
      data: {
        views: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    });
  }

  static async incrementDownloadCount(fileId: string) {
    await prisma.file.update({
      where: { id: fileId },
      data: {
        downloads: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    });
  }
}
