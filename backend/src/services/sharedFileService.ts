import prisma from '../config/database';
import { MailService } from './mailService';
import { AuditService } from './auditService';
import { SharedLinkService } from './sharedLinkService';
import { ShareKeyService } from './shareKeyService';
import logger from '../config/logger';
import { acceptedSharePermissionWhere, findSharedFolderAccessRoot } from '../middlewares/permissions';
import { DEK_UNLOCK_REQUIRED } from '../utils/dekGuard';

type Permissions = {
  canRead?: boolean;
  canWrite?: boolean;
  canDelete?: boolean;
  canShare?: boolean;
};

const sharedBySelect = { select: { id: true, email: true, firstName: true, lastName: true } };
const sharedWithSelect = { select: { id: true, email: true, firstName: true, lastName: true } };

const userDisplayName = (user?: { email?: string | null; firstName?: string | null; lastName?: string | null }) => {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || user?.email || 'Un utilisateur';
};

export class SharedFileService {
  static async shareFile(
    userId: string,
    fileId: string,
    targetUserId: string,
    permissions: Permissions = {},
    ownerWrappedDek?: string
  ) {
    const file = await prisma.file.findFirst({ where: { id: fileId, isDeleted: false } });
    if (!file) throw new Error('File not found');
    if (file.isVault) throw new Error('Le partage est interdit pour les fichiers du coffre-fort');

    const isOwner = file.userId === userId;
    const directShare = isOwner
      ? null
      : await prisma.sharedFile.findFirst({
          where: { fileId, ...acceptedSharePermissionWhere(userId, 'share') },
        });
    const folderShare = !isOwner && !directShare && file.folderId
      ? await findSharedFolderAccessRoot(userId, file.folderId, 'share')
      : null;
    if (!isOwner && !directShare && !folderShare) {
      throw new Error("Vous n'avez pas la permission de partager ce fichier");
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) throw new Error('Target user not found');
    if (targetUser.id === userId) throw new Error('Impossible de partager un fichier avec vous-même');
    if (targetUser.id === file.userId) throw new Error('Le propriétaire a déjà accès à ce fichier');
    if (targetUser.accountStatus !== 'ACTIVE') {
      throw new Error('Le compte destinataire est inactif ou suspendu');
    }

    const existing = await prisma.sharedFile.findFirst({ where: { fileId, sharedWithId: targetUserId } });
    if (existing) throw new Error('File already shared with this user');

    await SharedLinkService.assertShareLimit(userId);
    const shareWrappedDek = isOwner ? ownerWrappedDek : directShare?.ownerWrappedDek || folderShare?.ownerWrappedDek;
    if (!isOwner && !shareWrappedDek) throw new Error(DEK_UNLOCK_REQUIRED);

    const sharedFile = await prisma.sharedFile.create({
      data: {
        fileId,
        sharedById: userId,
        sharedWithId: targetUserId,
        canRead: permissions.canRead ?? true,
        canWrite: permissions.canWrite ?? false,
        canDelete: permissions.canDelete ?? false,
        canShare: permissions.canShare ?? false,
        ownerWrappedDek: shareWrappedDek,
      },
      include: { file: true, sharedBy: sharedBySelect, sharedWith: sharedWithSelect },
    });

    try {
      const owner = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true, lastName: true },
      });
      await MailService.sendShareNotification(
        targetUser.email,
        userDisplayName(owner),
        file.name,
        'file',
        undefined,
        targetUser.language,
        {
          canRead: permissions.canRead ?? true,
          canWrite: permissions.canWrite ?? false,
          canDelete: permissions.canDelete ?? false,
          canShare: permissions.canShare ?? false,
        }
      );
    } catch (error) {
      logger.error({ err: error }, 'Error sending file share notification');
    }

    AuditService.createLog(userId, 'SHARE', { fileName: file.name, fileId }).catch((e) => logger.error(e));

    return ShareKeyService.stripOwnerWrappedDek(sharedFile);
  }

  static async listFilesSharedWithMe(userId: string) {
    const sharedFiles = await prisma.sharedFile.findMany({
      where: { sharedWithId: userId, accepted: true, file: { is: { isDeleted: false } } },
      include: { file: true, sharedBy: sharedBySelect },
      orderBy: { createdAt: 'desc' },
    });
    return ShareKeyService.stripOwnerWrappedDekMany(sharedFiles);
  }

  static async listFilesSharedByMe(userId: string) {
    const sharedFiles = await prisma.sharedFile.findMany({
      where: { sharedById: userId, file: { is: { isDeleted: false } } },
      include: { file: true, sharedWith: sharedWithSelect },
      orderBy: { createdAt: 'desc' },
    });
    return ShareKeyService.stripOwnerWrappedDekMany(sharedFiles);
  }

  static async getFileShares(fileId: string, userId: string) {
    const file = await prisma.file.findFirst({ where: { id: fileId, userId, isDeleted: false } });
    if (!file) throw new Error('File not found');

    const shares = await prisma.sharedFile.findMany({
      where: { fileId },
      include: { sharedWith: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } } },
    });
    return ShareKeyService.stripOwnerWrappedDekMany(shares);
  }

  static async updatePermissions(shareId: string, userId: string, permissions: Permissions) {
    const sharedFile = await prisma.sharedFile.findFirst({
      where: { id: shareId, sharedById: userId, file: { is: { isDeleted: false } } },
    });
    if (!sharedFile) throw new Error('Shared file not found');

    const updatedShare = await prisma.sharedFile.update({
      where: { id: shareId },
      data: {
        canRead: permissions.canRead ?? sharedFile.canRead,
        canWrite: permissions.canWrite ?? sharedFile.canWrite,
        canDelete: permissions.canDelete ?? sharedFile.canDelete,
        canShare: permissions.canShare ?? sharedFile.canShare,
      },
      include: { file: true, sharedBy: sharedBySelect, sharedWith: sharedWithSelect },
    });
    return ShareKeyService.stripOwnerWrappedDek(updatedShare);
  }

  static async removeSharedFile(shareId: string, userId: string) {
    const sharedFile = await prisma.sharedFile.findFirst({
      where: { id: shareId, sharedById: userId, file: { is: { isDeleted: false } } },
    });
    if (!sharedFile) throw new Error('Shared file not found');

    await prisma.sharedFile.delete({ where: { id: shareId } });
    return { message: 'Shared file removed successfully' };
  }

  static async getSharedFileAccess(fileId: string, userId: string) {
    const sharedFile = await prisma.sharedFile.findFirst({
      where: { fileId, ...acceptedSharePermissionWhere(userId, 'read') },
      include: { file: true },
    });

    if (sharedFile) {
      if (sharedFile.file.isDeleted) throw new Error('File not found');
      if (sharedFile.file.isVault) throw new Error('Ce fichier appartient au coffre-fort et ne peut pas être partagé');
      return sharedFile;
    }

    const file = await prisma.file.findUnique({ where: { id: fileId }, include: { folder: true } });
    if (!file || file.isDeleted) throw new Error('File not found');
    if (file.folder?.isDeleted) throw new Error('File not found');

    if (file.folderId) {
      if (file.isVault) throw new Error('Ce fichier appartient au coffre-fort et ne peut pas être partagé');
      const sharedFolder = await findSharedFolderAccessRoot(userId, file.folderId, 'read');

      if (sharedFolder) {
        return {
          file,
          canRead: sharedFolder.canRead,
          canWrite: sharedFolder.canWrite,
          canDelete: sharedFolder.canDelete,
          canShare: sharedFolder.canShare,
          ownerWrappedDek: sharedFolder.ownerWrappedDek,
        };
      }
    }

    throw new Error('File not shared with you or you do not have read access');
  }

  static async getPendingFiles(userId: string) {
    const pendingFiles = await prisma.sharedFile.findMany({
      where: { sharedWithId: userId, accepted: false, file: { is: { isDeleted: false } } },
      include: {
        file: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } } } },
        sharedBy: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
      },
    });
    return ShareKeyService.stripOwnerWrappedDekMany(pendingFiles);
  }

  static async acceptSharedFile(shareId: string, userId: string) {
    const sharedFile = await prisma.sharedFile.findUnique({ where: { id: shareId }, include: { file: true } });
    if (!sharedFile || sharedFile.sharedWithId !== userId || sharedFile.file.isDeleted) {
      throw new Error('Shared file not found or not shared with you');
    }

    const acceptedFile = await prisma.sharedFile.update({
      where: { id: shareId },
      data: { accepted: true },
      include: { file: true, sharedBy: sharedBySelect },
    });
    return ShareKeyService.stripOwnerWrappedDek(acceptedFile);
  }

  static async rejectSharedFile(shareId: string, userId: string) {
    const sharedFile = await prisma.sharedFile.findUnique({ where: { id: shareId }, include: { file: true } });
    if (!sharedFile || sharedFile.sharedWithId !== userId || sharedFile.file.isDeleted) {
      throw new Error('Shared file not found or not shared with you');
    }

    return prisma.sharedFile.delete({ where: { id: shareId } });
  }

  static async getAcceptedSharedFiles(userId: string, vaultUnlocked: boolean) {
    const sharedFiles = await prisma.sharedFile.findMany({
      where: {
        sharedWithId: userId,
        accepted: true,
        file: { is: { isDeleted: false, ...(vaultUnlocked ? {} : { isVault: false }) } },
      },
      include: {
        file: {
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
            tags: { include: { tag: true } },
          },
        },
        sharedBy: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
      },
    });
    return ShareKeyService.stripOwnerWrappedDekMany(sharedFiles);
  }
}
