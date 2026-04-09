import prisma from '../config/database';
import fs from 'fs/promises';
import archiver from 'archiver';
import { Response } from 'express';
import { AuditService } from './auditService';
import { SocketService } from './socketService';
import { VaultService } from './vaultService';
import { PlanService } from './planService';
import { EncryptionService } from './encryptionService';
import logger from '../config/logger';

export class FolderService {
  static async createFolder(userId: string, name: string, parentId?: string) {
    // Check if folder with same name exists in parent
    const existing = await prisma.folder.findFirst({
      where: {
        userId,
        name,
        parentId: parentId || null,
      },
    });

    if (existing) {
      throw new Error('Folder with this name already exists');
    }

    // Build path
    let path = `/${name}`;
    let isVault = false;
    if (parentId) {
      const parent = await prisma.folder.findFirst({
        where: {
          id: parentId,
          userId,
        },
        select: {
          id: true,
          path: true,
          isVault: true,
        },
      });

      if (!parent) {
        throw new Error('Parent folder not found');
      }

      await VaultService.assertUnlockedIfVault(userId, parent.isVault);

      path = `${parent.path}/${name}`;
      isVault = parent.isVault;
    }

    const folder = await prisma.folder.create({
      data: {
        name,
        userId,
        parentId: parentId || null,
        path,
        isVault,
      },
      include: {
        parent: true,
      },
    });

    // Audit log
    AuditService.createLog(userId, 'CREATE_FOLDER', {
      folderId: folder.id,
      folderName: name,
    }).catch((e) => logger.error(e));

    // Socket event
    SocketService.emitToUser(userId, 'folder_created', folder);

    return folder;
  }

