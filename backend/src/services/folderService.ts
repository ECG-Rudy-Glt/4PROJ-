import prisma from '../config/database';
import archiver from 'archiver';
import { Response } from 'express';
import { AuditService } from './auditService';
import { SocketService } from './socketService';
import { VaultService } from './vaultService';
import { PlanService } from './planService';
import { EncryptionService } from './encryptionService';
import { StorageService } from './storageService';
import logger from '../config/logger';
import { AppError } from '../middlewares/errorHandler';
import { findSharedFolderAccessRoot } from '../middlewares/permissions';

async function deleteStorageFileBestEffort(pathOrKey: string, fileId: string): Promise<void> {
  try {
    await StorageService.deleteStorageFile(pathOrKey);
  } catch (err) {
    logger.error(`Error deleting storage object ${pathOrKey} for file ${fileId}: ${err}`);
  }
}

async function deleteStorageFileOnceBestEffort(
  pathOrKey: string | null | undefined,
  fileId: string,
  deletedStoragePaths: Set<string>
): Promise<void> {
  if (!pathOrKey || deletedStoragePaths.has(pathOrKey)) {
    return;
  }

  deletedStoragePaths.add(pathOrKey);
  await deleteStorageFileBestEffort(pathOrKey, fileId);
}

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
      throw new AppError(409, 'Folder with this name already exists');
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
        throw new AppError(404, 'Parent folder not found');
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
      throw new AppError(404, 'Folder not found');
    }

    await VaultService.assertUnlockedIfVault(userId, folder.isVault);

    return folder;
  }

  static async listFolders(userId: string, parentId?: string) {
    const vaultUnlocked = await VaultService.isVaultUnlocked(userId);
    if (parentId) {
      const parent = await prisma.folder.findUnique({
        where: { id: parentId },
        select: { userId: true, isVault: true },
      });

      if (!parent) {
        throw new AppError(404, 'Parent folder not found');
      }

      if (parent.userId !== userId) {
        const sharedRoot = await findSharedFolderAccessRoot(userId, parentId, 'read');
        if (!sharedRoot) {
          throw new AppError(403, 'Folder not shared with you');
        }

        const folders = await prisma.folder.findMany({
          where: {
            parentId,
            isDeleted: false,
            isVault: false,
          },
          include: {
            children: true,
          },
          orderBy: {
            name: 'asc',
          },
        });

        return folders.map((folder: any) => ({
          ...folder,
          _sharedFolderPermissions: {
            canRead: sharedRoot.canRead,
            canWrite: sharedRoot.canWrite,
            canDelete: sharedRoot.canDelete,
            canShare: sharedRoot.canShare,
          },
        }));
      }

      await VaultService.assertUnlockedIfVault(userId, parent.isVault);
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
      throw new AppError(404, 'Folder not found');
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
      throw new AppError(409, 'Folder with this name already exists');
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
      throw new AppError(404, 'Folder not found');
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
        throw new AppError(404, 'Target parent folder not found');
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
      throw new AppError(409, 'Folder with this name already exists in target location');
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
      },
    });

    if (!folder) {
      throw new AppError(404, 'Folder not found');
    }

    const isOwner = folder.userId === userId;
    if (isOwner) {
      await VaultService.assertUnlockedIfVault(userId, folder.isVault);
    } else {
      if (permanent || folder.isDeleted) {
        throw new AppError(403, 'Only the owner can permanently delete this folder');
      }

      const sharedRoot = await findSharedFolderAccessRoot(userId, folderId, 'delete');
      if (!sharedRoot) {
        throw new AppError(403, "Vous n'avez pas la permission de supprimer ce dossier");
      }
    }

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
          versions: {
            select: {
              id: true,
              storagePath: true,
              size: true,
            },
          },
        }
      });

      // 2. Supprimer physiquement chaque fichier et ajuster les quotas
      const deletedStoragePaths = new Set<string>();
      for (const file of filesInFolder) {
        try {
          await deleteStorageFileOnceBestEffort(file.storagePath, file.id, deletedStoragePaths);
          await deleteStorageFileOnceBestEffort(file.thumbnailPath, file.id, deletedStoragePaths);
          for (const version of file.versions) {
            await deleteStorageFileOnceBestEffort(version.storagePath, file.id, deletedStoragePaths);
          }
          await PlanService.updateQuotaUsed(file.userId, -file.size);
          for (const version of file.versions) {
            await PlanService.updateQuotaUsed(file.userId, -version.size);
          }
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
    SocketService.emitToUser(folder.userId, 'folder_deleted', { folderId });

    return { message: 'Folder deleted successfully' };
  }

  static async getFolderBreadcrumbs(folderId: string, userId: string) {
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder) {
      throw new AppError(404, 'Folder not found');
    }

    const isOwner = folder.userId === userId;
    const sharedRoot = isOwner ? null : await findSharedFolderAccessRoot(userId, folderId, 'read');

    if (!isOwner && !sharedRoot) {
      throw new AppError(403, 'Folder not shared with you');
    }

    if (isOwner) {
      await VaultService.assertUnlockedIfVault(userId, folder.isVault);
    }

    const chain: Array<{ id: string; name: string }> = [];
    let currentFolder = folder;

    while (currentFolder) {
      chain.unshift({
        id: currentFolder.id,
        name: currentFolder.name,
      });

      if (sharedRoot && currentFolder.id === sharedRoot.folderId) {
        break;
      }

      if (currentFolder.parentId) {
        const parent = await prisma.folder.findUnique({
          where: { id: currentFolder.parentId },
        });
        currentFolder = parent as any;
      } else {
        break;
      }
    }

    return chain;
  }

  static async restoreFolder(folderId: string, userId: string) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId, isDeleted: true },
    });
    if (!folder) throw new AppError(404, 'Folder not found in trash');
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
