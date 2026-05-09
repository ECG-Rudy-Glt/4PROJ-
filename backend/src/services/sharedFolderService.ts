import prisma from '../config/database';
import { MailService } from './mailService';
import { AuditService } from './auditService';
import { SocketService } from './socketService';
import { SharedLinkService } from './sharedLinkService';
import { ShareKeyService } from './shareKeyService';
import logger from '../config/logger';

type Permissions = {
  canRead?: boolean;
  canWrite?: boolean;
  canDelete?: boolean;
  canShare?: boolean;
};

const DEFAULT_PERMS: Required<Permissions> = {
  canRead: true,
  canWrite: false,
  canDelete: false,
  canShare: false,
};

const resolvePerms = (input: Permissions) => ({
  canRead: input.canRead ?? DEFAULT_PERMS.canRead,
  canWrite: input.canWrite ?? DEFAULT_PERMS.canWrite,
  canDelete: input.canDelete ?? DEFAULT_PERMS.canDelete,
  canShare: input.canShare ?? DEFAULT_PERMS.canShare,
});

const sharedBySelect = { select: { id: true, email: true, firstName: true, lastName: true } };
const sharedWithSelect = { select: { id: true, email: true, firstName: true, lastName: true } };

export class SharedFolderService {
  private static async isFolderWithinRoot(folderId: string, rootFolderId: string): Promise<boolean> {
    if (folderId === rootFolderId) return true;

    const visited = new Set<string>();
    let current = await prisma.folder.findUnique({
      where: { id: folderId },
      select: { parentId: true },
    });

    while (current?.parentId) {
      if (current.parentId === rootFolderId) return true;
      if (visited.has(current.parentId)) return false;
      visited.add(current.parentId);
      current = await prisma.folder.findUnique({
        where: { id: current.parentId },
        select: { parentId: true },
      });
    }

    return false;
  }

  static async shareFolder(
    userId: string,
    folderId: string,
    targetUserId: string,
    permissions: Permissions = {},
    ownerWrappedDek?: string
  ) {
    const folder = await prisma.folder.findFirst({ where: { id: folderId, userId } });
    if (!folder) throw new Error('Folder not found');
    if (folder.isVault) throw new Error('Le partage est interdit pour les dossiers du coffre-fort');

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) throw new Error('Target user not found');

    const existing = await prisma.sharedFolder.findFirst({ where: { folderId, sharedWithId: targetUserId } });
    if (existing) throw new Error('Folder already shared with this user');

    await SharedLinkService.assertShareLimit(userId);

    const sharedFolder = await prisma.sharedFolder.create({
      data: { folderId, sharedById: userId, sharedWithId: targetUserId, ownerWrappedDek, ...resolvePerms(permissions) },
      include: {
        folder: true,
        sharedBy: sharedBySelect,
        sharedWith: sharedWithSelect,
      },
    });

    try {
      const owner = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      await MailService.sendShareNotification(targetUser.email, owner?.email || 'Un utilisateur', folder.name, 'folder');
    } catch (error) {
      logger.error({ err: error }, 'Error sending folder share notification');
    }

    AuditService.createLog(userId, 'SHARE', { folderName: folder.name, folderId }).catch((e) => logger.error(e));
    SocketService.emitToUser(targetUserId, 'share_received', { type: 'folder', folderName: folder.name });