  static async getFolder(folderId: string, userId: string) {
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId,
      },
      include: {
        parent: true,
        children: true,
      },
    });

    if (!folder) {
      throw new Error('Folder not found');
    }

    await VaultService.assertUnlockedIfVault(userId, folder.isVault);

    return folder;
  }

  static async listFolders(userId: string, parentId?: string) {
    const vaultUnlocked = await VaultService.isVaultUnlocked(userId);
    if (parentId) {
      const parentIsVault = await VaultService.isVaultFolder(userId, parentId);
      await VaultService.assertUnlockedIfVault(userId, parentIsVault);
    }

    return await prisma.folder.findMany({
      where: {
        userId,
        parentId: parentId || null,
        isDeleted: false,
        ...(vaultUnlocked ? {} : { isVault: false }),
      },
      include: {
        children: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  static async updateFolder(folderId: string, userId: string, name: string) {
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId,
      },
    });

    if (!folder) {
      throw new Error('Folder not found');
    }

    await VaultService.assertUnlockedIfVault(userId, folder.isVault);

    // Check for duplicate name in same parent
    const existing = await prisma.folder.findFirst({
      where: {
        userId,
        name,
        parentId: folder.parentId,
        id: { not: folderId },
      },
    });

    if (existing) {
      throw new Error('Folder with this name already exists');
    }

    // Update path
    let newPath = `/${name}`;
    if (folder.parentId) {
      const parent = await prisma.folder.findUnique({
        where: { id: folder.parentId },
      });
      if (parent) {
        newPath = `${parent.path}/${name}`;
      }
    }

    return await prisma.folder.update({
      where: { id: folderId },
      data: {
        name,
        path: newPath,
      },
    });
  }

  static async moveFolder(folderId: string, userId: string, targetParentId?: string) {
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId,
      },
    });

    if (!folder) {
      throw new Error('Folder not found');
    }

    await VaultService.assertUnlockedIfVault(userId, folder.isVault);

    // Prevent moving folder into itself or its children
    if (targetParentId) {
      if (targetParentId === folderId) {
        throw new Error('Cannot move folder into itself');
      }

      const targetParent = await prisma.folder.findFirst({
        where: {
          id: targetParentId,
          userId,
        },
        select: {
          id: true,
          path: true,
          isVault: true,
        },
      });

      if (!targetParent) {
        throw new Error('Target parent folder not found');
      }

      await VaultService.assertUnlockedIfVault(userId, targetParent.isVault);

      if (folder.isVault !== targetParent.isVault) {
        throw new Error('Déplacement entre espace normal et coffre-fort interdit');
      }

      // Check if target is a child of the folder being moved
      if (targetParent.path.startsWith(folder.path)) {
        throw new Error('Cannot move folder into its own child');
      }
    }

    // Check for duplicate name in target parent
    const existing = await prisma.folder.findFirst({
      where: {
        userId,
        name: folder.name,
        parentId: targetParentId || null,
        id: { not: folderId },
      },
    });

    if (existing) {
      throw new Error('Folder with this name already exists in target location');
    }

    // Update path
    let newPath = `/${folder.name}`;
    if (targetParentId) {
      const parent = await prisma.folder.findUnique({
        where: { id: targetParentId },
      });
      if (parent) {
        newPath = `${parent.path}/${folder.name}`;
      }
    }

    return await prisma.folder.update({
      where: { id: folderId },
      data: {
        parentId: targetParentId || null,
        path: newPath,
        isVault: folder.isVault,
      },
    });
  }

  static async deleteFolder(folderId: string, userId: string, permanent = false) {
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId,
      },
    });

    if (!folder) {
      throw new Error('Folder not found');
    }

    await VaultService.assertUnlockedIfVault(userId, folder.isVault);

    if (permanent || folder.isDeleted) {
      // 1. Trouver tous les fichiers dans ce dossier et ses sous-dossiers pour suppression physique
      const filesInFolder = await prisma.file.findMany({
        where: {
          OR: [
            { folderId: folder.id },
            { folder: { path: { startsWith: `${folder.path}/` } } }
          ]
        },
        select: {
          id: true,
          storagePath: true,
          thumbnailPath: true,
          size: true,
          userId: true,
        }
      });

      // 2. Supprimer physiquement chaque fichier et ajuster les quotas
      for (const file of filesInFolder) {
        try {
          await fs.unlink(file.storagePath).catch(() => {});
          if (file.thumbnailPath) await fs.unlink(file.thumbnailPath).catch(() => {});
          await PlanService.updateQuotaUsed(file.userId, -Number(file.size));
          // File record suppression is handled by the manual delete loop below 
          // to ensure consistency since File -> Folder is onDelete: SetNull
          await prisma.file.delete({ where: { id: file.id } });
        } catch (err) {
          logger.error(`Error purging file ${file.id} during folder deletion: ${err}`);
        }
      }

      // 3. Supprimer le dossier (cascades subfolders)
      await prisma.folder.delete({
        where: { id: folderId },
      });
    } else {
      await prisma.folder.update({
        where: { id: folderId },
        data: { isDeleted: true, deletedAt: new Date() },
      });
    }

    // Audit log
    AuditService.createLog(userId, 'DELETE_FOLDER', {
      folderId: folder.id,
      folderName: folder.name,
    }).catch((e) => logger.error(e));

    // Socket event
    SocketService.emitToUser(userId, 'folder_deleted', { folderId });

    return { message: 'Folder deleted successfully' };
  }

  static async getFolderBreadcrumbs(folderId: string, userId: string) {
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId,
      },
    });

    if (!folder) {
      throw new Error('Folder not found');
    }

    await VaultService.assertUnlockedIfVault(userId, folder.isVault);

    const breadcrumbs: Array<{ id: string; name: string }> = [];
    let currentFolder = folder;

    while (currentFolder) {
      breadcrumbs.unshift({
        id: currentFolder.id,
        name: currentFolder.name,
      });

      if (currentFolder.parentId) {
        const parent = await prisma.folder.findUnique({
          where: { id: currentFolder.parentId },
        });
        currentFolder = parent as any;
      } else {
        break;
      }
    }

    return breadcrumbs;
  }

  static async restoreFolder(folderId: string, userId: string) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId, isDeleted: true },
    });
    if (!folder) throw new Error('Folder not found in trash');
    await VaultService.assertUnlockedIfVault(userId, folder.isVault);

    const restoredFolder = await prisma.folder.update({
      where: { id: folderId },
      data: { isDeleted: false, deletedAt: null },
    });

    await AuditService.createLog(userId, 'RESTORE', { folderName: folder.name, folderId: folder.id });
    return restoredFolder;
  }

  static async getDeletedFolders(userId: string) {
    return await prisma.folder.findMany({
      where: { userId, isDeleted: true },
      orderBy: { deletedAt: 'desc' },
    });
  }

  static async streamFolderAsZip(folderId: string, userId: string, res: Response, dek?: Buffer): Promise<void> {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId },
      select: { id: true, name: true, isVault: true },
    });

    if (!folder) throw new Error('Folder not found');
    await VaultService.assertUnlockedIfVault(userId, folder.isVault);

    type FileEntry = { storagePath: string; entryPath: string };

    const collectFiles = async (currentFolderId: string, relativePath: string): Promise<FileEntry[]> => {
      const [files, subfolders] = await Promise.all([
        prisma.file.findMany({
          where: { folderId: currentFolderId, userId },
          select: { name: true, storagePath: true },
        }),
        prisma.folder.findMany({
          where: { parentId: currentFolderId, userId, isDeleted: false },
          select: { id: true, name: true },
        }),
      ]);

      const entries: FileEntry[] = files.map((f) => ({
        storagePath: f.storagePath,
        entryPath: `${relativePath}/${f.name}`,
      }));

      for (const sub of subfolders) {
        const subEntries = await collectFiles(sub.id, `${relativePath}/${sub.name}`);
        entries.push(...subEntries);
      }

      return entries;
    };

    const allFiles = await collectFiles(folderId, folder.name);

    const archive = archiver('zip', { zlib: { level: 6 } });

    archive.on('error', (err) => {
      logger.error({ err }, '[streamFolderAsZip] archiver error');
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create archive' });
      } else {
        res.destroy();
      }
    });

    archive.pipe(res);

    for (const { storagePath, entryPath } of allFiles) {
      const decryptStream = await EncryptionService.getDecryptStreamAuto(storagePath, dek);
      archive.append(decryptStream, { name: entryPath });
    }

    await archive.finalize();
  }

  static async getFolderTrashContents(folderId: string, userId: string) {
    const [files, folders] = await Promise.all([
      prisma.file.findMany({
        where: { folderId, userId },
        include: { tags: { include: { tag: true } } },
      }),
      prisma.folder.findMany({
        where: { parentId: folderId, userId },
      }),
    ]);

    return { files, folders };
  }
}
