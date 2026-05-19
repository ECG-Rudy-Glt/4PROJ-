import prisma from '../config/database';
import { MailService } from './mailService';
import { AuditService } from './auditService';
import { SharedLinkService } from './sharedLinkService';
import { ShareKeyService } from './shareKeyService';
import { PlanService } from './planService';
import { findSharedFolderAccessRoot } from '../middlewares/permissions';
import { DEK_UNLOCK_REQUIRED } from '../utils/dekGuard';
import bcrypt from 'bcryptjs';
import logger from '../config/logger';
import { AppError } from '../middlewares/errorHandler';
import { vaultShareForbiddenError } from '../constants/shareErrors';

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

const userDisplayName = (user?: { email?: string | null; firstName?: string | null; lastName?: string | null }) => {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || user?.email || 'Un utilisateur';
};

export class SharedFolderService {
  private static async isFolderWithinRoot(folderId: string, rootFolderId: string): Promise<boolean> {
    if (folderId === rootFolderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: folderId, isDeleted: false, isVault: false },
        select: { id: true },
      });
      return Boolean(folder);
    }

    const visited = new Set<string>();
    let current = await prisma.folder.findUnique({
      where: { id: folderId },
      select: { parentId: true, isDeleted: true, isVault: true },
    });

    while (current?.parentId) {
      if (current.isDeleted || current.isVault) return false;
      if (current.parentId === rootFolderId) return true;
      if (visited.has(current.parentId)) return false;
      visited.add(current.parentId);
      current = await prisma.folder.findUnique({
        where: { id: current.parentId },
        select: { parentId: true, isDeleted: true, isVault: true },
      });
    }

    return false;
  }

  static async shareFolder(
    userId: string,
    folderId: string,
    targetUserId: string,
    permissions: Permissions = {},
    ownerWrappedDek?: string,
    password?: string
  ) {
    const folder = await prisma.folder.findFirst({ where: { id: folderId, isDeleted: false } });
    if (!folder) throw new Error('Folder not found');
    if (folder.isVault) throw vaultShareForbiddenError();

    const isOwner = folder.userId === userId;
    const sourceShare = isOwner ? null : await findSharedFolderAccessRoot(userId, folderId, 'share');
    if (!isOwner && !sourceShare) {
      throw new Error("Vous n'avez pas la permission de partager ce dossier");
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) throw new Error('Target user not found');
    if (targetUser.id === userId) throw new Error('Impossible de partager un dossier avec vous-même');
    if (targetUser.id === folder.userId) throw new Error('Le propriétaire a déjà accès à ce dossier');
    if (targetUser.accountStatus !== 'ACTIVE') {
      throw new Error('Le compte destinataire est inactif ou suspendu');
    }

    const existing = await prisma.sharedFolder.findFirst({ where: { folderId, sharedWithId: targetUserId } });
    if (existing) throw new Error('Folder already shared with this user');

    await SharedLinkService.assertShareLimit(userId);
    const shareWrappedDek = isOwner ? ownerWrappedDek : sourceShare?.ownerWrappedDek;
    if (!isOwner && !shareWrappedDek) throw new Error(DEK_UNLOCK_REQUIRED);

    let passwordHash: string | undefined;
    if (password) {
      await PlanService.assertFeature(userId, 'sharePassword');
      passwordHash = await bcrypt.hash(password, 10);
    }

    const sharedFolder = await prisma.sharedFolder.create({
      data: {
        folderId,
        sharedById: userId,
        sharedWithId: targetUserId,
        ownerWrappedDek: shareWrappedDek,
        passwordHash,
        ...resolvePerms(permissions),
      },
      include: {
        folder: true,
        sharedBy: sharedBySelect,
        sharedWith: sharedWithSelect,
      },
    });

    try {
      const owner = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true, lastName: true },
      });
      await MailService.sendShareNotification(
        targetUser.email,
        userDisplayName(owner),
        folder.name,
        'folder',
        undefined,
        targetUser.language,
        resolvePerms(permissions)
      );
    } catch (error) {
      logger.error({ err: error }, 'Error sending folder share notification');
    }

    AuditService.createLog(userId, 'SHARE', { folderName: folder.name, folderId }).catch((e) => logger.error(e));

    return ShareKeyService.stripOwnerWrappedDek(sharedFolder);
  }

  static async listSharedWithMe(userId: string) {
    const sharedFolders = await prisma.sharedFolder.findMany({
      where: { sharedWithId: userId, accepted: true, folder: { is: { isDeleted: false } } },
      include: { folder: true, sharedBy: sharedBySelect },
      orderBy: { createdAt: 'desc' },
    });
    return ShareKeyService.stripOwnerWrappedDekMany(sharedFolders);
  }

  static async listSharedByMe(userId: string) {
    const sharedFolders = await prisma.sharedFolder.findMany({
      where: { sharedById: userId, folder: { is: { isDeleted: false } } },
      include: { folder: true, sharedWith: sharedWithSelect },
      orderBy: { createdAt: 'desc' },
    });
    return ShareKeyService.stripOwnerWrappedDekMany(sharedFolders);
  }

  static async updatePermissions(
    shareId: string,
    userId: string,
    permissions: Permissions,
    options?: { password?: string, clearPassword?: boolean }
  ) {
    const sharedFolder = await prisma.sharedFolder.findFirst({
      where: { id: shareId, sharedById: userId, folder: { is: { isDeleted: false } } },
    });
    if (!sharedFolder) throw new Error('Shared folder not found');

    let passwordHashUpdate: string | null | undefined = undefined;
    if (options?.clearPassword) {
      passwordHashUpdate = null;
    } else if (options?.password) {
      await PlanService.assertFeature(userId, 'sharePassword');
      passwordHashUpdate = await bcrypt.hash(options.password, 10);
    }

    const updatedShare = await prisma.sharedFolder.update({
      where: { id: shareId },
      data: {
        canRead: permissions.canRead ?? sharedFolder.canRead,
        canWrite: permissions.canWrite ?? sharedFolder.canWrite,
        canDelete: permissions.canDelete ?? sharedFolder.canDelete,
        canShare: permissions.canShare ?? sharedFolder.canShare,
        ...(passwordHashUpdate !== undefined && { passwordHash: passwordHashUpdate }),
      },
      include: { folder: true, sharedBy: sharedBySelect, sharedWith: sharedWithSelect },
    });
    return ShareKeyService.stripOwnerWrappedDek(updatedShare);
  }

  static async removeSharedFolder(shareId: string, userId: string) {
    const sharedFolder = await prisma.sharedFolder.findFirst({
      where: { id: shareId, folder: { is: { isDeleted: false } } },
    });
    if (!sharedFolder) throw new AppError(404, 'Shared folder not found', 'SHARED_FOLDER_NOT_FOUND');
    if (sharedFolder.sharedById !== userId && sharedFolder.sharedWithId !== userId) {
      throw new AppError(403, 'Vous ne pouvez pas supprimer ce partage', 'SHARE_ACCESS_DENIED');
    }

    await prisma.sharedFolder.delete({ where: { id: shareId } });
    return { message: 'Shared folder removed successfully' };
  }

  static async getPendingFolders(userId: string) {
    const pendingFolders = await prisma.sharedFolder.findMany({
      where: { sharedWithId: userId, accepted: false, folder: { is: { isDeleted: false } } },
      include: {
        folder: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } } } },
        sharedBy: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
      },
    });
    return ShareKeyService.stripOwnerWrappedDekMany(pendingFolders);
  }

  static async acceptSharedFolder(shareId: string, userId: string) {
    const sharedFolder = await prisma.sharedFolder.findUnique({ where: { id: shareId }, include: { folder: true } });
    if (!sharedFolder || sharedFolder.sharedWithId !== userId || sharedFolder.folder.isDeleted) {
      throw new Error('Shared folder not found or not shared with you');
    }

    const acceptedFolder = await prisma.sharedFolder.update({
      where: { id: shareId },
      data: { accepted: true },
      include: { folder: true, sharedBy: sharedBySelect },
    });
    return ShareKeyService.stripOwnerWrappedDek(acceptedFolder);
  }

  static async rejectSharedFolder(shareId: string, userId: string) {
    const sharedFolder = await prisma.sharedFolder.findUnique({ where: { id: shareId }, include: { folder: true } });
    if (!sharedFolder || sharedFolder.sharedWithId !== userId || sharedFolder.folder.isDeleted) {
      throw new Error('Shared folder not found or not shared with you');
    }

    return prisma.sharedFolder.delete({ where: { id: shareId } });
  }

  static async getSharedFolderContents(folderId: string, userId: string, rootFolderId?: string) {
    const idToCheck = rootFolderId ?? folderId;
    const requestedFolder = await prisma.folder.findFirst({
      where: { id: folderId, isDeleted: false, isVault: false },
      select: { id: true },
    });
    if (!requestedFolder) throw new Error('Accès refusé à ce dossier');

    const share = await prisma.sharedFolder.findFirst({
      where: {
        folderId: idToCheck,
        sharedWithId: userId,
        accepted: true,
        canRead: true,
        folder: { is: { isDeleted: false, isVault: false } },
      },
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
        folder: { is: { isDeleted: false, ...(vaultUnlocked ? {} : { isVault: false }) } },
      },
      include: {
        folder: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } } } },
        sharedBy: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
      },
    });
    return ShareKeyService.stripOwnerWrappedDekMany(sharedFolders);
  }
}
