import prisma from '../config/database';
import { AuditService } from './auditService';
import { SocketService } from './socketService';
import { VaultService } from './vaultService';

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
    }).catch(console.error);

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

  static async deleteFolder(folderId: string, userId: string) {
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

    // This will cascade delete all children folders and files
    await prisma.folder.delete({
      where: { id: folderId },
    });

    // Audit log
    AuditService.createLog(userId, 'DELETE_FOLDER', {
      folderId: folder.id,
      folderName: folder.name,
    }).catch(console.error);

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
}