    return ShareKeyService.stripOwnerWrappedDek(sharedFolder);
  }

  static async listSharedWithMe(userId: string) {
    const sharedFolders = await prisma.sharedFolder.findMany({
      where: { sharedWithId: userId, accepted: true },
      include: { folder: true, sharedBy: sharedBySelect },
      orderBy: { createdAt: 'desc' },
    });
    return ShareKeyService.stripOwnerWrappedDekMany(sharedFolders);
  }

  static async listSharedByMe(userId: string) {
    const sharedFolders = await prisma.sharedFolder.findMany({
      where: { sharedById: userId },
      include: { folder: true, sharedWith: sharedWithSelect },
      orderBy: { createdAt: 'desc' },
    });
    return ShareKeyService.stripOwnerWrappedDekMany(sharedFolders);
  }

  static async updatePermissions(shareId: string, userId: string, permissions: Permissions) {
    const sharedFolder = await prisma.sharedFolder.findFirst({ where: { id: shareId, sharedById: userId } });
    if (!sharedFolder) throw new Error('Shared folder not found');

    const updatedShare = await prisma.sharedFolder.update({
      where: { id: shareId },
      data: {
        canRead: permissions.canRead ?? sharedFolder.canRead,
        canWrite: permissions.canWrite ?? sharedFolder.canWrite,
        canDelete: permissions.canDelete ?? sharedFolder.canDelete,
        canShare: permissions.canShare ?? sharedFolder.canShare,
      },
      include: { folder: true, sharedBy: sharedBySelect, sharedWith: sharedWithSelect },
    });
    return ShareKeyService.stripOwnerWrappedDek(updatedShare);
  }

  static async removeSharedFolder(shareId: string, userId: string) {
    const sharedFolder = await prisma.sharedFolder.findFirst({ where: { id: shareId, sharedById: userId } });
    if (!sharedFolder) throw new Error('Shared folder not found');

    await prisma.sharedFolder.delete({ where: { id: shareId } });
    return { message: 'Shared folder removed successfully' };
  }

  static async getPendingFolders(userId: string) {
    const pendingFolders = await prisma.sharedFolder.findMany({
      where: { sharedWithId: userId, accepted: false },
      include: {
        folder: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } } } },
        sharedBy: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
      },
    });
    return ShareKeyService.stripOwnerWrappedDekMany(pendingFolders);
  }

  static async acceptSharedFolder(shareId: string, userId: string) {
    const sharedFolder = await prisma.sharedFolder.findUnique({ where: { id: shareId } });
    if (!sharedFolder || sharedFolder.sharedWithId !== userId) throw new Error('Shared folder not found or not shared with you');

    const acceptedFolder = await prisma.sharedFolder.update({
      where: { id: shareId },
      data: { accepted: true },
      include: { folder: true, sharedBy: sharedBySelect },
    });
    return ShareKeyService.stripOwnerWrappedDek(acceptedFolder);
  }

  static async rejectSharedFolder(shareId: string, userId: string) {
    const sharedFolder = await prisma.sharedFolder.findUnique({ where: { id: shareId } });
    if (!sharedFolder || sharedFolder.sharedWithId !== userId) throw new Error('Shared folder not found or not shared with you');

    return prisma.sharedFolder.delete({ where: { id: shareId } });
  }

  static async getSharedFolderContents(folderId: string, userId: string, rootFolderId?: string) {
    const idToCheck = rootFolderId ?? folderId;
    const share = await prisma.sharedFolder.findFirst({
      where: { folderId: idToCheck, sharedWithId: userId, accepted: true, canRead: true },
    });
    if (!share) throw new Error('Accès refusé à ce dossier');
    const isAllowedFolder = await SharedFolderService.isFolderWithinRoot(folderId, idToCheck);
    if (!isAllowedFolder) throw new Error('Accès refusé à ce dossier');

    const [files, subfolders] = await Promise.all([
      prisma.file.findMany({
        where: { folderId, isDeleted: false, isVault: false },
        orderBy: { name: 'asc' },
      }),
      prisma.folder.findMany({
        where: { parentId: folderId, isDeleted: false, isVault: false },
        orderBy: { name: 'asc' },
      }),
    ]);

    return { files, folders: subfolders };
  }

  static async getAcceptedSharedFolders(userId: string, vaultUnlocked: boolean) {
    const sharedFolders = await prisma.sharedFolder.findMany({
      where: {
        sharedWithId: userId,
        accepted: true,
        ...(vaultUnlocked ? {} : { folder: { isVault: false } }),
      },
      include: {
        folder: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } } } },
        sharedBy: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
      },
    });
    return ShareKeyService.stripOwnerWrappedDekMany(sharedFolders);
  }
}
