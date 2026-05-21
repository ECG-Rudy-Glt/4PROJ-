import prisma from '../config/database';
import { FolderService } from './folderService';
import { AppError } from '../middlewares/errorHandler';

export const SYNC_ROOT_NAME = 'SupFile Sync';

export type SyncTreeFile = {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  checksum: string | null;
  folderId: string | null;
  updatedAt: Date;
  createdAt: Date;
};

export type SyncTreeFolder = {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  updatedAt: Date;
  createdAt: Date;
  folders: SyncTreeFolder[];
  files: SyncTreeFile[];
};

function normalizeChecksum(checksum: unknown): string | undefined {
  if (typeof checksum !== 'string') return undefined;
  const trimmed = checksum.trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(trimmed) ? trimmed : undefined;
}

function sameTimestamp(left?: string | Date | null, right?: string | Date | null): boolean {
  if (!left || !right) return false;
  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

function fileToTreeFile(file: any): SyncTreeFile {
  return {
    id: file.id,
    name: file.name,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: Number(file.size),
    checksum: file.checksum || null,
    folderId: file.folderId || null,
    updatedAt: file.updatedAt,
    createdAt: file.createdAt,
  };
}

export class SyncService {
  static normalizeChecksum = normalizeChecksum;

  static async getOrCreateRoot(userId: string) {
    const active = await prisma.folder.findFirst({
      where: {
        userId,
        parentId: null,
        name: SYNC_ROOT_NAME,
        isVault: false,
        isDeleted: false,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (active) return active;

    const deleted = await prisma.folder.findFirst({
      where: {
        userId,
        parentId: null,
        name: SYNC_ROOT_NAME,
        isVault: false,
        isDeleted: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (deleted) {
      return prisma.folder.update({
        where: { id: deleted.id },
        data: {
          isDeleted: false,
          deletedAt: null,
        },
      });
    }

    return FolderService.createFolder(userId, SYNC_ROOT_NAME);
  }

  static async assertRoot(userId: string, rootFolderId: string) {
    const root = await prisma.folder.findFirst({
      where: {
        id: rootFolderId,
        userId,
        parentId: null,
        name: SYNC_ROOT_NAME,
        isDeleted: false,
        isVault: false,
      },
    });

    if (!root) {
      throw new AppError(404, 'Sync root folder not found', 'SYNC_ROOT_NOT_FOUND');
    }

    return root;
  }

  static async assertFolderInsideRoot(userId: string, rootFolderId: string, folderId: string) {
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId,
        isDeleted: false,
        isVault: false,
      },
    });

    if (!folder) {
      throw new AppError(404, 'Target folder not found', 'SYNC_TARGET_FOLDER_NOT_FOUND');
    }

    if (!await this.isFolderInsideRoot(userId, rootFolderId, folder.id)) {
      throw new AppError(403, 'Target folder is outside sync root', 'SYNC_SCOPE_VIOLATION');
    }

    return folder;
  }

  static async getTree(userId: string, rootFolderId: string): Promise<SyncTreeFolder> {
    const root = await this.assertRoot(userId, rootFolderId);

    const buildFolder = async (folder: any): Promise<SyncTreeFolder> => {
      const [folders, files] = await Promise.all([
        prisma.folder.findMany({
          where: {
            userId,
            parentId: folder.id,
            isDeleted: false,
            isVault: false,
          },
          orderBy: { name: 'asc' },
        }),
        prisma.file.findMany({
          where: {
            userId,
            folderId: folder.id,
            isDeleted: false,
            isVault: false,
          },
          orderBy: { name: 'asc' },
        }),
      ]);

      return {
        id: folder.id,
        name: folder.name,
        path: folder.path,
        parentId: folder.parentId || null,
        updatedAt: folder.updatedAt,
        createdAt: folder.createdAt,
        folders: await Promise.all(folders.map(buildFolder)),
        files: files.map(fileToTreeFile),
      };
    };

    return buildFolder(root);
  }

  static async getFileForReplacement(userId: string, remoteFileId: string, rootFolderId?: string) {
    const file = await prisma.file.findFirst({
      where: {
        id: remoteFileId,
        userId,
        isDeleted: false,
        isVault: false,
      },
      include: {
        folder: true,
      },
    });

    if (!file || !rootFolderId) return file;

    if (
      !file.folder
      || file.folder.isDeleted
      || file.folder.isVault
      || !await this.isFolderInsideRoot(userId, rootFolderId, file.folder.id)
    ) {
      throw new AppError(403, 'Remote file is outside sync root', 'SYNC_SCOPE_VIOLATION');
    }

    return file;
  }

  static shouldRejectReplacement(currentFile: { updatedAt: Date }, baseRemoteUpdatedAt?: string) {
    return Boolean(baseRemoteUpdatedAt) && !sameTimestamp(currentFile.updatedAt, baseRemoteUpdatedAt);
  }

  static async isFolderInsideRoot(userId: string, rootFolderId: string, folderId: string): Promise<boolean> {
    const root = await this.assertRoot(userId, rootFolderId);
    if (folderId === root.id) return true;

    let currentId: string | null = folderId;
    const visited = new Set<string>();

    while (currentId) {
      if (visited.has(currentId)) return false;
      visited.add(currentId);

      const current = await prisma.folder.findFirst({
        where: {
          id: currentId,
          userId,
          isDeleted: false,
          isVault: false,
        },
        select: {
          id: true,
          parentId: true,
        },
      });

      if (!current) return false;
      if (current.id === rootFolderId) return true;
      if (current.parentId === rootFolderId) return true;
      currentId = current.parentId || null;
    }

    return false;
  }
}
