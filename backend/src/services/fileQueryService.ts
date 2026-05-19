import prisma from '../config/database';
import { VaultService } from './vaultService';
import { AppError } from '../middlewares/errorHandler';
import { acceptedShareBaseWhere, findSharedFolderAccessRoot } from '../middlewares/permissions';
import { ShareKeyService } from './shareKeyService';

const fileInclude = {
  folder: true,
  tags: { include: { tag: true } },
};

const allowedSortFields = ['name', 'size', 'createdAt', 'updatedAt', 'mimeType'];

export class FileQueryService {
  static async getFile(fileId: string, userId: string) {
    const file = await prisma.file.findFirst({
      where: { id: fileId, userId, isDeleted: false },
      include: { ...fileInclude },
    });

    if (!file) throw new AppError(404, 'File not found');
    await VaultService.assertUnlockedIfVault(userId, file.isVault);
    return file;
  }

  static async listFiles(
    userId: string,
    folderId?: string,
    sortBy = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
    filters?: { minSize?: number; maxSize?: number; mimeType?: string; dateFrom?: Date; dateTo?: Date },
    take = 50,
    skip = 0
  ) {
    const vaultUnlocked = await VaultService.isVaultUnlocked(userId);
    if (folderId) {
      const folderIsVault = await VaultService.isVaultFolder(userId, folderId);
      await VaultService.assertUnlockedIfVault(userId, folderIsVault);
    }

    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const whereClause: any = {
      userId,
      folderId: folderId || null,
      isDeleted: false,
      ...(vaultUnlocked ? {} : { isVault: false }),
    };

    if (filters) {
      if (filters.minSize !== undefined) whereClause.size = { ...whereClause.size, gte: BigInt(filters.minSize) };
      if (filters.maxSize !== undefined) whereClause.size = { ...whereClause.size, lte: BigInt(filters.maxSize) };
      if (filters.mimeType) whereClause.mimeType = { contains: filters.mimeType, mode: 'insensitive' };
      if (filters.dateFrom) whereClause.createdAt = { ...whereClause.createdAt, gte: filters.dateFrom };
      if (filters.dateTo) whereClause.createdAt = { ...whereClause.createdAt, lte: filters.dateTo };
    }

    if (folderId) {
      const sharedFolderPerms = await findSharedFolderAccessRoot(userId, folderId, 'read');

      if (sharedFolderPerms) {
        const files = await prisma.file.findMany({
          where: { folderId, isDeleted: false, ...(vaultUnlocked ? {} : { isVault: false }) },
          include: { ...fileInclude, sharedWith: { where: acceptedShareBaseWhere(userId) } },
          orderBy: { [safeSortBy]: sortOrder },
          take,
          skip,
        });

        return files.map((file: any) => ({
          ...file,
          _sharedFolderPermissions: {
            canRead: sharedFolderPerms.canRead,
            canWrite: sharedFolderPerms.canWrite,
            canDelete: sharedFolderPerms.canDelete,
            canShare: sharedFolderPerms.canShare,
          },
          _shareId: sharedFolderPerms.id,
          _sharedRootFolderId: sharedFolderPerms.folderId,
          passwordProtected: Boolean(sharedFolderPerms.passwordHash),
        }));
      }
    }

    return prisma.file.findMany({
      where: whereClause,
      include: fileInclude,
      orderBy: { [safeSortBy]: sortOrder },
      take,
      skip,
    });
  }

  static async searchFiles(
    userId: string,
    query: string,
    filters?: { mimeType?: string; dateFrom?: Date; dateTo?: Date }
  ) {
    const vaultUnlocked = await VaultService.isVaultUnlocked(userId);
    const where: any = {
      userId,
      isDeleted: false,
      ...(vaultUnlocked ? {} : { isVault: false }),
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { originalName: { contains: query, mode: 'insensitive' } },
        { searchIndex: { is: { extractedText: { contains: query, mode: 'insensitive' } } } },
      ],
    };

    if (filters?.mimeType) where.mimeType = { startsWith: filters.mimeType };
    if (filters?.dateFrom) where.createdAt = { ...where.createdAt, gte: filters.dateFrom };
    if (filters?.dateTo) where.createdAt = { ...where.createdAt, lte: filters.dateTo };

    return prisma.file.findMany({ where, include: { folder: true }, orderBy: { createdAt: 'desc' } });
  }

  static async getRecentFiles(userId: string, limit = 5) {
    const vaultUnlocked = await VaultService.isVaultUnlocked(userId);
    return prisma.file.findMany({
      where: { userId, isDeleted: false, ...(vaultUnlocked ? {} : { isVault: false }) },
      include: { folder: true },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  static async getDeletedFiles(userId: string) {
    const vaultUnlocked = await VaultService.isVaultUnlocked(userId);
    return prisma.file.findMany({
      where: { userId, isDeleted: true, ...(vaultUnlocked ? {} : { isVault: false }) },
      include: fileInclude,
      orderBy: { deletedAt: 'desc' },
    });
  }

  static async getFavoriteFiles(userId: string) {
    const vaultUnlocked = await VaultService.isVaultUnlocked(userId);
    return prisma.file.findMany({
      where: { userId, isDeleted: false, isFavorite: true, ...(vaultUnlocked ? {} : { isVault: false }) },
      include: fileInclude,
      orderBy: { updatedAt: 'desc' },
    });
  }

  static async getAcceptedShares(userId: string) {
    const vaultUnlocked = await VaultService.isVaultUnlocked(userId);
    const [sharedFolders, sharedFiles] = await Promise.all([
      prisma.sharedFolder.findMany({
        where: { sharedWithId: userId, accepted: true, ...(vaultUnlocked ? {} : { folder: { isVault: false } }) },
        include: {
          folder: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } } } },
          sharedBy: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
        },
      }),
      prisma.sharedFile.findMany({
        where: { sharedWithId: userId, accepted: true, ...(vaultUnlocked ? {} : { file: { isVault: false } }) },
        include: {
          file: {
            include: {
              user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
              tags: { include: { tag: true } },
            },
          },
          sharedBy: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
        },
      }),
    ]);
    return {
      folders: ShareKeyService.stripOwnerWrappedDekMany(sharedFolders),
      files: ShareKeyService.stripOwnerWrappedDekMany(sharedFiles),
    };
  }
}
